import { query, mutation } from "./_generated/server";
import { v } from "convex/values";


// Record a new payment
export const recordPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
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
  },
  handler: async (ctx, args) => {
    
    

    // Get the invoice
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Validate payment amount
    if (args.amount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    if (args.amount > invoice.outstandingBalance) {
      throw new Error(`Payment amount exceeds outstanding balance of ${invoice.outstandingBalance}`);
    }

    // Create payment record
    const paymentId = await ctx.db.insert("payments", {
      invoiceId: args.invoiceId,
      amount: args.amount,
      currency: invoice.currency,
      paymentDate: args.paymentDate || Date.now(),
      method: args.method,
      reference: args.reference,
      notes: args.notes,
      recordedBy: "system" as any, // Removed auth
      createdAt: Date.now(),
    });

    // Update invoice
    const newTotalPaid = invoice.totalPaid + args.amount;
    const newOutstandingBalance = invoice.amount - newTotalPaid;
    
    // Determine new status
    let newStatus: "draft" | "sent" | "due" | "partially_paid" | "paid" | "overdue";
    if (newOutstandingBalance === 0) {
      newStatus = "paid";
    } else if (newTotalPaid > 0) {
      newStatus = "partially_paid";
    } else if (invoice.dueDate < Date.now()) {
      newStatus = "overdue";
    } else {
      newStatus = invoice.status;
    }

    await ctx.db.patch(args.invoiceId, {
      totalPaid: newTotalPaid,
      outstandingBalance: newOutstandingBalance,
      status: newStatus,
      updatedAt: Date.now(),
    });

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
      payments = payments.filter(p => invoiceIds.includes(p.invoiceId));
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

    // Enrich with invoice and client data
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        const invoice = await ctx.db.get(payment.invoiceId);
        let client = null;
        let order = null;

        if (invoice) {
          client = await ctx.db.get(invoice.clientId);
          order = await ctx.db.get(invoice.orderId);
        }

        const recordedBy = await ctx.db.get(payment.recordedBy);

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
  },
  handler: async (ctx, args) => {
    
    

    const startDate = args.startDate || new Date(new Date().getFullYear(), 0, 1).getTime();
    const endDate = args.endDate || Date.now();

    const payments = await ctx.db
      .query("payments")
      .filter(q => 
        q.and(
          q.gte(q.field("paymentDate"), startDate),
          q.lte(q.field("paymentDate"), endDate)
        )
      )
      .collect();

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

    // Calculate total
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalCount = payments.length;

    // Calculate daily average
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const dailyAverage = totalAmount / days;

    return {
      totalAmount,
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
    
    

    let query = ctx.db
      .query("invoices")
      .filter(q => q.neq(q.field("status"), "paid"));

    if (args.clientId) {
      const invoices = await query.collect();
      return invoices.filter(inv => inv.clientId === args.clientId);
    }

    const invoices = await query.collect();

    // Enrich with client and order data
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

    // Get the invoice to update
    const invoice = await ctx.db.get(payment.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Update invoice
    const newTotalPaid = invoice.totalPaid - payment.amount;
    const newOutstandingBalance = invoice.amount - newTotalPaid;
    
    // Determine new status
    let newStatus: "draft" | "sent" | "due" | "partially_paid" | "paid" | "overdue";
    if (newTotalPaid === 0) {
      if (invoice.dueDate < Date.now()) {
        newStatus = "overdue";
      } else {
        newStatus = "due";
      }
    } else if (newOutstandingBalance > 0) {
      newStatus = "partially_paid";
    } else {
      newStatus = invoice.status;
    }

    await ctx.db.patch(payment.invoiceId, {
      totalPaid: newTotalPaid,
      outstandingBalance: newOutstandingBalance,
      status: newStatus,
      updatedAt: Date.now(),
    });

    // Delete the payment
    await ctx.db.delete(args.paymentId);

    return { success: true };
  },
});