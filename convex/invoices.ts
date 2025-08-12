import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List invoices with filters
export const list = query({
  args: {
    status: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    search: v.optional(v.string()),
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

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      invoices = invoices.filter(i => 
        i.invoiceNumber.toLowerCase().includes(searchLower)
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

        return {
          ...invoice,
          client: client ? {
            _id: client._id,
            name: client.name,
            email: client.email,
            type: client.type,
          } : null,
          order: order ? {
            _id: order._id,
            orderNumber: order.orderNumber,
          } : null,
          payments,
          totalPayments,
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
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .collect();

    return {
      ...invoice,
      client,
      order,
      payments,
    };
  },
});

// Record payment for invoice
export const recordPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
    amount: v.number(),
    paymentMethod: v.string(),
    referenceNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Validate payment amount
    if (args.amount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    if (args.amount > invoice.outstandingBalance) {
      throw new Error(`Payment amount cannot exceed outstanding balance of ${invoice.outstandingBalance}`);
    }

    // Create payment record
    const paymentId = await ctx.db.insert("payments", {
      invoiceId: args.invoiceId,
      amount: args.amount,
      paymentDate: Date.now(),
      paymentMethod: args.paymentMethod,
      referenceNumber: args.referenceNumber,
      notes: args.notes,
      createdAt: Date.now(),
      createdBy: "system" as any,
    });

    // Update invoice
    const newTotalPaid = invoice.totalPaid + args.amount;
    const newBalance = invoice.amount - newTotalPaid;
    const newStatus = newBalance === 0 ? "paid" : 
                      newTotalPaid > 0 ? "partially_paid" : 
                      invoice.status;

    await ctx.db.patch(args.invoiceId, {
      totalPaid: newTotalPaid,
      outstandingBalance: newBalance,
      status: newStatus,
      updatedAt: Date.now(),
    });

    return { success: true, paymentId };
  },
});

// Update invoice status
export const updateStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("due"),
      v.literal("overdue"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

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

    // In a real app, this would send an email
    // For now, just update the status
    if (invoice.status === "draft") {
      await ctx.db.patch(args.id, {
        status: "sent",
        updatedAt: Date.now(),
      });
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
      byStatus: {
        draft: 0,
        sent: 0,
        due: 0,
        overdue: 0,
        partially_paid: 0,
        paid: 0,
        cancelled: 0,
      },
    };

    // Check for overdue invoices and update their status
    const now = Date.now();
    
    for (const invoice of invoices) {
      stats.totalAmount += invoice.amount;
      stats.totalPaid += invoice.totalPaid;
      stats.totalOutstanding += invoice.outstandingBalance;
      
      // Check if invoice is overdue
      let status = invoice.status;
      if (invoice.status === "due" && invoice.dueDate < now) {
        status = "overdue";
        // Update the status in the database
        await ctx.db.patch(invoice._id, { status: "overdue" });
      }
      
      stats.byStatus[status as keyof typeof stats.byStatus]++;
    }

    return stats;
  },
});