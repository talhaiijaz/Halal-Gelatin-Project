import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { updateBankAccountBalance } from "./bankUtils";


// Helper function to format currency with proper locale and symbol support
function formatCurrency(amount: number, currency: string = "USD"): string {
  // Currency symbols mapping
  const currencySymbols: Record<string, string> = {
    USD: '$',
    PKR: 'Rs ',
    EUR: '€',
    AED: 'د.إ '
  };

  // Handle EUR specially to ensure symbol appears before number
  if (currency === 'EUR') {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `€${formatted}`;
  }

  // Use appropriate locale based on currency
  const locale = currency === 'USD' ? 'en-US' : 
                 currency === 'PKR' ? 'en-PK' : 
                 currency === 'AED' ? 'en-AE' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    // Validate required fields
    if (!args.amount || args.amount <= 0) {
      throw new Error("Payment validation failed: Payment amount must be greater than 0. Please enter a valid amount.");
    }
    
    if (!args.reference || args.reference.trim() === "") {
      throw new Error("Payment validation failed: Reference number is required. Please provide a payment reference (e.g., check number, transaction ID).");
    }
    
    if (!args.method) {
      throw new Error("Payment validation failed: Payment method is required. Please select how the payment was made (bank transfer, cash, etc.).");
    }

    let currency: string;
    let clientId;
    let paymentType: "invoice" | "advance" = (args.type as any) || "invoice";

    if (args.invoiceId) {
      const invoice = await ctx.db.get(args.invoiceId);
      if (!invoice) throw new Error("Payment validation failed: Invoice not found. Please select a valid invoice to record the payment against.");

      // Calculate the remaining amount to be paid
      const remainingAmount = invoice.amount - invoice.totalPaid;
      
      // Validate against remaining amount for invoice payments
      if (args.amount > remainingAmount) {
        throw new Error(`Payment amount (${formatCurrency(args.amount, invoice.currency)}) exceeds remaining amount to be paid (${formatCurrency(remainingAmount, invoice.currency)}). Total invoice amount: ${formatCurrency(invoice.amount, invoice.currency)}, already paid: ${formatCurrency(invoice.totalPaid, invoice.currency)}`);
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
          // For local payments, bank account should match invoice currency (PKR)
          if (clientOfInvoice?.type === "local") {
            if (bank.currency !== currency) {
              throw new Error(`Payment validation failed: Bank account currency (${bank.currency}) must match invoice currency (${currency}) for local payments. Please select a bank account with the correct currency.`);
            }
          } else {
            // For international payments, allow any supported currency bank accounts including PKR
            // Conversion will be handled if currencies don't match
            if (!['USD', 'EUR', 'AED', 'PKR'].includes(bank.currency)) {
              throw new Error(`Payment validation failed: Bank account currency (${bank.currency}) must be USD, EUR, AED, or PKR for international payments. Please select a bank account with a supported currency.`);
            }
          }
        }
      }

      // Handle conversion rate logic based on currency matching
      let conversionRateToUSD: number | undefined;
      let convertedAmountUSD: number | undefined;
      
      // Get bank account currency for comparison
      let bankCurrency: string | undefined;
      if (args.bankAccountId) {
        const bank = await ctx.db.get(args.bankAccountId);
        bankCurrency = bank?.currency;
      }
      
      // Only require conversion when bank account currency differs from payment/invoice currency
      const needsConversion = !!bankCurrency && bankCurrency !== currency;
      
      if (needsConversion && clientOfInvoice?.type === "international") {
        if (!args.conversionRateToUSD) {
          throw new Error(`Conversion rate is required when paying ${currency} invoice with ${bankCurrency} bank account`);
        }
        conversionRateToUSD = args.conversionRateToUSD;
        convertedAmountUSD = args.amount * conversionRateToUSD;
      } else if (!needsConversion) {
        // No conversion needed when bank account currency matches payment currency
        conversionRateToUSD = undefined;
        convertedAmountUSD = undefined;
      } else if (currency === "USD") {
        // Edge: invoice/payment currency is USD but bank account differs
        convertedAmountUSD = args.amount;
      }
      
      // Ensure we don't set stale conversion fields when not applicable
      if (!needsConversion) {
        conversionRateToUSD = undefined;
        convertedAmountUSD = undefined;
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

      // If linked to a bank account, also log activity under that bank account and update balance
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

        // Create bank transaction for the payment
        const now = Date.now();
        
        // For bank transactions, we need to store the amount in the bank account's currency
        // For local payments with withholding, the bank transaction should reflect the NET amount (after withholding)
        let bankTransactionAmount = args.amount;
        let bankTransactionCurrency = currency;
        
        // For local clients with withholding, bank transaction should be the net amount
        if (isLocalClient && rate > 0) {
          bankTransactionAmount = netCash; // Use net amount after withholding
        }
        
        if (needsConversion && bank) {
          // If payment currency differs from bank account currency, we need to convert
          // For now, we'll store the original payment amount and currency
          // The conversion will be handled in the UI display
          bankTransactionAmount = isLocalClient && rate > 0 ? netCash : args.amount;
          bankTransactionCurrency = currency;
        }
        
        // Create description that shows gross amount, withholding, and net amount for local payments
        let description = `Payment received from ${client?.name || "Customer"}: ${args.reference}`;
        if (isLocalClient && rate > 0) {
          description = `Payment received from ${client?.name || "Customer"}: ${args.reference} (Gross: ${formatCurrency(args.amount, currency)}, Tax: ${formatCurrency(withheldAmount, currency)}, Net: ${formatCurrency(netCash, currency)})`;
        }
        
        const bankTransactionData: any = {
          bankAccountId: args.bankAccountId,
          transactionType: "payment_received",
          amount: bankTransactionAmount,
          currency: bankTransactionCurrency,
          description: description,
          reference: args.reference,
          paymentId: paymentId,
          transactionDate: args.paymentDate || now, // Use the payment date entered by user
          status: "completed",
          notes: args.notes,
          recordedBy: undefined as any,
          createdAt: now,
        };

        // Add currency conversion fields if conversion was needed
        if (needsConversion && conversionRateToUSD && convertedAmountUSD) {
          bankTransactionData.originalAmount = args.amount;
          bankTransactionData.originalCurrency = currency;
          bankTransactionData.exchangeRate = conversionRateToUSD;
          bankTransactionData.convertedAmountUSD = convertedAmountUSD;
        }

        await ctx.db.insert("bankTransactions", bankTransactionData);

        // Update bank account balance after creating transaction
        await updateBankAccountBalance(ctx, args.bankAccountId);
      }
      // Update invoice aggregates
      const newTotalPaid = invoice.totalPaid + args.amount; // invoice credited by gross amount
      const newOutstandingBalance = Math.max(0, invoice.amount - newTotalPaid);
      let newStatus: "unpaid" | "partially_paid" | "paid";
      if (newTotalPaid >= invoice.amount) newStatus = "paid";
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
      throw new Error("Payment validation failed: Client selection is required for advance payments. Please select a client to record the advance payment against.");
    }
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Payment validation failed: Client not found. Please select a valid client to record the advance payment against.");

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
    
    // Get bank account currency for comparison
    let bankCurrency: string | undefined;
    if (args.bankAccountId) {
      const bank = await ctx.db.get(args.bankAccountId);
      bankCurrency = bank?.currency;
    }
    
    // Only require conversion when bank account currency differs from payment currency
    const needsConversion = !!bankCurrency && bankCurrency !== currency;
    
    if (needsConversion && client.type === "international") {
      if (!args.conversionRateToUSD) {
        throw new Error(`Payment validation failed: Conversion rate to USD is required for international advance payments in ${currency}. Please provide the exchange rate to convert ${currency} to USD.`);
      }
      conversionRateToUSD = args.conversionRateToUSD;
      convertedAmountUSD = args.amount * conversionRateToUSD;
    } else if (!needsConversion) {
      // Same-currency or USD: no conversion fields
      conversionRateToUSD = undefined;
      convertedAmountUSD = undefined;
    }

    // Validate bank account currency for advances
    if (args.bankAccountId) {
      const bank = await ctx.db.get(args.bankAccountId);
      if (bank) {
        if (client.type === "local") {
          // Local clients must use PKR bank accounts
          if (bank.currency !== "PKR") {
            throw new Error(`Bank account currency (${bank.currency}) must be PKR for local clients`);
          }
        } else {
          // International clients can use USD, EUR, AED, or PKR bank accounts
          if (!['USD', 'EUR', 'AED', 'PKR'].includes(bank.currency)) {
            throw new Error(`Bank account currency (${bank.currency}) must be USD, EUR, AED, or PKR for international clients`);
          }
        }
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
    // If linked to a bank account, also log activity under that bank account and update balance
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

      // Create bank transaction for the advance payment
      const now = Date.now();
      
      // For local clients with withholding, bank transaction should be the net amount
      let bankTransactionAmount = args.amount;
      if (client.type === "local" && rateForAdvance > 0) {
        bankTransactionAmount = netCashAdvance; // Use net amount after withholding
      }
      
      // Create description that shows gross amount, withholding, and net amount for local payments
      let description = `Advance payment received from ${client.name || "Customer"}: ${args.reference}`;
      if (client.type === "local" && rateForAdvance > 0) {
        description = `Advance payment received from ${client.name || "Customer"}: ${args.reference} (Gross: ${formatCurrency(args.amount, currency)}, Tax: ${formatCurrency(withheldForAdvance, currency)}, Net: ${formatCurrency(netCashAdvance, currency)})`;
      }
      
      const bankTransactionData: any = {
        bankAccountId: args.bankAccountId,
        transactionType: "payment_received",
        amount: bankTransactionAmount,
        currency: currency,
        description: description,
        reference: args.reference,
        paymentId: paymentId,
        transactionDate: args.paymentDate || now, // Use the payment date entered by user
        status: "completed",
        notes: args.notes,
        recordedBy: undefined as any,
        createdAt: now,
      };

      // Add currency conversion fields if conversion was needed
      if (needsConversion && conversionRateToUSD && convertedAmountUSD) {
        bankTransactionData.originalAmount = args.amount;
        bankTransactionData.originalCurrency = currency;
        bankTransactionData.exchangeRate = conversionRateToUSD;
        bankTransactionData.convertedAmountUSD = convertedAmountUSD;
      }

      await ctx.db.insert("bankTransactions", bankTransactionData);

      // Update bank account balance after creating transaction
      await updateBankAccountBalance(ctx, args.bankAccountId);
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
    let payments = await ctx.db.query("payments").collect();

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

    // Sort by payment date (newest first), then by creation time (most recent first)
    enrichedPayments.sort((a, b) => {
      const dateDiff = b.paymentDate - a.paymentDate;
      if (dateDiff !== 0) return dateDiff;
      // Same date: most recent creation time first
      return b.createdAt - a.createdAt;
    });

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
  returns: v.object({
    totalAmount: v.number(),
    totalAmountUSD: v.number(),
    totalAmountPKR: v.number(),
    totalAmountEUR: v.number(),
    totalAmountAED: v.number(),
    amountByCurrency: v.record(v.string(), v.number()),
    totalCount: v.number(),
    dailyAverage: v.number(),
    methodStats: v.object({
      bank_transfer: v.object({ count: v.number(), amount: v.number() }),
      check: v.object({ count: v.number(), amount: v.number() }),
      cash: v.object({ count: v.number(), amount: v.number() }),
      credit_card: v.object({ count: v.number(), amount: v.number() }),
      other: v.object({ count: v.number(), amount: v.number() }),
    }),
    averagePayment: v.number(),
  }),
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
    
    // Calculate totals by currency
    const amountByCurrency: Record<string, number> = {};
    
    payments.forEach(payment => {
      const currency = payment.currency;
      const amount = payment.amount;
      
      amountByCurrency[currency] = (amountByCurrency[currency] || 0) + amount;
    });
    
    // For backward compatibility, extract individual currency totals
    const totalAmountUSD = amountByCurrency["USD"] || 0;
    const totalAmountPKR = amountByCurrency["PKR"] || 0;
    const totalAmountEUR = amountByCurrency["EUR"] || 0;
    const totalAmountAED = amountByCurrency["AED"] || 0;
    
    const totalAmount = totalAmountUSD + totalAmountPKR + totalAmountEUR + totalAmountAED;
    const totalCount = payments.length;

    // Calculate daily average
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const dailyAverage = totalAmount / days;

    return {
      totalAmount,
      totalAmountUSD,
      totalAmountPKR,
      totalAmountEUR,
      totalAmountAED,
      amountByCurrency,
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

        // Get payments for this invoice to calculate advance and invoice payments
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
          .collect();

        // Calculate advance and invoice payments separately
        const advancePaid = payments
          .filter((p: any) => p.type === "advance")
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        
        const invoicePaid = payments
          .filter((p: any) => p.type !== "advance")
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

        // Calculate outstanding balance based on order status
        // Only show outstanding for shipped/delivered orders
        const shouldShowOutstanding = order?.status === "shipped" || order?.status === "delivered";
        const calculatedOutstandingBalance = shouldShowOutstanding ? invoice.outstandingBalance : 0;

        return {
          ...invoice,
          outstandingBalance: calculatedOutstandingBalance, // Override with calculated value
          client: client ? {
            _id: client._id,
            name: client.name,
            type: client.type,
          } : null,
          order: order ? {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
          } : null,
          advancePaid,
          invoicePaid,
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

    // Get related entities for logging and bank account updates
    const client = await ctx.db.get(payment.clientId);
    const invoice = payment.invoiceId ? await ctx.db.get(payment.invoiceId) : null;
    const bankAccount = payment.bankAccountId ? await ctx.db.get(payment.bankAccountId) : null;

    // If payment is linked to a bank account, handle bank transaction deletion
    if (payment.bankAccountId) {
      // Find and delete the corresponding bank transaction
      const bankTransaction = await ctx.db
        .query("bankTransactions")
        .filter(q => q.eq(q.field("paymentId"), args.paymentId))
        .first();

      if (bankTransaction) {
        // Soft cancel the bank transaction instead of deleting
        await ctx.db.patch(bankTransaction._id, { status: "cancelled" });

        // Update bank account balance
        await updateBankAccountBalance(ctx, payment.bankAccountId);

        // Log bank account activity
        await logEvent(ctx, {
          entityTable: "banks",
          entityId: String(payment.bankAccountId),
          action: "update",
          message: `Payment deleted${bankAccount ? ` from ${bankAccount.accountName}` : ""}: ${formatCurrency(payment.amount, payment.currency)}${client ? ` from ${client.name}` : ""}`,
          metadata: {
            paymentId: args.paymentId,
            bankTransactionId: bankTransaction._id,
            invoiceId: payment.invoiceId,
            clientId: payment.clientId,
            method: payment.method,
            reference: payment.reference,
            amount: payment.amount,
            currency: payment.currency,
          },
        });
      }
    }

    // If this payment is linked to an invoice, update invoice aggregates
    if (payment.invoiceId && invoice) {
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

      await ctx.db.patch(payment.invoiceId, {
        totalPaid: newTotalPaid,
        outstandingBalance: newOutstandingBalance,
        status: newStatus,
        updatedAt: Date.now(),
      });
    }

    // Delete the payment
    await ctx.db.delete(args.paymentId);
    
    // Create detailed log message
    const paymentDetails = `${formatCurrency(payment.amount, payment.currency)} - ${payment.reference}`;
    const clientName = client ? ` from ${client.name}` : '';
    const logMessage = `Payment deleted: ${paymentDetails}${clientName}`;
    
    await logEvent(ctx, {
      entityTable: "payments",
      entityId: String(args.paymentId),
      action: "delete",
      message: logMessage,
      metadata: { 
        paymentId: args.paymentId, 
        payment,
        bankAccountId: payment.bankAccountId,
        invoiceId: payment.invoiceId,
      },
    });

    return { success: true };
  },
});

// Reverse a payment: mark payment as reversed and mark bank tx as reversed (no new entry)
export const reversePayment = mutation({
  args: {
    paymentId: v.id("payments"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if ((payment as any).isReversed) throw new Error("Payment already reversed");

    const now = Date.now();

    // If linked bank transaction exists, mark it as reversed (no new entry)
    if (payment.bankAccountId) {
      const bankTransaction = await ctx.db
        .query("bankTransactions")
        .filter(q => q.eq(q.field("paymentId"), args.paymentId))
        .first();
      if (bankTransaction) {
        await ctx.db.patch(bankTransaction._id, {
          isReversed: true,
          reversedAt: now,
          reversalReason: args.reason || "Payment reversed",
        });

        await updateBankAccountBalance(ctx as any, bankTransaction.bankAccountId as any);
      }
    }

    // Update invoice aggregates
    if (payment.invoiceId) {
      const invoice = await ctx.db.get(payment.invoiceId);
      if (invoice) {
        const newTotalPaid = Math.max(0, invoice.totalPaid - payment.amount);
        const newOutstandingBalance = Math.max(0, invoice.amount - newTotalPaid);
        await ctx.db.patch(payment.invoiceId, {
          totalPaid: newTotalPaid,
          outstandingBalance: newOutstandingBalance,
          status: newOutstandingBalance === 0 ? "paid" : newTotalPaid === 0 ? "unpaid" : "partially_paid",
          updatedAt: now,
        });
      }
    }

    // Mark payment reversed
    await ctx.db.patch(args.paymentId, {
      isReversed: true as any,
      reversedAt: now as any,
      reversalReason: (args.reason || "Manual reversal") as any,
    });

    await logEvent(ctx, {
      entityTable: "payments",
      entityId: String(args.paymentId),
      action: "update",
      message: `Payment reversed: ${payment.reference}${args.reason ? ` - ${args.reason}` : ""}`,
      metadata: { paymentId: args.paymentId, reason: args.reason },
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

    // Handle bank account changes
    const oldBankAccountId = existing.bankAccountId;
    const newBankAccountId = args.bankAccountId;
    const bankAccountChanged = oldBankAccountId !== newBankAccountId;
    const amountChanged = existing.amount !== args.amount;

    // If bank account changed or amount changed, update bank transactions
    if ((bankAccountChanged || amountChanged) && (oldBankAccountId || newBankAccountId)) {
      // Find existing bank transaction
      const existingBankTransaction = await ctx.db
        .query("bankTransactions")
        .filter(q => q.eq(q.field("paymentId"), args.paymentId))
        .first();

      if (existingBankTransaction) {
        // If bank account changed, remove from old account and add to new account
        if (bankAccountChanged) {
          // Delete old transaction
          await ctx.db.delete(existingBankTransaction._id);
          
          // Update old bank account balance
          if (oldBankAccountId) {
            await updateBankAccountBalance(ctx, oldBankAccountId);
          }

          // Create new transaction in new bank account
          if (newBankAccountId) {
            const client = await ctx.db.get(existing.clientId);
            const newBankAccount = await ctx.db.get(newBankAccountId);
            
            await ctx.db.insert("bankTransactions", {
              bankAccountId: newBankAccountId,
              transactionType: "payment_received",
              amount: args.amount,
              currency: existing.currency,
              description: `Payment received from ${client?.name || "Customer"}: ${args.reference}`,
              reference: args.reference,
              paymentId: args.paymentId,
              transactionDate: args.paymentDate,
              status: "completed",
              notes: args.notes,
              recordedBy: undefined as any,
              createdAt: Date.now(),
            });

            // Update new bank account balance
            await updateBankAccountBalance(ctx, newBankAccountId);

            // Log bank account activity
            await logEvent(ctx, {
              entityTable: "banks",
              entityId: String(newBankAccountId),
              action: "update",
              message: `Payment updated${newBankAccount ? ` in ${newBankAccount.accountName}` : ""}: ${formatCurrency(args.amount, existing.currency)}${client ? ` from ${client.name}` : ""}`,
              metadata: {
                paymentId: args.paymentId,
                oldBankAccountId,
                newBankAccountId,
                oldAmount: existing.amount,
                newAmount: args.amount,
                reference: args.reference,
              },
            });
          }
        } else if (amountChanged) {
          // Just update the amount in the existing transaction
          await ctx.db.patch(existingBankTransaction._id, {
            amount: args.amount,
            description: `Payment received from ${(await ctx.db.get(existing.clientId))?.name || "Customer"}: ${args.reference}`,
            reference: args.reference,
            notes: args.notes,
          });

          // Update bank account balance
          if (oldBankAccountId) {
            await updateBankAccountBalance(ctx, oldBankAccountId);
          }
        }
      }
    }

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
      message: `Payment updated: ${invoiceNumber} - ${formatCurrency(args.amount, existing.currency)} (${clientName})`,
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

    // Sort by payment date (newest first), then by creation time (most recent first)
    payments.sort((a, b) => {
      const dateDiff = b.paymentDate - a.paymentDate;
      if (dateDiff !== 0) return dateDiff;
      // Same date: most recent creation time first
      return b.createdAt - a.createdAt;
    });

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
