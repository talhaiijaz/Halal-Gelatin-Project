import { query, mutation } from "./_generated/server";
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
        client.name.toLowerCase().includes(searchLower) ||
        client.city.toLowerCase().includes(searchLower) ||
        client.country.toLowerCase().includes(searchLower)
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

    // Get outstanding invoices
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .filter((q) => q.neq(q.field("status"), "paid"))
      .collect();

    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);

    return {
      ...client,
      recentOrders: orders,
      outstandingAmount: totalOutstanding,
      totalOrders: orders.length,
    };
  },
});

// Create a new client
export const create = mutation({
  args: {
    name: v.string(),
    contactPerson: v.string(),
    email: v.string(),
    phone: v.string(),
    address: v.string(),
    city: v.string(),
    country: v.string(),
    taxId: v.string(),
    type: v.union(v.literal("local"), v.literal("international")),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    // Check for duplicate email
    const existing = await ctx.db
      .query("clients")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existing) {
      throw new Error("A client with this email already exists");
    }

    const clientId = await ctx.db.insert("clients", {
      ...args,
      status: args.status || "active",
      createdAt: Date.now(),
      createdBy: "system" as any, // Removed auth
    });

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
    return { success: true };
  },
});

// Delete a client (soft delete by setting status to inactive)
export const remove = mutation({
  args: {
    id: v.id("clients"),
  },
  handler: async (ctx, args) => {
    // Check if client has active orders
    const activeOrders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "in_production"),
          q.eq(q.field("status"), "shipped")
        )
      )
      .first();

    if (activeOrders) {
      throw new Error("Cannot delete client with active orders");
    }

    // Soft delete by setting status to inactive
    await ctx.db.patch(args.id, { status: "inactive" });
    return { success: true };
  },
});

// Get client statistics
export const getStats = query({
  args: {
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
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

    // Calculate revenue (from invoices)
    const invoices = await ctx.db.query("invoices").collect();
    const clientInvoices = args.type
      ? invoices.filter(i => {
          const client = clients.find(c => c._id === i.clientId);
          return client && client.type === args.type;
        })
      : invoices;

    const totalRevenue = clientInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingAmount = clientInvoices
      .filter(inv => inv.status !== "paid")
      .reduce((sum, inv) => sum + inv.outstandingBalance, 0);

    return {
      totalClients: clients.length,
      activeClients: activeClients.length,
      totalOrders: clientOrders.length,
      activeOrders: clientOrders.filter(o => 
        ["pending", "confirmed", "in_production", "shipped"].includes(o.status)
      ).length,
      totalRevenue,
      outstandingAmount,
    };
  },
});