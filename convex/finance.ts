import { query } from "./_generated/server";
import { v } from "convex/values";


// Get dashboard statistics
export const getDashboardStats = query({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    
    

    const currentYear = args.year || new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59).getTime();
    const now = Date.now();
    const endDate = Math.min(endOfYear, now);

    // Get all orders
    const allOrders = await ctx.db.query("orders").collect();
    const yearOrders = allOrders.filter(
      order => order.createdAt >= startOfYear && order.createdAt <= endDate
    );

    // Get all order items for quantity calculation
    const orderItemsPromises = yearOrders.map(order =>
      ctx.db
        .query("orderItems")
        .withIndex("by_order", q => q.eq("orderId", order._id))
        .collect()
    );
    const orderItemsGroups = await Promise.all(orderItemsPromises);
    
    // Calculate total quantity
    const totalQuantity = orderItemsGroups.reduce((sum, items) => 
      sum + items.reduce((itemSum, item) => itemSum + item.quantityKg, 0), 0
    );

    // Calculate total revenue (excluding cancelled orders)
    const activeYearOrders = yearOrders.filter(o => o.status !== "cancelled");
    const totalRevenue = activeYearOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate average order amount
    const averageOrderAmount = activeYearOrders.length > 0 
      ? totalRevenue / activeYearOrders.length 
      : 0;

    // Get all-time statistics
    const allActiveOrders = allOrders.filter(o => o.status !== "cancelled");
    const allTimeRevenue = allActiveOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    // Get all-time quantity
    const allOrderItemsPromises = allActiveOrders.map(order =>
      ctx.db
        .query("orderItems")
        .withIndex("by_order", q => q.eq("orderId", order._id))
        .collect()
    );
    const allOrderItemsGroups = await Promise.all(allOrderItemsPromises);
    const allTimeQuantity = allOrderItemsGroups.reduce((sum, items) => 
      sum + items.reduce((itemSum, item) => itemSum + item.quantityKg, 0), 0
    );

    // Get invoices for payment statistics
    const invoices = await ctx.db.query("invoices").collect();
    const yearInvoices = invoices.filter(
      inv => inv.createdAt >= startOfYear && inv.createdAt <= endDate
    );

    const totalPaid = yearInvoices.reduce((sum, inv) => sum + inv.totalPaid, 0);
    const totalOutstanding = yearInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);

    // Count overdue invoices
    const overdueInvoices = yearInvoices.filter(
      inv => inv.status === "overdue" || (inv.dueDate < now && inv.status !== "paid")
    );

    return {
      // This year's statistics
      year: currentYear,
      numberOfOrders: yearOrders.length,
      activeOrders: yearOrders.filter(o => 
        ["pending", "confirmed", "in_production", "shipped"].includes(o.status)
      ).length,
      totalQuantityKg: Math.round(totalQuantity),
      averageOrderAmount,
      totalRevenue,
      totalPaid,
      totalOutstanding,
      overdueInvoices: overdueInvoices.length,
      
      // All-time statistics
      allTime: {
        totalOrders: allOrders.length,
        totalRevenue: allTimeRevenue,
        totalQuantityKg: Math.round(allTimeQuantity),
        averageOrderValue: allActiveOrders.length > 0 
          ? allTimeRevenue / allActiveOrders.length 
          : 0,
      }
    };
  },
});

// Get monthly order statistics for charts
export const getMonthlyOrderStats = query({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    
    

    const year = args.year || new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59).getTime();

    // Get all orders for the year
    const orders = await ctx.db
      .query("orders")
      .filter(q => 
        q.and(
          q.gte(q.field("createdAt"), startOfYear),
          q.lte(q.field("createdAt"), endOfYear)
        )
      )
      .collect();

    // Group by month
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const monthStart = new Date(year, i, 1).getTime();
      const monthEnd = new Date(year, i + 1, 0, 23, 59, 59).getTime();
      
      const monthOrders = orders.filter(
        order => order.createdAt >= monthStart && order.createdAt <= monthEnd
      );

      const activeOrders = monthOrders.filter(o => o.status !== "cancelled");
      const revenue = activeOrders.reduce((sum, order) => sum + order.totalAmount, 0);

      return {
        month: new Date(year, i, 1).toLocaleDateString("en-US", { month: "short" }),
        monthIndex: i,
        orders: monthOrders.length,
        activeOrders: activeOrders.length,
        revenue,
        cancelled: monthOrders.filter(o => o.status === "cancelled").length,
      };
    });

    return monthlyStats;
  },
});

// Get revenue by customer type
export const getRevenueByCustomerType = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    
    

    const startDate = args.startDate || new Date(new Date().getFullYear(), 0, 1).getTime();
    const endDate = args.endDate || Date.now();

    // Get all clients
    const clients = await ctx.db.query("clients").collect();
    const localClients = clients.filter(c => c.type === "local");
    const internationalClients = clients.filter(c => c.type === "international");

    // Get orders in date range
    const orders = await ctx.db
      .query("orders")
      .filter(q => 
        q.and(
          q.gte(q.field("createdAt"), startDate),
          q.lte(q.field("createdAt"), endDate),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .collect();

    // Calculate revenue by type
    const localRevenue = orders
      .filter(o => localClients.some(c => c._id === o.clientId))
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const internationalRevenue = orders
      .filter(o => internationalClients.some(c => c._id === o.clientId))
      .reduce((sum, order) => sum + order.totalAmount, 0);

    return {
      local: {
        revenue: localRevenue,
        orderCount: orders.filter(o => localClients.some(c => c._id === o.clientId)).length,
        clientCount: localClients.length,
      },
      international: {
        revenue: internationalRevenue,
        orderCount: orders.filter(o => internationalClients.some(c => c._id === o.clientId)).length,
        clientCount: internationalClients.length,
      },
      total: {
        revenue: localRevenue + internationalRevenue,
        orderCount: orders.length,
        clientCount: clients.length,
      }
    };
  },
});

// Get top customers by revenue
export const getTopCustomers = query({
  args: {
    limit: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    
    

    const limit = args.limit || 5;
    const startDate = args.startDate || new Date(new Date().getFullYear(), 0, 1).getTime();
    const endDate = args.endDate || Date.now();

    // Get all clients
    const clients = await ctx.db.query("clients").collect();

    // Get orders in date range
    const orders = await ctx.db
      .query("orders")
      .filter(q => 
        q.and(
          q.gte(q.field("createdAt"), startDate),
          q.lte(q.field("createdAt"), endDate),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .collect();

    // Calculate revenue per customer
    const customerRevenue = clients.map(client => {
      const clientOrders = orders.filter(o => o.clientId === client._id);
      const revenue = clientOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      
      return {
        clientId: client._id,
        name: client.name,
        type: client.type,
        city: client.city,
        country: client.country,
        revenue,
        orderCount: clientOrders.length,
      };
    });

    // Sort by revenue and return top customers
    return customerRevenue
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .filter(c => c.revenue > 0);
  },
});