import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function logClientEvent(ctx: any, params: { entityId: string; action: "create" | "update" | "delete"; message: string; metadata?: any; userId?: Id<"users"> | undefined; }) {
  try {
    await ctx.db.insert("logs", {
      entityTable: "clients",
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

// List all clients with optional filtering
export const list = query({
  args: {
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Apply filters
    const clients = await (args.type
      ? ctx.db.query("clients").withIndex("by_type", (q) => q.eq("type", args.type!))
      : ctx.db.query("clients")
    ).collect();

    // Apply additional filters
    let filtered = clients;
    
    if (args.status) {
      filtered = filtered.filter(client => client.status === args.status);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filtered = filtered.filter(client => 
        (client.name || "").toLowerCase().includes(searchLower) ||
        (client.city || "").toLowerCase().includes(searchLower) ||
        (client.country || "").toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    return filtered;
  },
});

// Get a single client with related data
export const get = query({
  args: {
    id: v.id("clients"),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    if (!client) return null;

    // Get recent orders for this client
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .order("desc")
      .take(10);

    // Get outstanding invoices for shipped/delivered orders only
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .filter((q) => q.neq(q.field("status"), "paid"))
      .collect();

    // Filter to only include invoices for shipped/delivered orders
    const shippedOrDeliveredInvoices = [];
    for (const invoice of invoices) {
      const order = await ctx.db.get(invoice.orderId);
      if (order && (order.status === "shipped" || order.status === "delivered")) {
        shippedOrDeliveredInvoices.push(invoice);
      }
    }

    const totalOutstanding = shippedOrDeliveredInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    // Group outstanding by original invoice currency (only for shipped/delivered orders)
    const outstandingByCurrency: Record<string, number> = {};
    shippedOrDeliveredInvoices.forEach(inv => {
      const currency = inv.currency;
      if (inv.outstandingBalance > 0) {
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + inv.outstandingBalance;
      }
    });

    return {
      ...client,
      recentOrders: orders,
      outstandingAmount: totalOutstanding,
      outstandingByCurrency,
      totalOrders: orders.length,
    };
  },
});

// Create a new client
export const create = mutation({
  args: {
    name: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    taxId: v.optional(v.string()),
    type: v.union(v.literal("local"), v.literal("international")),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    // Check for duplicate email only if email is provided
    if (args.email) {
      const existing = await ctx.db
        .query("clients")
        .filter((q) => q.eq(q.field("email"), args.email))
        .first();

      if (existing) {
        throw new Error("A client with this email already exists");
      }
    }

    const clientId = await ctx.db.insert("clients", {
      name: args.name || "",
      contactPerson: args.contactPerson || "",
      email: args.email || "",
      phone: args.phone || "",
      address: args.address || "",
      city: args.city || "",
      country: args.country || "",
      taxId: args.taxId || "",
      type: args.type,
      status: args.status || "active",
      createdAt: Date.now(),
      // createdBy is now optional - omitted for now
    });

    await logClientEvent(ctx, { entityId: String(clientId), action: "create", message: `Client created: ${args.name || String(clientId)}` });
    return clientId;
  },
});

// Update a client
export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    taxId: v.optional(v.string()),
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new Error("No updates provided");
    }

    await ctx.db.patch(id, cleanUpdates);
    await logClientEvent(ctx, { entityId: String(id), action: "update", message: `Client updated: ${cleanUpdates.name || String(id)}`, metadata: cleanUpdates });
    return { success: true };
  },
});

// Delete a client (hard delete - removes completely)
export const remove = mutation({
  args: {
    id: v.id("clients"),
  },
  handler: async (ctx, args) => {
    // Check if client exists
    const client = await ctx.db.get(args.id);
    if (!client) {
      throw new Error("Client not found");
    }

    // Check if client has any orders (active or completed)
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .first();

    if (orders) {
      throw new Error("Cannot delete client with existing orders. Please remove all orders first.");
    }

    // Check if client has any invoices
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .first();

    if (invoices) {
      throw new Error("Cannot delete client with existing invoices. Please remove all invoices first.");
    }

    // Hard delete the client
    await ctx.db.delete(args.id);
    await logClientEvent(ctx, { entityId: String(args.id), action: "delete", message: `Client deleted: ${client.name || String(args.id)}` });
    return { success: true };
  },
});

// Get client summary with outstanding amounts and total quantities
export const getClientSummary = query({
  args: {
    type: v.union(v.literal("local"), v.literal("international")),
  },
  handler: async (ctx, args) => {
    // Get all clients of the specified type
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_type", q => q.eq("type", args.type))
      .collect();

    // Get all orders for these clients
    const clientIds = clients.map(client => client._id);
    const orders = await ctx.db
      .query("orders")
      .filter(q => q.or(...clientIds.map(id => q.eq(q.field("clientId"), id))))
      .collect();

    // Get all order items for these orders
    const orderIds = orders.map(order => order._id);
    const orderItems = await ctx.db
      .query("orderItems")
      .filter(q => q.or(...orderIds.map(id => q.eq(q.field("orderId"), id))))
      .collect();

    // Get all invoices for these clients
    const invoices = await ctx.db
      .query("invoices")
      .filter(q => q.or(...clientIds.map(id => q.eq(q.field("clientId"), id))))
      .collect();

    // Calculate summary for each client
    const clientSummary = clients.map(client => {
      // Get orders for this client
      const clientOrders = orders.filter(order => order.clientId === client._id);
      
      // Get order items for this client's orders
      const clientOrderItems = orderItems.filter(item => 
        clientOrders.some(order => order._id === item.orderId)
      );
      
      // Calculate total quantity
      const totalQuantity = clientOrderItems.reduce((sum, item) => sum + item.quantityKg, 0);
      
      // Get invoices for this client
      const clientInvoices = invoices.filter(invoice => invoice.clientId === client._id);
      
      // Calculate outstanding amount by currency
      const outstandingByCurrency: Record<string, number> = {};
      clientInvoices.forEach(invoice => {
        const currency = invoice.currency;
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + invoice.outstandingBalance;
      });

      // Get the primary currency (most outstanding amount) or default to USD for international
      const primaryCurrency = Object.keys(outstandingByCurrency).length > 0 
        ? Object.entries(outstandingByCurrency).reduce((a, b) => a[1] > b[1] ? a : b)[0]
        : (args.type === 'international' ? 'USD' : 'PKR');
      
      const outstandingAmount = outstandingByCurrency[primaryCurrency] || 0;

      return {
        clientId: client._id,
        clientName: client.name,
        clientEmail: client.email,
        totalQuantity,
        outstandingAmount,
        outstandingCurrency: primaryCurrency,
        outstandingByCurrency,
        orderCount: clientOrders.length,
        invoiceCount: clientInvoices.length,
      };
    });

    // Sort by outstanding amount (highest first)
    return clientSummary.sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  },
});

// Get client statistics
export const getStats = query({
  args: {
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
  returns: v.object({
    totalClients: v.number(),
    activeClients: v.number(),
    totalOrders: v.number(),
    activeOrders: v.number(),
    totalRevenue: v.number(),
    outstandingAmount: v.number(),
    outstandingByCurrency: v.record(v.string(), v.number()),
    totalOrderValue: v.number(),
    advancePayments: v.number(),
  }),
  handler: async (ctx, args) => {
    const clients = await (args.type
      ? ctx.db.query("clients").withIndex("by_type", (q) => q.eq("type", args.type!))
      : ctx.db.query("clients")
    ).collect();
    const activeClients = clients.filter(c => c.status === "active");

    // Get order counts
    const orders = await ctx.db.query("orders").collect();
    const clientOrders = args.type 
      ? orders.filter(o => {
          const client = clients.find(c => c._id === o.clientId);
          return client && client.type === args.type;
        })
      : orders;

    // Calculate revenue from actual payments (not invoices)
    const payments = await ctx.db.query("payments").collect();
    const clientPayments = args.type
      ? payments.filter(p => {
          const client = clients.find(c => c._id === p.clientId);
          return client && client.type === args.type;
        })
      : payments;

    // Calculate revenue from payments
    const totalRevenue = clientPayments.reduce((sum, payment) => {
      if (args.type === 'international' && payment.convertedAmountUSD) {
        return sum + payment.convertedAmountUSD;
      } else {
        return sum + payment.amount;
      }
    }, 0);

    // Calculate outstanding from invoices
    const invoices = await ctx.db.query("invoices").collect();
    const clientInvoices = args.type
      ? invoices.filter(i => {
          const client = clients.find(c => c._id === i.clientId);
          return client && client.type === args.type;
        })
      : invoices;

    // Calculate outstanding by currency
    const outstandingByCurrency: Record<string, number> = {};
    clientInvoices.forEach(invoice => {
      const currency = invoice.currency;
      if (invoice.outstandingBalance > 0) {
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + invoice.outstandingBalance;
      }
    });

    const outstandingAmount = clientInvoices
      .filter(inv => inv.status !== "paid")
      .reduce((sum, inv) => sum + inv.outstandingBalance, 0);

    // Calculate total order value
    const totalOrderValue = clientOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate advance payments (payments for orders not yet shipped)
    const advancePaymentInvoices = clientInvoices.filter(inv => {
      const order = clientOrders.find(o => o._id === inv.orderId);
      return order && ["pending", "in_production"].includes(order.status);
    });
    const advancePayments = advancePaymentInvoices.reduce((sum, inv) => sum + inv.totalPaid, 0);

    return {
      totalClients: clients.length,
      activeClients: activeClients.length,
      totalOrders: clientOrders.length,
      activeOrders: clientOrders.filter(o => 
        ["pending", "in_production", "shipped"].includes(o.status)
      ).length,
      totalRevenue,
      outstandingAmount,
      outstandingByCurrency,
      totalOrderValue,
      advancePayments,
    };
  },
});