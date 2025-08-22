import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper function to format currency
function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-PK', {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function logEvent(ctx: any, params: { entityTable: string; entityId: string; action: "create" | "update" | "delete"; message: string; metadata?: any; userId?: Id<"users"> | undefined; }) {
  try {
    await ctx.db.insert("logs", {
      entityTable: params.entityTable,
      entityId: params.entityId,
      action: params.action,
      message: params.message,
      metadata: params.metadata,
      userId: params.userId as any,
      createdAt: Date.now(),
    });
  } catch (e) {
    // Never throw from logging; best-effort
  }
}

// Record a new payment
export const recordPayment = mutation({
  args: {
    type: v.optional(v.union(v.literal("invoice"), v.literal("advance"))),
    // If invoiceId is provided -> invoice payment; otherwise requires clientId and is an advance payment
    invoiceId: v.optional(v.id("invoices")),
    clientId: v.optional(v.id("clients")),
    amount: v.number(),
    method: v.union(
      v.literal("bank_transfer"),
      v.literal("check"),
      v.literal("cash"),
      v.literal("credit_card"),
      v.literal("other")
    ),
    reference: v.string(),
    paymentDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    bankAccountId: v.optional(v.id("bankAccounts")), // Add bank account integration
    // Multi-currency conversion support
    conversionRateToUSD: v.optional(v.number()), // Required for non-USD international payments
    // Withholding fields (optional; apply to local clients only)
    withheldTaxRate: v.optional(v.number()), // e.g., 4, 5 or custom
  },
  handler: async (ctx, args) => {
    // Validate amount
    if (args.amount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    let currency = "USD";
    let clientId;
    let paymentType: "invoice" | "advance" = (args.type as any) || "invoice";

    if (args.invoiceId) {
      const invoice = await ctx.db.get(args.invoiceId);
      if (!invoice) throw new Error("Invoice not found");

      // Validate against outstanding balance for invoice payments
      if (args.amount > invoice.outstandingBalance) {
        throw new Error(`Payment amount (${args.amount}) exceeds outstanding balance (${invoice.outstandingBalance})`);
      }

      currency = invoice.currency;
      clientId = invoice.clientId;

      // Determine if client is local and withholding applies
      const clientOfInvoice = await ctx.db.get(invoice.clientId);
      const isLocalClient = clientOfInvoice?.type === "local";
      const rate = isLocalClient && args.withheldTaxRate ? Math.max(0, args.withheldTaxRate) : 0;
      const withheldAmount = rate > 0 ? Math.round((args.amount * rate) / 100) : 0;
      const netCash = Math.max(0, args.amount - withheldAmount);

      // Validate bank account currency if provided
      if (args.bankAccountId) {
        const bank = await ctx.db.get(args.bankAccountId);
        if (bank) {
          // For international payments, bank account should be USD (since payments get converted to USD)
          // For local payments, bank account should match invoice currency (PKR)
          const expectedBankCurrency = clientOfInvoice?.type === "local" ? currency : "USD";
          if (bank.currency !== expectedBankCurrency) {
            throw new Error(`Bank account currency (${bank.currency}) must be ${expectedBankCurrency} for ${clientOfInvoice?.type === "local" ? "local" : "international"} payments`);
          }
        }
      }

      // Handle conversion rate for international non-USD payments
      let conversionRateToUSD: number | undefined;
      let convertedAmountUSD: number | undefined;
      
      if (clientOfInvoice?.type === "international" && currency !== "USD") {
        if (!args.conversionRateToUSD) {
          throw new Error(`Conversion rate to USD is required for international payments in ${currency}`);
        }
        conversionRateToUSD = args.conversionRateToUSD;
        convertedAmountUSD = args.amount * conversionRateToUSD;
      } else if (currency === "USD") {
        convertedAmountUSD = args.amount;
      }

      // Create payment record (respect requested type; default to 'invoice')
      const paymentId = await ctx.db.insert("payments", {
        type: paymentType,
        invoiceId: args.invoiceId,
        clientId,
        amount: args.amount,
        currency,
        paymentDate: args.paymentDate || Date.now(),
        method: args.method,
        reference: args.reference,
        notes: args.notes,
        bankAccountId: args.bankAccountId,
        conversionRateToUSD,
        convertedAmountUSD,
        cashReceived: netCash,
        withheldTaxRate: rate > 0 ? rate : undefined,
        withheldTaxAmount: rate > 0 ? withheldAmount : undefined,
        recordedBy: undefined as any,
        createdAt: Date.now(),
      });
      await logEvent(ctx, {
        entityTable: "payments",
        entityId: String(paymentId),
        action: "create",
        message: `Payment recorded for invoice ${invoice.invoiceNumber || String(invoice._id)}: ${args.amount}`,
        metadata: { invoiceId: args.invoiceId, clientId, netCash, withheldAmount, rate },
      });

      // If linked to a bank account, also log activity under that bank account
      if (args.bankAccountId) {
        const bank = await ctx.db.get(args.bankAccountId);
        const client = await ctx.db.get(clientId!);
        await logEvent(ctx, {
          entityTable: "banks",
          entityId: String(args.bankAccountId),
          action: "update",
          message: `Payment received${bank ? ` to ${bank.accountName}` : ""}: ${formatCurrency(args.amount, currency)}${client ? ` from ${client.name}` : ""}`,
          metadata: {
            paymentId,
            invoiceId: args.invoiceId,
            clientId,
            method: args.method,
            reference: args.reference,
            netCash,
            withheldAmount,
            rate,
          },
        });
      }
      // Update invoice aggregates
      const newTotalPaid = invoice.totalPaid + args.amount; // invoice credited by gross amount
      const newOutstandingBalance = Math.max(0, invoice.amount - newTotalPaid);
      let newStatus: "unpaid" | "partially_paid" | "paid";
      if (newOutstandingBalance === 0) newStatus = "paid";
      else if (newTotalPaid > 0) newStatus = "partially_paid";
      else newStatus = "unpaid";

      await ctx.db.patch(args.invoiceId, {
        totalPaid: newTotalPaid,
        outstandingBalance: newOutstandingBalance,
        status: newStatus,
        updatedAt: Date.now(),
      });

      // Also log under the related order so Order Activity reflects this payment
      await logEvent(ctx, {
        entityTable: "orders",
        entityId: String(invoice.orderId),
        action: "update",
        message: `Payment recorded for ${invoice.invoiceNumber || String(invoice._id)}: ${formatCurrency(args.amount, currency)}${convertedAmountUSD ? ` (USD ${formatCurrency(convertedAmountUSD, "USD")})` : ""}`,
        metadata: {
          paymentId,
          invoiceId: args.invoiceId,
          orderId: invoice.orderId,
          amount: args.amount,
          currency,
          convertedAmountUSD,
          conversionRateToUSD,
          outstandingAfter: newOutstandingBalance,
          statusAfter: newStatus,
        },
      });

      return paymentId;
    }

    // Advance payment path
    if (!args.clientId) {
      throw new Error("For advance payments, clientId is required");
    }
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found");

    // For advance payments, currency should be provided or default based on client type
    // Note: Advance payments will use the currency provided or default to client type currency
    currency = client.type === "local" ? "PKR" : "USD";
    clientId = args.clientId;
    paymentType = "advance";

    const rateForAdvance = client.type === "local" && args.withheldTaxRate ? Math.max(0, args.withheldTaxRate) : 0;
    const withheldForAdvance = rateForAdvance > 0 ? Math.round((args.amount * rateForAdvance) / 100) : 0;
    const netCashAdvance = Math.max(0, args.amount - withheldForAdvance);

    // Handle conversion rate for international advance payments
    let conversionRateToUSD: number | undefined;
    let convertedAmountUSD: number | undefined;
    
    if (client.type === "international" && currency !== "USD") {
      if (!args.conversionRateToUSD) {
        throw new Error(`Conversion rate to USD is required for international advance payments in ${currency}`);
      }
      conversionRateToUSD = args.conversionRateToUSD;
      convertedAmountUSD = args.amount * conversionRateToUSD;
    } else if (currency === "USD") {
      convertedAmountUSD = args.amount;
    }

    // Validate bank account currency for advances too (must match derived currency)
    if (args.bankAccountId) {
      const bank = await ctx.db.get(args.bankAccountId);
      if (bank && bank.currency !== currency) {
        throw new Error(`Bank account currency (${bank.currency}) must match client currency (${currency})`);
      }
    }

    const paymentId = await ctx.db.insert("payments", {
      type: paymentType,
      clientId,
      amount: args.amount,
      currency,
      paymentDate: args.paymentDate || Date.now(),
      method: args.method,
      reference: args.reference,
      notes: args.notes,
      bankAccountId: args.bankAccountId,
      conversionRateToUSD,
      convertedAmountUSD,
      cashReceived: netCashAdvance,
      withheldTaxRate: rateForAdvance > 0 ? rateForAdvance : undefined,
      withheldTaxAmount: rateForAdvance > 0 ? withheldForAdvance : undefined,
      recordedBy: undefined as any,
      createdAt: Date.now(),
    });
    await logEvent(ctx, {
      entityTable: "payments",
      entityId: String(paymentId),
      action: "create",
      message: `Advance payment recorded for client ${client.name || String(client._id)}: ${args.amount}`,
      metadata: { clientId, netCashAdvance, withheldForAdvance, rateForAdvance },
    });
    // If linked to a bank account, also log activity under that bank account
    if (args.bankAccountId) {
      const bank = await ctx.db.get(args.bankAccountId);
      await logEvent(ctx, {
        entityTable: "banks",
        entityId: String(args.bankAccountId),
        action: "update",
        message: `Advance payment received${bank ? ` to ${bank.accountName}` : ""}: ${formatCurrency(args.amount, currency)} (Client: ${client.name || String(client._id)})`,
        metadata: {
          paymentId,
          clientId,
          method: args.method,
          reference: args.reference,
          netCash: netCashAdvance,
          withheldAmount: withheldForAdvance,
          rate: rateForAdvance,
        },
      });
    }

    return paymentId;
  },
});

// List payments with filters
export const list = query({
  args: {
    invoiceId: v.optional(v.id("invoices")),
    clientId: v.optional(v.id("clients")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    method: v.optional(v.string()),
    fiscalYear: v.optional(v.number()), // Add fiscal year filter
  },
  handler: async (ctx, args) => {
    let payments = await ctx.db.query("payments").order("desc").collect();

    // Filter by invoice
    if (args.invoiceId) {
      payments = payments.filter(p => p.invoiceId === args.invoiceId);
    }

    // Filter by client (through invoices)
    if (args.clientId) {
      const clientInvoices = await ctx.db
        .query("invoices")
        .withIndex("by_client", q => q.eq("clientId", args.clientId!))
        .collect();
      const invoiceIds = clientInvoices.map(i => i._id);
      payments = payments.filter(p => p.invoiceId && invoiceIds.includes(p.invoiceId));
    }

    // Filter by date range
    if (args.startDate) {
      payments = payments.filter(p => p.paymentDate >= args.startDate!);
    }
    if (args.endDate) {
      payments = payments.filter(p => p.paymentDate <= args.endDate!);
    }

    // Filter by method
    if (args.method) {
      payments = payments.filter(p => p.method === args.method);
    }

    // Filter by fiscal year (through orders)
    if (args.fiscalYear) {
      const allOrders = await ctx.db.query("orders").collect();
      const allInvoices = await ctx.db.query("invoices").collect();
      
      payments = payments.filter(payment => {
        const invoice = payment.invoiceId ? allInvoices.find(inv => inv._id === payment.invoiceId) : null;
        if (!invoice) return false; // only invoice-linked payments participate in FY filter
        const order = allOrders.find(o => o._id === invoice.orderId);
        return order && order.fiscalYear === args.fiscalYear;
      });
    }

    // Enrich with invoice and client data
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        const invoice = payment.invoiceId ? await ctx.db.get(payment.invoiceId) : null;
        const client = await ctx.db.get(payment.clientId);
        let order = null;
        if (invoice) order = await ctx.db.get(invoice.orderId);

        const recordedBy = payment.recordedBy ? await ctx.db.get(payment.recordedBy) : null;
        const bankAccount = payment.bankAccountId ? await ctx.db.get(payment.bankAccountId) : null;

        return {
          ...payment,
          invoice: invoice ? {
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            status: invoice.status,
          } : null,
          client: client ? {
            _id: client._id,
            name: client.name,
            type: client.type,
          } : null,
          order: order ? {
            _id: order._id,
            orderNumber: order.orderNumber,
          } : null,
          bankAccount: bankAccount ? {
            _id: bankAccount._id,
            accountName: bankAccount.accountName,
            bankName: bankAccount.bankName,
            accountNumber: bankAccount.accountNumber,
          } : null,
          recordedByUser: recordedBy ? {
            _id: recordedBy._id,
            name: recordedBy.name,
            email: recordedBy.email,
          } : null,
        };
      })
    );

    return enrichedPayments;
  },
});

