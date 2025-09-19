import { query, mutation } from "./_generated/server";
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
  args: {
    fiscalYear: v.optional(v.number()),
  },
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
    // Pipeline value (pending + in_production)
    currentPendingOrdersValue: v.number(),
    // Back-compat aliases
    totalOrderValue: v.number(),
    totalOrderValueUSD: v.number(),
    totalOrderValuePKR: v.number(),
    advancePayments: v.number(),
    advancePaymentsUSD: v.number(),
    advancePaymentsPKR: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get all data
    const clients = await ctx.db.query("clients").collect();
    let orders = await ctx.db.query("orders").collect();
    const invoices = await ctx.db.query("invoices").collect();
    const payments = await ctx.db.query("payments").collect();

    // Filter orders by fiscal year if specified
    if (args.fiscalYear) {
      orders = orders.filter(order => order.fiscalYear === args.fiscalYear);
    }

    // Calculate client stats
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === "active").length;
    const localClients = clients.filter(c => c.type === "local").length;
    const internationalClients = clients.filter(c => c.type === "international").length;

    // Calculate order stats
    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => 
      ["pending", "in_production", "shipped"].includes(o.status)
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

    // For rolling metrics (pending orders, advance payments, receivables), use all invoices
    // For fiscal year metrics (total revenue, total orders), filter by fiscal year
    let fiscalYearInvoices = invoices;
    let fiscalYearPayments = payments;
    
    if (args.fiscalYear) {
      fiscalYearInvoices = invoices.filter(inv => {
        const order = orders.find(o => o._id === inv.orderId);
        return order && order.fiscalYear === args.fiscalYear;
      });
      
      fiscalYearPayments = payments.filter(payment => {
        const invoice = fiscalYearInvoices.find(inv => inv._id === payment.invoiceId);
        return invoice !== undefined;
      });
    }
    
    // Use all invoices for rolling metrics (pending orders, advance payments, receivables)
    const rollingInvoices = invoices;
    const rollingPayments = payments;

    // Calculate financial stats using fiscal year invoices for totals
    const totalRevenue = fiscalYearInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = fiscalYearInvoices.reduce((sum, inv) => sum + inv.totalPaid, 0);
    
    // Calculate outstanding only for shipped/delivered orders (ROLLING - use all invoices)
    const shippedOrDeliveredInvoices = rollingInvoices.filter(inv => {
      const order = orders.find(o => o._id === inv.orderId);
      return order && (order.status === "shipped" || order.status === "delivered");
    });
    const outstandingAmount = shippedOrDeliveredInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    
    // Calculate revenue by currency using payments; group by realized (bank) currency when converted
    const paidByCurrency: Record<string, number> = {};
    for (const p of fiscalYearPayments) {
      let cur = p.currency;
      let amt = p.amount;
      if (p.bankAccountId) {
        const bank = await ctx.db.get(p.bankAccountId);
        if (bank && bank.currency && bank.currency !== p.currency && (p as any).convertedAmountUSD) {
          cur = bank.currency;
          amt = (p as any).convertedAmountUSD as number;
        }
      }
      paidByCurrency[cur] = (paidByCurrency[cur] || 0) + amt;
    }
    const revenueUSD = paidByCurrency["USD"] || 0;
    const revenuePKR = paidByCurrency["PKR"] || 0;
    
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

    // Current fiscal year data - use factoryDepartureDate if available, fallback to orderCreationDate, then createdAt
    const currentYearOrders = orders.filter(o => {
      const orderDate = o.factoryDepartureDate || o.orderCreationDate || o.createdAt;
      return orderDate >= startOfYear && orderDate <= endOfYear;
    });
    const currentYearInvoices = invoices.filter(i => 
      i.createdAt >= startOfYear && i.createdAt <= endOfYear
    );
    const currentYearClients = clients.filter(c => 
      c.createdAt >= startOfYear && c.createdAt <= endOfYear
    );

    // Previous fiscal year data for comparison - use factoryDepartureDate if available, fallback to orderCreationDate, then createdAt
    const prevYearOrders = orders.filter(o => {
      const orderDate = o.factoryDepartureDate || o.orderCreationDate || o.createdAt;
      return orderDate >= startOfPrevYear && orderDate <= endOfPrevYear;
    });
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
    // Pipeline Order Value - sum of pending + in_production
    const pipelineOrders = orders.filter(o => ["pending", "in_production"].includes(o.status));
    const currentPendingOrdersValue = pipelineOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrderValueUSD = pipelineOrders
      .filter(o => {
        const client = clients.find(c => c._id === o.clientId);
        return client?.type === "international";
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrderValuePKR = pipelineOrders
      .filter(o => {
        const client = clients.find(c => c._id === o.clientId);
        return client?.type === "local";
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // 2. Advance Payments - payments for orders not yet shipped (pending/in_production) (ROLLING)
    const advancePaymentInvoices = rollingInvoices.filter(inv => {
      const order = orders.find(o => o._id === inv.orderId);
      return order && ["pending", "in_production"].includes(order.status);
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
      // Pipeline metrics (and back-compat aliases)
      currentPendingOrdersValue,
      totalOrderValue: currentPendingOrdersValue,
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

    // Sort orders: first by fiscal year (descending), then by factory departure date (descending)
    orders.sort((a, b) => {
      // First sort by fiscal year (descending - latest year first)
      if (a.fiscalYear !== b.fiscalYear) {
        return (b.fiscalYear || 0) - (a.fiscalYear || 0);
      }
      // Then sort by factory departure date (ascending - nearest first)
      // Use factoryDepartureDate if available, fallback to orderCreationDate, then createdAt
      const dateA = a.factoryDepartureDate || a.orderCreationDate || a.createdAt;
      const dateB = b.factoryDepartureDate || b.orderCreationDate || b.createdAt;
      return dateA - dateB;
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
    
    // Sort orders: first by fiscal year (descending), then by factory departure date (ascending - nearest first)
    allOrders.sort((a, b) => {
      if (a.fiscalYear !== b.fiscalYear) {
        return (b.fiscalYear || 0) - (a.fiscalYear || 0);
      }
      // Use factoryDepartureDate if available, fallback to orderCreationDate, then createdAt
      const dateA = a.factoryDepartureDate || a.orderCreationDate || a.createdAt;
      const dateB = b.factoryDepartureDate || b.orderCreationDate || b.createdAt;
      return dateA - dateB;
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

// Get orders by status for homepage
export const getOrdersByStatus = query({
  args: {
    limit: v.optional(v.number()),
    // Removed fiscalYear filter - orders are rolling
  },
  returns: v.object({
    pendingOrders: v.array(v.object({
      _id: v.id("orders"),
      invoiceNumber: v.string(),
      clientName: v.union(v.string(), v.null()),
      totalQuantity: v.number(),
      currency: v.string(),
      totalAmount: v.number(),
      createdAt: v.number(),
      deliveryDate: v.optional(v.number()),
      factoryDepartureDate: v.optional(v.number()),
    })),
    inProductionOrders: v.array(v.object({
      _id: v.id("orders"),
      invoiceNumber: v.string(),
      clientName: v.union(v.string(), v.null()),
      totalQuantity: v.number(),
      currency: v.string(),
      totalAmount: v.number(),
      createdAt: v.number(),
      deliveryDate: v.optional(v.number()),
      factoryDepartureDate: v.optional(v.number()),
    })),
    shippedOrders: v.array(v.object({
      _id: v.id("orders"),
      invoiceNumber: v.string(),
      clientName: v.union(v.string(), v.null()),
      totalQuantity: v.number(),
      currency: v.string(),
      totalAmount: v.number(),
      createdAt: v.number(),
      deliveryDate: v.optional(v.number()),
      factoryDepartureDate: v.optional(v.number()),
    })),
    deliveredOrders: v.array(v.object({
      _id: v.id("orders"),
      invoiceNumber: v.string(),
      clientName: v.union(v.string(), v.null()),
      totalQuantity: v.number(),
      currency: v.string(),
      totalAmount: v.number(),
      createdAt: v.number(),
      deliveryDate: v.optional(v.number()),
      factoryDepartureDate: v.optional(v.number()),
    })),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    
    // Helper function to process orders
    const processOrders = async (orders: any[]) => {
      return Promise.all(
        orders.map(async (order) => {
          const client = await ctx.db.get(order.clientId);
          const orderItems = await ctx.db
            .query("orderItems")
            .withIndex("by_order", q => q.eq("orderId", order._id))
            .collect();
          
          const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantityKg, 0);
          
          return {
            _id: order._id,
            invoiceNumber: order.invoiceNumber,
            clientName: (client as any)?.name || "Unknown Client",
            totalQuantity,
            currency: order.currency,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            ...(order.deliveryDate && { deliveryDate: order.deliveryDate }),
            ...(order.factoryDepartureDate && { factoryDepartureDate: order.factoryDepartureDate }),
          };
        })
      );
    };

    // Orders are rolling - no fiscal year filtering

    // Get orders by status, sorted by factory departure date (nearest first)
    const [pendingOrders, inProductionOrders, shippedOrders, deliveredOrders] = await Promise.all([
      ctx.db.query("orders").withIndex("by_status", q => q.eq("status", "pending")).collect().then(orders => 
        orders.sort((a, b) => {
          const dateA = a.factoryDepartureDate || a.orderCreationDate || a.createdAt;
          const dateB = b.factoryDepartureDate || b.orderCreationDate || b.createdAt;
          return dateA - dateB;
        }).slice(0, limit)
      ),
      ctx.db.query("orders").withIndex("by_status", q => q.eq("status", "in_production")).collect().then(orders => 
        orders.sort((a, b) => {
          const dateA = a.factoryDepartureDate || a.orderCreationDate || a.createdAt;
          const dateB = b.factoryDepartureDate || b.orderCreationDate || b.createdAt;
          return dateA - dateB;
        }).slice(0, limit)
      ),
      ctx.db.query("orders").withIndex("by_status", q => q.eq("status", "shipped")).collect().then(orders => 
        orders.sort((a, b) => {
          const dateA = a.factoryDepartureDate || a.orderCreationDate || a.createdAt;
          const dateB = b.factoryDepartureDate || b.orderCreationDate || b.createdAt;
          return dateA - dateB;
        }).slice(0, limit)
      ),
      ctx.db.query("orders").withIndex("by_status", q => q.eq("status", "delivered")).collect().then(orders => 
        orders.sort((a, b) => {
          const dateA = a.factoryDepartureDate || a.orderCreationDate || a.createdAt;
          const dateB = b.factoryDepartureDate || b.orderCreationDate || b.createdAt;
          return dateA - dateB;
        }).slice(0, limit)
      ),
    ]);

    // Process all orders
    const [pendingOrdersWithDetails, inProductionOrdersWithDetails, shippedOrdersWithDetails, deliveredOrdersWithDetails] = await Promise.all([
      processOrders(pendingOrders),
      processOrders(inProductionOrders),
      processOrders(shippedOrders),
      processOrders(deliveredOrders),
    ]);

    return {
      pendingOrders: pendingOrdersWithDetails,
      inProductionOrders: inProductionOrdersWithDetails,
      shippedOrders: shippedOrdersWithDetails,
      deliveredOrders: deliveredOrdersWithDetails,
    };
  },
});

// Detailed receivables: outstanding invoices for shipped/delivered orders
export const getReceivablesDetails = query({
  args: {
    fiscalYear: v.optional(v.number()),
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
  returns: v.array(
    v.object({
      invoiceId: v.id("invoices"),
      invoiceNumber: v.union(v.string(), v.null()),
      clientId: v.id("clients"),
      clientName: v.union(v.string(), v.null()),
      orderId: v.id("orders"),
      orderNumber: v.string(),
      currency: v.string(),
      outstandingBalance: v.number(),
      issueDate: v.number(),
      dueDate: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const clients = await ctx.db.query("clients").collect();
    const orders = await ctx.db.query("orders").collect();
    const invoices = await ctx.db.query("invoices").collect();

    // Receivables are rolling - no fiscal year filtering
    // Only shipped/delivered orders and positive outstanding
    const result = [] as Array<{
      invoiceId: any; invoiceNumber: string | null; clientId: any; clientName: string | null; orderId: any; orderNumber: string; currency: string; outstandingBalance: number; issueDate: number; dueDate: number;
    }>;

    for (const inv of invoices) {
      const order = orders.find((o) => o._id === inv.orderId);
      if (!order) continue;
      if (!(order.status === "shipped" || order.status === "delivered")) continue;
      if (inv.outstandingBalance <= 0) continue;
      const client = clients.find((c) => c._id === inv.clientId);
      if (args.type && client?.type !== args.type) continue;
      result.push({
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber || null,
        clientId: inv.clientId,
        clientName: (client as any)?.name || null,
        orderId: inv.orderId,
        orderNumber: (order as any).orderNumber,
        currency: inv.currency,
        outstandingBalance: inv.outstandingBalance,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
      });
    }
    // Sort by due date descending (most overdue first)
    return result.sort((a, b) => b.dueDate - a.dueDate);
  },
});

// Detailed advance payments: invoices in pending/in_production with totalPaid > 0
export const getAdvancePaymentsDetails = query({
  args: {
    fiscalYear: v.optional(v.number()),
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
  returns: v.array(
    v.object({
      invoiceId: v.id("invoices"),
      invoiceNumber: v.union(v.string(), v.null()),
      clientId: v.id("clients"),
      clientName: v.union(v.string(), v.null()),
      orderId: v.id("orders"),
      orderNumber: v.string(),
      currency: v.string(),
      advancePaid: v.number(),
      issueDate: v.number(),
      dueDate: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const clients = await ctx.db.query("clients").collect();
    const orders = await ctx.db.query("orders").collect();
    const invoices = await ctx.db.query("invoices").collect();

    // Advance payments are rolling - no fiscal year filtering

    const result = [] as Array<{
      invoiceId: any; invoiceNumber: string | null; clientId: any; clientName: string | null; orderId: any; orderNumber: string; currency: string; advancePaid: number; issueDate: number; dueDate: number;
    }>;
    for (const inv of invoices) {
      const order = orders.find((o) => o._id === inv.orderId);
      if (!order) continue;
      if (!(order.status === "pending" || order.status === "in_production")) continue;
      if (inv.totalPaid <= 0) continue;
      const client = clients.find((c) => c._id === inv.clientId);
      if (args.type && client?.type !== args.type) continue;
      result.push({
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber || null,
        clientId: inv.clientId,
        clientName: (client as any)?.name || null,
        orderId: inv.orderId,
        orderNumber: (order as any).orderNumber,
        currency: inv.currency,
        advancePaid: inv.totalPaid,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
      });
    }
    // Sort by issue date desc (latest first)
    return result.sort((a, b) => b.issueDate - a.issueDate);
  },
});

// Detailed revenue: payments filtered by type and fiscal year
export const getRevenueDetails = query({
  args: {
    fiscalYear: v.optional(v.number()),
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
  returns: v.array(
    v.object({
      paymentId: v.id("payments"),
      clientId: v.id("clients"),
      clientName: v.union(v.string(), v.null()),
      amount: v.number(),
      currency: v.string(),
      paymentDate: v.number(),
      method: v.string(),
      reference: v.string(),
      invoiceId: v.union(v.id("invoices"), v.null()),
      invoiceNumber: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const clients = await ctx.db.query("clients").collect();
    const orders = await ctx.db.query("orders").collect();
    const invoices = await ctx.db.query("invoices").collect();
    let payments = await ctx.db.query("payments").order("desc").collect();

    if (args.type) {
      payments = payments.filter((p) => {
        const client = clients.find((c) => c._id === p.clientId);
        return client?.type === args.type;
      });
    }

    if (args.fiscalYear) {
      payments = payments.filter((p) => {
        if (!p.invoiceId) return false; // only count invoice-linked payments for revenue breakdown
        const inv = invoices.find((i) => i._id === p.invoiceId);
        if (!inv) return false;
        const order = orders.find((o) => o._id === inv.orderId);
        return order && order.fiscalYear === args.fiscalYear;
      });
    }

    const result = payments.map((p) => {
      const client = clients.find((c) => c._id === p.clientId);
      const invoice = p.invoiceId ? invoices.find((i) => i._id === p.invoiceId) : null;
      return {
        paymentId: p._id,
        clientId: p.clientId,
        clientName: (client as any)?.name || null,
        amount: p.amount,
        currency: p.currency,
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
        invoiceId: (invoice && invoice._id) || null,
        invoiceNumber: (invoice && invoice.invoiceNumber) || null,
      };
    });
    return result;
  },
});

// Detailed pending orders: pending and in_production
export const getPendingOrdersDetails = query({
  args: {
    fiscalYear: v.optional(v.number()),
    type: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
  returns: v.array(
    v.object({
      orderId: v.id("orders"),
      orderNumber: v.string(),
      invoiceNumber: v.union(v.string(), v.null()),
      clientId: v.id("clients"),
      clientName: v.union(v.string(), v.null()),
      status: v.string(),
      totalAmount: v.number(),
      currency: v.string(),
      totalQuantity: v.number(),
      factoryDepartureDate: v.union(v.number(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const clients = await ctx.db.query("clients").collect();
    let orders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const inProd = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "in_production"))
      .collect();
    orders = orders.concat(inProd);

    if (args.type) {
      orders = orders.filter((o) => {
        const client = clients.find((c) => c._id === o.clientId);
        return client?.type === args.type;
      });
    }
    // Pending orders are rolling - no fiscal year filtering

    const result = [] as Array<{ orderId: any; orderNumber: string; invoiceNumber: string | null; clientId: any; clientName: string | null; status: string; totalAmount: number; currency: string; totalQuantity: number; factoryDepartureDate: number | null }>;

    for (const order of orders) {
      const client = clients.find((c) => c._id === order.clientId);
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      const totalQuantity = items.reduce((sum, it) => sum + it.quantityKg, 0);
      result.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber || null,
        clientId: order.clientId,
        clientName: (client as any)?.name || null,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        totalQuantity,
        factoryDepartureDate: order.factoryDepartureDate || null,
      });
    }

    // Sort by nearest factory departure date
    return result.sort((a, b) => (a.factoryDepartureDate || 0) - (b.factoryDepartureDate || 0));
  },
});
