import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function logInvoiceEvent(ctx: any, params: { entityId: string; action: "create" | "update" | "delete"; message: string; metadata?: any; userId?: Id<"users"> | undefined; }) {
  try {
    await ctx.db.insert("logs", {
      entityTable: "invoices",
      entityId: params.entityId,
      action: params.action,
      message: params.message,
      metadata: params.metadata,
      userId: params.userId as any,
      createdAt: Date.now(),
    });
  } catch {}
}
import { v } from "convex/values";

// Generate unique invoice number with fiscal year
const generateInvoiceNumber = async (ctx: any) => {
  const now = new Date();
  const fiscalYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const fiscalYearStart = new Date(fiscalYear, 6, 1).getTime(); // July 1
  
  // Format fiscal year as FY25-26
  const fiscalYearStartShort = fiscalYear;
  const fiscalYearEndShort = fiscalYear + 1;
  const fiscalYearLabel = `FY${fiscalYearStartShort.toString().slice(-2)}-${fiscalYearEndShort.toString().slice(-2)}`;
  
  const invoices = await ctx.db
    .query("invoices")
    .filter((q: any) => q.gte(q.field("issueDate"), fiscalYearStart))
    .collect();
  
  const nextNumber = invoices.length + 1;
  return `INV-${fiscalYearLabel}-${nextNumber.toString().padStart(3, '0')}`;
};

// Create invoice for order
export const createForOrder = mutation({
  args: {
    orderId: v.id("orders"),
    issueDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // Check if invoice already exists
    const existingInvoice = await ctx.db
      .query("invoices")
      .withIndex("by_order", q => q.eq("orderId", args.orderId))
      .first();
    
    if (existingInvoice) {
      throw new Error("Invoice already exists for this order");
    }

    const invoiceNumber = await generateInvoiceNumber(ctx);
    // Use order creation date as invoice issue date, fallback to provided issueDate or current time
    const issueDate = args.issueDate || order.orderCreationDate || Date.now();
    const dueDate = args.dueDate || (issueDate + (30 * 24 * 60 * 60 * 1000)); // 30 days default

    const invoiceId = await ctx.db.insert("invoices", {
      invoiceNumber,
      orderId: args.orderId,
      clientId: order.clientId,
      issueDate,
      dueDate,
      status: "unpaid",
      amount: order.totalAmount,
      currency: order.currency,
      totalPaid: 0,
      outstandingBalance: order.totalAmount, // New invoices have full amount outstanding
      notes: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logInvoiceEvent(ctx, { entityId: String(invoiceId), action: "create", message: `Invoice created for order ${order.orderNumber}` });
    return invoiceId;
  },
});

// List invoices with filters
export const list = query({
  args: {
    status: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    search: v.optional(v.string()),
    fiscalYear: v.optional(v.number()), // Add fiscal year filter
  },
  handler: async (ctx, args) => {
    let invoices = await ctx.db.query("invoices").order("desc").collect();

    // Apply filters
    if (args.status) {
      invoices = invoices.filter(i => i.status === args.status);
    }

    if (args.clientId) {
      invoices = invoices.filter(i => i.clientId === args.clientId);
    }

    if (args.startDate) {
      invoices = invoices.filter(i => i.issueDate >= args.startDate!);
    }

    if (args.endDate) {
      invoices = invoices.filter(i => i.issueDate <= args.endDate!);
    }

    if (args.fiscalYear) {
      // Filter invoices by the fiscal year of their associated order
      const allOrders = await ctx.db.query("orders").collect();
      invoices = invoices.filter(invoice => {
        const order = allOrders.find(o => o._id === invoice.orderId);
        return order && order.fiscalYear === args.fiscalYear;
      });
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      invoices = invoices.filter(i =>
        i.invoiceNumber?.toLowerCase().includes(searchLower) ||
        i.orderId?.toLowerCase().includes(searchLower)
      );
    }

    // Fetch related data for each invoice
    const invoicesWithDetails = await Promise.all(
      invoices.map(async (invoice) => {
        const client = await ctx.db.get(invoice.clientId);
        const order = await ctx.db.get(invoice.orderId);
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
          .collect();

        const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
        
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
            email: client.email,
            type: client.type,
          } : null,
          order: order ? {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
          } : null,
          payments,
          totalPayments,
          advancePaid,
          invoicePaid,
        };
      })
    );

    return invoicesWithDetails;
  },
});

// Get single invoice
export const get = query({
  args: {
    id: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice) return null;

    const client = await ctx.db.get(invoice.clientId);
    const order = await ctx.db.get(invoice.orderId);
    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", q => q.eq("orderId", invoice.orderId))
      .collect();
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .collect();

    // Populate bank account data for each payment
    const paymentsWithBankAccounts = await Promise.all(
      payments.map(async (payment) => {
        let bankAccount = null;
        if (payment.bankAccountId) {
          bankAccount = await ctx.db.get(payment.bankAccountId);
        }
        return {
          ...payment,
          bankAccount,
        };
      })
    );

    // Calculate advance and invoice payments separately
    const advancePaid = paymentsWithBankAccounts
      .filter((p: any) => p.type === "advance")
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    
    const invoicePaid = paymentsWithBankAccounts
      .filter((p: any) => p.type !== "advance")
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Calculate outstanding balance based on order status
    // Only show outstanding for shipped/delivered orders
    const shouldShowOutstanding = order?.status === "shipped" || order?.status === "delivered";
    const calculatedOutstandingBalance = shouldShowOutstanding ? invoice.outstandingBalance : 0;

    return {
      ...invoice,
      outstandingBalance: calculatedOutstandingBalance, // Override with calculated value
      client,
      order,
      orderItems,
      payments: paymentsWithBankAccounts,
      advancePaid,
      invoicePaid,
    };
  },
});