// Get payment statistics
export const getStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    fiscalYear: v.optional(v.number()), // Add fiscal year filter
  },
  handler: async (ctx, args) => {
    // Default to current fiscal year if no start date provided
    const now = new Date();
    const fiscalYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const startDate = args.startDate || new Date(fiscalYear, 6, 1).getTime(); // July 1
    const endDate = args.endDate || Date.now();

    let payments = await ctx.db.query("payments").collect();

    // Filter by fiscal year if provided
    if (args.fiscalYear) {
      const allOrders = await ctx.db.query("orders").collect();
      const allInvoices = await ctx.db.query("invoices").collect();
      
      payments = payments.filter(payment => {
        const invoice = allInvoices.find(inv => inv._id === payment.invoiceId);
        if (!invoice) return false;
        const order = allOrders.find(o => o._id === invoice.orderId);
        return order && order.fiscalYear === args.fiscalYear;
      });
    }

    // Filter by date range
    payments = payments.filter(p => 
      p.paymentDate >= startDate && p.paymentDate <= endDate
    );

    // Calculate statistics by method
    const methodStats = {
      bank_transfer: { count: 0, amount: 0 },
      check: { count: 0, amount: 0 },
      cash: { count: 0, amount: 0 },
      credit_card: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };

    payments.forEach(payment => {
      if (payment.method in methodStats) {
        const method = payment.method as keyof typeof methodStats;
        methodStats[method].count++;
        methodStats[method].amount += payment.amount;
      }
    });

    // Get clients for currency classification
    const clients = await ctx.db.query("clients").collect();
    
    // Calculate totals using converted amounts for international payments
    const totalAmountUSD = payments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "international" && p.convertedAmountUSD;
      })
      .reduce((sum, p) => sum + (p.convertedAmountUSD || 0), 0);
    
    const totalAmountPKR = payments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "local";
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalAmount = totalAmountUSD + totalAmountPKR; // Use converted amounts
    const totalCount = payments.length;

    // Calculate daily average
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const dailyAverage = totalAmount / days;

    return {
      totalAmount,
      totalAmountUSD,
      totalAmountPKR,
      totalCount,
      dailyAverage,
      methodStats,
      averagePayment: totalCount > 0 ? totalAmount / totalCount : 0,
    };
  },
});

