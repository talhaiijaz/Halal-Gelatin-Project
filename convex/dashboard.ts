import { query } from "./_generated/server";
import { v } from "convex/values";

// Universal logs queries
export const listLogs = query({
  args: {
    limit: v.optional(v.number()),
    after: v.optional(v.number()), // createdAt cursor
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 200);
    let logs = await ctx.db.query("logs").order("desc").collect();
    if (args.after) {
      logs = logs.filter(l => l.createdAt < args.after!);
    }
    return logs.slice(0, limit);
  }
});

export const listEntityLogs = query({
  args: {
    entityTable: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_entity", q => q.eq("entityTable", args.entityTable).eq("entityId", args.entityId))
      .order("desc")
      .collect();
    return logs;
  }
});

// Get logs for a specific entity by its ID
export const getEntityActivityLogs = query({
  args: {
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("logs"),
    _creationTime: v.number(),
    entityTable: v.string(),
    entityId: v.string(),
    action: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
    message: v.string(),
    metadata: v.optional(v.any()),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 20, 50);
    const logs = await ctx.db
      .query("logs")
      .filter(q => q.eq(q.field("entityId"), args.entityId))
      .order("desc")
      .take(limit);
    return logs;
  }
});

// Get dashboard statistics
export const getStats = query({
  args: {},
  returns: v.object({
    totalClients: v.object({
      value: v.number(),
    }),
    activeOrders: v.object({
      value: v.number(),
    }),
    currentYearRevenue: v.object({ value: v.number() }),
    outstandingAmount: v.object({ value: v.number() }),
    revenueUSD: v.number(),
    revenuePKR: v.number(),
    outstandingUSD: v.number(),
    outstandingPKR: v.number(),
    outstandingByCurrency: v.record(v.string(), v.number()),
    totalRevenue: v.number(),
    totalPaid: v.number(),
    activeClients: v.number(),
    localClients: v.number(),
    internationalClients: v.number(),
    localOrders: v.number(),
    internationalOrders: v.number(),
    totalOrders: v.optional(v.object({
      value: v.number(),
    })),
    // New financial metrics
    totalOrderValue: v.number(),
    totalOrderValueUSD: v.number(),
    totalOrderValuePKR: v.number(),
    advancePayments: v.number(),
    advancePaymentsUSD: v.number(),
    advancePaymentsPKR: v.number(),
  }),
  handler: async (ctx) => {
    // Get all data
    const clients = await ctx.db.query("clients").collect();
    const orders = await ctx.db.query("orders").collect();
    const invoices = await ctx.db.query("invoices").collect();
    const payments = await ctx.db.query("payments").collect();

    // Calculate client stats
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === "active").length;
    const localClients = clients.filter(c => c.type === "local").length;
    const internationalClients = clients.filter(c => c.type === "international").length;

    // Calculate order stats
    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => 
      ["pending", "confirmed", "in_production", "shipped"].includes(o.status)
    ).length;
    
    // Calculate orders by client type
    const localOrders = orders.filter(o => {
      const client = clients.find(c => c._id === o.clientId);
      return client?.type === "local";
    }).length;
    const internationalOrders = orders.filter(o => {
      const client = clients.find(c => c._id === o.clientId);
      return client?.type === "international";
    }).length;

    // Calculate financial stats using payments with converted amounts
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.totalPaid, 0);
    
    // Calculate outstanding only for shipped/delivered orders
    const shippedOrDeliveredInvoices = invoices.filter(inv => {
      const order = orders.find(o => o._id === inv.orderId);
      return order && (order.status === "shipped" || order.status === "delivered");
    });
    const outstandingAmount = shippedOrDeliveredInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    
    // Calculate revenue by currency using payments (with conversion for international)
    const revenueUSD = payments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "international" && p.convertedAmountUSD;
      })
      .reduce((sum, p) => sum + (p.convertedAmountUSD || 0), 0);
    
    const revenuePKR = payments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "local";
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Calculate outstanding by currency (only for shipped/delivered orders)
    const outstandingByCurrency: Record<string, number> = {};
    shippedOrDeliveredInvoices.forEach(invoice => {
      const currency = invoice.currency;
      if (invoice.outstandingBalance > 0) {
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + invoice.outstandingBalance;
      }
    });

    // For backward compatibility, also calculate USD and PKR totals
    const outstandingUSD = outstandingByCurrency["USD"] || 0;
    const outstandingPKR = outstandingByCurrency["PKR"] || 0;

    // Get current fiscal year stats (July 1 to June 30)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // Determine current fiscal year
    const currentFiscalYear = currentMonth >= 6 ? currentYear : currentYear - 1;
    
    const startOfYear = new Date(currentFiscalYear, 6, 1).getTime(); // July 1
    const endOfYear = new Date(currentFiscalYear + 1, 5, 30, 23, 59, 59, 999).getTime(); // June 30
    
    // Previous fiscal year for comparison
    const prevFiscalYear = currentFiscalYear - 1;
    const startOfPrevYear = new Date(prevFiscalYear, 6, 1).getTime();
    const endOfPrevYear = new Date(prevFiscalYear + 1, 5, 30, 23, 59, 59, 999).getTime();

    // Current fiscal year data
    const currentYearOrders = orders.filter(o => 
      o.createdAt >= startOfYear && o.createdAt <= endOfYear
    );
    const currentYearInvoices = invoices.filter(i => 
      i.createdAt >= startOfYear && i.createdAt <= endOfYear
    );
    const currentYearClients = clients.filter(c => 
      c.createdAt >= startOfYear && c.createdAt <= endOfYear
    );

    // Previous fiscal year data for comparison
    const prevYearOrders = orders.filter(o => 
      o.createdAt >= startOfPrevYear && o.createdAt <= endOfPrevYear
    );
    const prevYearInvoices = invoices.filter(i => 
      i.createdAt >= startOfPrevYear && i.createdAt <= endOfPrevYear
    );
    const prevYearClients = clients.filter(c => 
      c.createdAt >= startOfPrevYear && c.createdAt <= endOfPrevYear
    );

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const change = ((current - previous) / previous) * 100;
      return change >= 0 ? `+${Math.round(change)}%` : `${Math.round(change)}%`;
    };

    const currentYearRevenue = currentYearInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const prevYearRevenue = prevYearInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Calculate new financial metrics
    // 1. Total Order Value - sum of all orders regardless of status
    const totalOrderValue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrderValueUSD = orders
      .filter(o => {
        const client = clients.find(c => c._id === o.clientId);
        return client?.type === "international";
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrderValuePKR = orders
      .filter(o => {
        const client = clients.find(c => c._id === o.clientId);
        return client?.type === "local";
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // 2. Advance Payments - payments for orders not yet shipped (pending/confirmed/in_production)
    const advancePaymentInvoices = invoices.filter(inv => {
      const order = orders.find(o => o._id === inv.orderId);
      return order && ["pending", "confirmed", "in_production"].includes(order.status);
    });
    const advancePayments = advancePaymentInvoices.reduce((sum, inv) => sum + inv.totalPaid, 0);
    const advancePaymentsUSD = advancePaymentInvoices
      .filter(inv => inv.currency === "USD")
      .reduce((sum, inv) => sum + inv.totalPaid, 0);
    const advancePaymentsPKR = advancePaymentInvoices
      .filter(inv => inv.currency === "PKR")
      .reduce((sum, inv) => sum + inv.totalPaid, 0);

    return {
      totalClients: {
        value: totalClients,
      },
      activeOrders: {
        value: activeOrders,
      },
      currentYearRevenue: { value: currentYearRevenue },
      outstandingAmount: { value: outstandingAmount },
      revenueUSD,
      revenuePKR,
      outstandingUSD,
      outstandingPKR,
      outstandingByCurrency,
      totalRevenue,
      totalPaid,
      activeClients,
      localClients,
      internationalClients,
      localOrders,
      internationalOrders,
      totalOrders: {
        value: totalOrders,
      },
      // New financial metrics
      totalOrderValue,
      totalOrderValueUSD,
      totalOrderValuePKR,
      advancePayments,
      advancePaymentsUSD,
      advancePaymentsPKR,
    };
  },
});

// Get recent orders for dashboard
export const getRecentOrders = query({
  args: {
    limit: v.optional(v.number())
  },
  returns: v.array(v.object({
    _id: v.id("orders"),
    _creationTime: v.number(),
    orderNumber: v.string(),
    clientId: v.id("clients"),
    status: v.string(),
    totalAmount: v.number(),
    currency: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    fiscalYear: v.optional(v.number()), // Add fiscalYear to return type
    freightCost: v.optional(v.number()),
    invoiceNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    timelineNotes: v.optional(v.string()),
    expectedDeliveryDate: v.optional(v.number()),
    salesRepId: v.optional(v.id("users")),
    orderCreationDate: v.optional(v.number()),
    factoryDepartureDate: v.optional(v.number()),
    estimatedDepartureDate: v.optional(v.number()),
    estimatedArrivalDate: v.optional(v.number()),
    shipmentMethod: v.optional(v.string()),
    shippingCompany: v.optional(v.string()),
    shippingOrderNumber: v.optional(v.string()),
    packingListId: v.optional(v.id("_storage")),
    proformaInvoiceId: v.optional(v.id("_storage")),
    commercialInvoiceId: v.optional(v.id("_storage")),
    client: v.union(v.null(), v.object({
      _id: v.id("clients"),
      name: v.union(v.string(), v.null()),
      type: v.string(),
    })),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    
    const orders = await ctx.db
      .query("orders")
      .collect();

    // Sort orders: first by fiscal year (descending), then by creation date (descending)
    orders.sort((a, b) => {
      // First sort by fiscal year (descending - latest year first)
      if (a.fiscalYear !== b.fiscalYear) {
        return (b.fiscalYear || 0) - (a.fiscalYear || 0);
      }
      // Then sort by creation date (descending - latest first)
      return b.createdAt - a.createdAt;
    });

    // Take the first 'limit' orders
    const limitedOrders = orders.slice(0, limit);

    // Get client details for each order
    const ordersWithClients = await Promise.all(
      limitedOrders.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        return {
          ...order,
          client: client ? {
            _id: client._id,
            name: client.name || null,
            type: client.type
          } : null
        };
      })
    );

    return ordersWithClients;
  },
});

// Get recent activity for dashboard
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number())
  },
  returns: v.array(v.object({
    id: v.string(),
    type: v.string(),
    message: v.string(),
    amount: v.optional(v.number()),
    timestamp: v.number(),
    color: v.string(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get recent orders
    const allOrders = await ctx.db.query("orders").collect();
    
    // Sort orders: first by fiscal year (descending), then by creation date (descending)
    allOrders.sort((a, b) => {
      if (a.fiscalYear !== b.fiscalYear) {
        return (b.fiscalYear || 0) - (a.fiscalYear || 0);
      }
      return b.createdAt - a.createdAt;
    });
    
    const recentOrders = allOrders.slice(0, 3);

    // Get recent payments (skip advances when building activity tied to invoices)
    const recentPayments = (await ctx.db
      .query("payments")
      .order("desc")
      .take(5))
      .filter(p => !!p.invoiceId)
      .slice(0, 3);

    // Get recent clients
    const recentClients = await ctx.db
      .query("clients")
      .order("desc")
      .take(2);

    const activities = [];

    // Add payment activities
    for (const payment of recentPayments) {
      const invoice = payment.invoiceId ? await ctx.db.get(payment.invoiceId) : null;
      const client = invoice ? await ctx.db.get(invoice.clientId) : null;
      
      if (client) {
        activities.push({
          id: `payment-${payment._id}`,
          type: "payment",
          message: `Payment received from ${client.name}`,
          amount: payment.amount,
          timestamp: payment.createdAt,
          color: "bg-green-500"
        });
      }
    }

    // Add order activities
    for (const order of recentOrders) {
      const client = await ctx.db.get(order.clientId);
      
      if (client) {
        activities.push({
          id: `order-${order._id}`,
          type: "order",
          message: `Order ${order.orderNumber} ${order.status === "in_production" ? "moved to production" : `status: ${order.status}`}`,
          timestamp: order.updatedAt,
          color: order.status === "in_production" ? "bg-blue-500" : "bg-purple-500"
        });
      }
    }

    // Add client activities
    for (const client of recentClients) {
      activities.push({
        id: `client-${client._id}`,
        type: "client",
        message: `New client ${client.name} added`,
        timestamp: client.createdAt,
        color: "bg-purple-500"
      });
    }

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});