// Update invoice status
export const updateStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: v.union(
      v.literal("unpaid"),
      v.literal("partially_paid"),
      v.literal("paid")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    await logInvoiceEvent(ctx, { entityId: String(args.id), action: "update", message: `Invoice status changed to ${args.status}` });
    return { success: true };
  },
});

// Send invoice reminder
export const sendReminder = mutation({
  args: {
    id: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");

    // Update status to unpaid if it's not already set
    if (invoice.status === "unpaid") {
      // Already set to unpaid, no need to update
    }

    return { success: true };
  },
});

// Get invoice statistics
export const getStats = query({
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    
    const stats = {
      total: invoices.length,
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      totalAmountUSD: 0,
      totalAmountPKR: 0,
      totalPaidUSD: 0,
      totalPaidPKR: 0,
      totalOutstandingUSD: 0,
      totalOutstandingPKR: 0,
      byStatus: {
        unpaid: 0,
        partially_paid: 0,
        paid: 0,
      },
    };

    // Check for overdue invoices (read-only in query)
    const now = Date.now();
    
    for (const invoice of invoices) {
      stats.totalAmount += invoice.amount;
      stats.totalPaid += invoice.totalPaid;
      stats.totalOutstanding += invoice.outstandingBalance;
      
      // Separate by currency
      if (invoice.currency === "USD") {
        stats.totalAmountUSD += invoice.amount;
        stats.totalPaidUSD += invoice.totalPaid;
        stats.totalOutstandingUSD += invoice.outstandingBalance;
      } else if (invoice.currency === "PKR") {
        stats.totalAmountPKR += invoice.amount;
        stats.totalPaidPKR += invoice.totalPaid;
        stats.totalOutstandingPKR += invoice.outstandingBalance;
      }
      
      // Categorize invoices by payment status
      if (invoice.outstandingBalance === 0) {
        stats.byStatus.paid++;
      } else if (invoice.totalPaid > 0) {
        stats.byStatus.partially_paid++;
      } else {
        stats.byStatus.unpaid++;
      }
    }

    return stats;
  },
});

// Get aging report
export const getAgingReport = query({
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    const now = Date.now();
    
    const aging = {
      current: 0,      // 0-30 days
      days31to60: 0,   // 31-60 days
      days61to90: 0,   // 61-90 days
      over90: 0,       // Over 90 days
      total: 0,
    };

    for (const invoice of invoices) {
      if (invoice.outstandingBalance > 0) {
        const daysOverdue = Math.floor((now - invoice.dueDate) / (1000 * 60 * 60 * 24));
        
        if (daysOverdue <= 0) {
          aging.current += invoice.outstandingBalance;
        } else if (daysOverdue <= 30) {
          aging.days31to60 += invoice.outstandingBalance;
        } else if (daysOverdue <= 60) {
          aging.days61to90 += invoice.outstandingBalance;
        } else {
          aging.over90 += invoice.outstandingBalance;
        }
        
        aging.total += invoice.outstandingBalance;
      }
    }

    return aging;
  },
});

// Separate mutation to update overdue invoices
export const updateOverdueInvoices = mutation({
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    const now = Date.now();
    let updatedCount = 0;
    
    for (const invoice of invoices) {
      if (invoice.status === "unpaid" && invoice.dueDate < now) {
        await ctx.db.patch(invoice._id, { 
          status: "unpaid", // Keep as unpaid even if overdue
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }
    
    return { updatedCount };
  },
});

// Fix invoice statuses based on actual payment data
export const fixInvoiceStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    let updatedCount = 0;
    
    for (const invoice of invoices) {
      // Get all payments for this invoice
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_invoice", q => q.eq("invoiceId", invoice._id))
        .collect();
      
      // Calculate actual total paid
      const actualTotalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const actualOutstandingBalance = Math.max(0, invoice.amount - actualTotalPaid);
      
      // Determine correct status
      let correctStatus: "unpaid" | "partially_paid" | "paid";
      if (actualTotalPaid >= invoice.amount) {
        correctStatus = "paid";
      } else if (actualTotalPaid > 0) {
        correctStatus = "partially_paid";
      } else {
        correctStatus = "unpaid";
      }
      
      // Update if status or totalPaid is incorrect
      if (invoice.status !== correctStatus || invoice.totalPaid !== actualTotalPaid || invoice.outstandingBalance !== actualOutstandingBalance) {
        await ctx.db.patch(invoice._id, {
          status: correctStatus,
          totalPaid: actualTotalPaid,
          outstandingBalance: actualOutstandingBalance,
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }
    
    return { updatedCount };
  },
});

// Delete invoice (only if no payments recorded)
export const deleteInvoice = mutation({
  args: {
    id: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");

    // Check if payments exist
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", q => q.eq("invoiceId", args.id))
      .collect();

    if (payments.length > 0) {
      throw new Error("Cannot delete invoice with recorded payments");
    }

    // Get invoice details before deletion for logging
    const client = await ctx.db.get(invoice.clientId);
    
    await ctx.db.delete(args.id);
    
    // Create detailed log message
    const invoiceDetails = `${invoice.invoiceNumber || 'INV-' + String(args.id).slice(-6)} - ${invoice.amount} ${invoice.currency}`;
    const clientName = client ? ` for ${client.name}` : '';
    const logMessage = `Invoice deleted: ${invoiceDetails}${clientName}`;
    
    await logInvoiceEvent(ctx, { entityId: String(args.id), action: "delete", message: logMessage });
    return { success: true };
  },
});