// Get unpaid invoices for a client
export const getUnpaidInvoices = query({
  args: {
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    let baseQuery = ctx.db
      .query("invoices")
      .filter(q => q.neq(q.field("status"), "paid"));

    let invoices = await baseQuery.collect();
    if (args.clientId) {
      invoices = invoices.filter(inv => inv.clientId === args.clientId);
    }

    // Enrich with client and order data consistently
    const enrichedInvoices = await Promise.all(
      invoices.map(async (invoice) => {
        const client = await ctx.db.get(invoice.clientId);
        const order = await ctx.db.get(invoice.orderId);

        return {
          ...invoice,
          client: client ? {
            _id: client._id,
            name: client.name,
            type: client.type,
          } : null,
          order: order ? {
            _id: order._id,
            orderNumber: order.orderNumber,
          } : null,
        };
      })
    );

    return enrichedInvoices.sort((a: any, b: any) => b.outstandingBalance - a.outstandingBalance);
  },
});

// Get payment receipt
export const getPaymentReceipt = query({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) return null;

    if (!payment.invoiceId) return null;
    const invoice = await ctx.db.get(payment.invoiceId);
    if (!invoice) return null;

    const client = await ctx.db.get(invoice.clientId);
    const order = await ctx.db.get(invoice.orderId);
    const recordedBy = payment.recordedBy ? await ctx.db.get(payment.recordedBy) : null;

    return {
      payment,
      invoice,
      client,
      order,
      recordedBy,
    };
  },
});

// Delete a payment (admin only)
export const deletePayment = mutation({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    // Auth removed - allow all delete operations
    // In production, implement proper access control

    // Get the payment
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");

    // If this payment is advance, just delete it
    if (!payment.invoiceId) {
      await ctx.db.delete(args.paymentId);
      return { success: true };
    }

    // Get the invoice to update
    const invoice = await ctx.db.get(payment.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Update invoice
    const newTotalPaid = Math.max(0, invoice.totalPaid - payment.amount);
    const newOutstandingBalance = invoice.amount - newTotalPaid;
    
    // Determine new status
    let newStatus: "unpaid" | "partially_paid" | "paid";
    if (newTotalPaid === 0) {
      newStatus = "unpaid";
    } else if (newOutstandingBalance > 0) {
      newStatus = "partially_paid";
    } else {
      newStatus = "paid";
    }

    await ctx.db.patch(payment.invoiceId!, {
      totalPaid: newTotalPaid,
      outstandingBalance: newOutstandingBalance,
      status: newStatus,
      updatedAt: Date.now(),
    });



    // Get additional details for logging
    const client = invoice ? await ctx.db.get(invoice.clientId) : null;
    
    // Delete the payment
    await ctx.db.delete(args.paymentId);
    
    // Create detailed log message
    const paymentDetails = `${formatCurrency(payment.amount, payment.currency || 'USD')} - ${payment.reference}`;
    const clientName = client ? ` from ${client.name}` : '';
    const logMessage = `Payment deleted: ${paymentDetails}${clientName}`;
    
    await logEvent(ctx, {
      entityTable: "payments",
      entityId: String(args.paymentId),
      action: "delete",
      message: logMessage,
      metadata: { invoiceLinked: !!payment.invoiceId },
    });

    return { success: true };
  },
});

// Update an existing payment
export const updatePayment = mutation({
  args: {
    paymentId: v.id("payments"),
    amount: v.number(),
    reference: v.string(),
    paymentDate: v.number(),
    notes: v.optional(v.string()),
    bankAccountId: v.optional(v.id("bankAccounts")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.paymentId);
    if (!existing) throw new Error("Payment not found");



    // Update invoice aggregates if linked to invoice
    if (existing.invoiceId) {
      const invoice = await ctx.db.get(existing.invoiceId);
      if (!invoice) throw new Error("Invoice not found");
      const newTotalPaid = Math.max(0, invoice.totalPaid - existing.amount + args.amount);
      const newOutstanding = Math.max(0, invoice.amount - newTotalPaid);
      await ctx.db.patch(existing.invoiceId, {
        totalPaid: newTotalPaid,
        outstandingBalance: newOutstanding,
        status: newOutstanding === 0 ? "paid" : "partially_paid",
        updatedAt: Date.now(),
      });
    }

    // Finally update payment record
    await ctx.db.patch(args.paymentId, {
      amount: args.amount,
      reference: args.reference,
      paymentDate: args.paymentDate,
      notes: args.notes,
      bankAccountId: args.bankAccountId,
    });
    // Get related information for meaningful logging
    const client = await ctx.db.get(existing.clientId);
    const invoice = existing.invoiceId ? await ctx.db.get(existing.invoiceId) : null;
    const bankAccount = args.bankAccountId ? await ctx.db.get(args.bankAccountId) : null;
    
    const clientName = client?.name || "Unknown Client";
    const invoiceNumber = invoice?.invoiceNumber || "N/A";
    const bankName = bankAccount?.accountName || "N/A";
    
    await logEvent(ctx, {
      entityTable: "payments",
      entityId: String(args.paymentId),
      action: "update",
      message: `Payment updated: ${invoiceNumber} - ${formatCurrency(args.amount, existing.currency || 'USD')} (${clientName})`,
      metadata: { 
        previous: { amount: existing.amount, bankAccountId: existing.bankAccountId }, 
        next: { amount: args.amount, bankAccountId: args.bankAccountId },
        clientName: clientName,
        invoiceNumber: invoiceNumber,
        bankName: bankName
      },
    });

    return { success: true };
  },
});

// Get payment history for a client
export const getClientPaymentHistory = query({
  args: {
    clientId: v.id("clients"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all invoices for the client
    const clientInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", q => q.eq("clientId", args.clientId))
      .collect();

    const invoiceIds = clientInvoices.map(i => i._id);

    // Get all payments for these invoices
    let payments = await ctx.db.query("payments").collect();
    payments = payments.filter(p => p.invoiceId && invoiceIds.includes(p.invoiceId));

    // Apply date filter if provided
    if (args.startDate) {
      payments = payments.filter(p => p.paymentDate >= args.startDate!);
    }
    if (args.endDate) {
      payments = payments.filter(p => p.paymentDate <= args.endDate!);
    }

    // Sort by payment date (newest first)
    payments.sort((a, b) => b.paymentDate - a.paymentDate);

    // Enrich with invoice data
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        const invoice = payment.invoiceId ? await ctx.db.get(payment.invoiceId) : null;
        return {
          ...payment,
          invoice: invoice ? {
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
          } : null,
        };
      })
    );

    return enrichedPayments;
  },
});

// Get individual payment with related data
export const get = query({
  args: {
    id: v.id("payments"),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.id);
    if (!payment) return null;

    // Get related data
    const client = await ctx.db.get(payment.clientId);
    const invoice = payment.invoiceId ? await ctx.db.get(payment.invoiceId) : null;
    const bankAccount = payment.bankAccountId ? await ctx.db.get(payment.bankAccountId) : null;

    return {
      ...payment,
      client,
      invoice,
      bankAccount,
    };
  },
});