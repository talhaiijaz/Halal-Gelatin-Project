import { query } from "./_generated/server";
import { v } from "convex/values";

// Get dashboard statistics
export const getDashboardStats = query({
  args: {
    year: v.optional(v.number()),
  },
  returns: v.object({
    year: v.number(),
    numberOfOrders: v.number(),
    activeOrders: v.number(),
    totalQuantityKg: v.number(),
    averageOrderAmount: v.number(),
    totalRevenue: v.number(),
    totalPaid: v.number(),
    totalOutstanding: v.number(),
    totalRevenueUSD: v.number(),
    totalRevenuePKR: v.number(),
    totalPaidUSD: v.number(),
    totalPaidPKR: v.number(),
    totalOutstandingUSD: v.number(),
    totalOutstandingPKR: v.number(),
    outstandingByCurrency: v.record(v.string(), v.number()),
    overdueInvoices: v.number(),
    totalPaymentsReceived: v.number(),
    averagePaymentAmount: v.number(),
    paymentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const year = args.year || new Date().getFullYear();
    // Convert to fiscal year: July 1 to June 30
    const startOfYear = new Date(year, 6, 1).getTime(); // July 1
    const endOfYear = new Date(year + 1, 5, 30, 23, 59, 59, 999).getTime(); // June 30
    const now = Date.now();
    const endDate = Math.min(endOfYear, now);

    // Get all orders
    const allOrders = await ctx.db.query("orders").collect();
    const yearOrders = allOrders.filter(
      order => order.fiscalYear === year
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

    // Get invoices for payment statistics
    const invoices = await ctx.db.query("invoices").collect();
    const yearInvoices = invoices.filter(
      inv => {
        // Get the order for this invoice to check its fiscal year
        const order = allOrders.find(o => o._id === inv.orderId);
        return order && order.fiscalYear === year;
      }
    );

    const totalPaid = yearInvoices.reduce((sum, inv) => sum + inv.totalPaid, 0);
    const totalOutstanding = yearInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    
    // Get payment statistics for the year
    const payments = await ctx.db.query("payments").collect();
    const yearPayments = payments.filter(
      payment => {
        // Get the invoice for this payment, then get the order to check fiscal year
        const invoice = invoices.find(inv => inv._id === payment.invoiceId);
        if (!invoice) return false;
        const order = allOrders.find(o => o._id === invoice.orderId);
        return order && order.fiscalYear === year;
      }
    );
    
    // Get clients for currency classification
    const clients = await ctx.db.query("clients").collect();
    
    // Calculate revenue by currency using payments (with conversion for international)
    const totalRevenueUSD = yearPayments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "international" && p.convertedAmountUSD;
      })
      .reduce((sum, p) => sum + (p.convertedAmountUSD || 0), 0);
    
    const totalRevenuePKR = yearPayments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "local";
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Calculate paid amounts by currency using payments
    const totalPaidUSD = yearPayments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "international" && p.convertedAmountUSD;
      })
      .reduce((sum, p) => sum + (p.convertedAmountUSD || 0), 0);
    
    const totalPaidPKR = yearPayments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "local";
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Calculate outstanding by currency (using invoices - original currency until payment)
    const outstandingByCurrency: Record<string, number> = {};
    yearInvoices.forEach(invoice => {
      const currency = invoice.currency;
      if (invoice.outstandingBalance > 0) {
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + invoice.outstandingBalance;
      }
    });

    // For backward compatibility, also calculate USD and PKR totals
    const totalOutstandingUSD = outstandingByCurrency["USD"] || 0;
    const totalOutstandingPKR = outstandingByCurrency["PKR"] || 0;

    // No due/overdue concept in this system
    const overdueInvoices: any[] = [];

    const totalPaymentsReceived = yearPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const averagePaymentAmount = yearPayments.length > 0 
      ? totalPaymentsReceived / yearPayments.length 
      : 0;

    return {
      // This year's statistics
      year: year,
      numberOfOrders: yearOrders.length,
      activeOrders: yearOrders.filter(o => 
        ["pending", "confirmed", "in_production", "shipped"].includes(o.status)
      ).length,
      totalQuantityKg: Math.round(totalQuantity),
      averageOrderAmount,
      totalRevenue,
      totalPaid,
      totalOutstanding,
      totalRevenueUSD,
      totalRevenuePKR,
      totalPaidUSD,
      totalPaidPKR,
      totalOutstandingUSD,
      totalOutstandingPKR,
      outstandingByCurrency,
      overdueInvoices: overdueInvoices.length,
      // Payment statistics
      totalPaymentsReceived,
      averagePaymentAmount,
      paymentCount: yearPayments.length,
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
    // Convert to fiscal year: July 1 to June 30
    const startOfYear = new Date(year, 6, 1).getTime(); // July 1
    const endOfYear = new Date(year + 1, 5, 30, 23, 59, 59, 999).getTime(); // June 30

    // Get all orders for the year
    const orders = await ctx.db
      .query("orders")
      .filter(q => q.eq(q.field("fiscalYear"), year))
      .collect();

    // Get all payments for the year
    const allInvoices = await ctx.db.query("invoices").collect();
    const allOrders = await ctx.db.query("orders").collect();
    
    const payments = await ctx.db.query("payments").collect();
    const yearPayments = payments.filter(payment => {
      const invoice = allInvoices.find(inv => inv._id === payment.invoiceId);
      if (!invoice) return false;
      const order = allOrders.find(o => o._id === invoice.orderId);
      return order && order.fiscalYear === year;
    });

    // Group by month (fiscal year: July to June)
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const fiscalMonth = i + 6; // July = 0, August = 1, ..., June = 11
      const monthYear = fiscalMonth >= 12 ? year + 1 : year;
      const monthIndex = fiscalMonth >= 12 ? fiscalMonth - 12 : fiscalMonth;
      
      const monthStart = new Date(monthYear, monthIndex, 1).getTime();
      const monthEnd = new Date(monthYear, monthIndex + 1, 0, 23, 59, 59).getTime();
      
      // Use explicit orderCreationDate when available; fall back to createdAt
      // This ensures backdated orders (entered later) are counted in the correct month
      const monthOrders = orders.filter(order => {
        const orderTimestamp = (order as any).orderCreationDate ?? order.createdAt;
        return orderTimestamp >= monthStart && orderTimestamp <= monthEnd;
      });

      const monthPayments = yearPayments.filter(
        payment => payment.paymentDate >= monthStart && payment.paymentDate <= monthEnd
      );

      const activeOrders = monthOrders.filter(o => o.status !== "cancelled");
      const revenue = activeOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      const paymentsReceived = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);

      return {
        month: new Date(monthYear, monthIndex, 1).toLocaleDateString("en-US", { month: "short" }),
        monthIndex: i,
        orders: monthOrders.length,
        activeOrders: activeOrders.length,
        revenue,
        paymentsReceived,
        cancelled: monthOrders.filter(o => o.status === "cancelled").length,
      };
    });

    return monthlyStats;
  },
});

// Get revenue by customer type
export const getRevenueByCustomerType = query({
  args: {
    fiscalYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all clients
    const clients = await ctx.db.query("clients").collect();
    const localClients = clients.filter(c => c.type === "local");
    const internationalClients = clients.filter(c => c.type === "international");

    // Get orders filtered by fiscal year (and not cancelled)
    let orders = await ctx.db.query("orders").collect();
    orders = orders.filter(o => o.status !== "cancelled");
    if (args.fiscalYear) {
      orders = orders.filter(o => o.fiscalYear === args.fiscalYear);
    }

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

// Get invoice statistics
export const getInvoiceStats = query({
  args: {
    fiscalYear: v.optional(v.number()), // Add fiscal year filter
  },
  returns: v.object({
    totalOutstanding: v.number(),
    totalPaid: v.number(),
    overdueCount: v.number(),
    totalCount: v.number(),
    totalOutstandingUSD: v.number(),
    totalOutstandingPKR: v.number(),
    totalPaidUSD: v.number(),
    totalPaidPKR: v.number(),
    outstandingByCurrency: v.record(v.string(), v.number()),
    paidByCurrency: v.record(v.string(), v.number()),
  }),
  handler: async (ctx, args) => {
    let invoices = await ctx.db.query("invoices").collect();
    const now = Date.now();

    // Filter by fiscal year if provided
    if (args.fiscalYear) {
      const allOrders = await ctx.db.query("orders").collect();
      invoices = invoices.filter(invoice => {
        const order = allOrders.find(o => o._id === invoice.orderId);
        return order && order.fiscalYear === args.fiscalYear;
      });
    }

    // Calculate outstanding by currency
    const outstandingByCurrency: Record<string, number> = {};
    invoices.forEach(invoice => {
      const currency = invoice.currency;
      if (invoice.outstandingBalance > 0) {
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + invoice.outstandingBalance;
      }
    });

    // Get payments and clients for accurate paid amounts
    const payments = await ctx.db.query("payments").collect();
    const clients = await ctx.db.query("clients").collect();
    
    // Calculate paid amounts by currency using actual payments (with conversion for international)
    const totalPaidUSD = payments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "international" && p.convertedAmountUSD;
      })
      .reduce((sum, p) => sum + (p.convertedAmountUSD || 0), 0);
    
    const totalPaidPKR = payments
      .filter(p => {
        const client = clients.find(c => c._id === p.clientId);
        return client?.type === "local";
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    const totalPaid = totalPaidUSD + totalPaidPKR; // Use converted amounts
    const totalOutstandingUSD = invoices.filter(i => i.currency === "USD").reduce((s, i) => s + i.outstandingBalance, 0);
    const totalOutstandingPKR = invoices.filter(i => i.currency === "PKR").reduce((s, i) => s + i.outstandingBalance, 0);
    const overdueCount = 0;
    const totalCount = invoices.length;

    // Calculate paid by currency for display (only show USD and PKR for paid amounts)
    const paidByCurrency: Record<string, number> = {};
    if (totalPaidUSD > 0) {
      paidByCurrency["USD"] = totalPaidUSD;
    }
    if (totalPaidPKR > 0) {
      paidByCurrency["PKR"] = totalPaidPKR;
    }

    return {
      totalOutstanding,
      totalPaid,
      overdueCount,
      totalCount,
      totalOutstandingUSD,
      totalOutstandingPKR,
      totalPaidUSD,
      totalPaidPKR,
      outstandingByCurrency,
      paidByCurrency,
    };
  },
});

// Get top customers by revenue
export const getTopCustomers = query({
  args: {
    limit: v.optional(v.number()),
    fiscalYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    // Get all clients
    const clients = await ctx.db.query("clients").collect();

    // Get orders filtered by fiscal year (and not cancelled)
    let orders = await ctx.db.query("orders").collect();
    orders = orders.filter(o => o.status !== "cancelled");
    if (args.fiscalYear) {
      orders = orders.filter(o => o.fiscalYear === args.fiscalYear);
    }

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

// Get cash flow analysis
export const getCashFlowAnalysis = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Default to current fiscal year if no dates provided
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const fiscalYear = currentMonth >= 6 ? currentYear : currentYear - 1;
    const startDate = args.startDate || new Date(fiscalYear, 6, 1).getTime(); // July 1
    const endDate = args.endDate || Date.now();

    // Get invoices in date range
    const invoices = await ctx.db.query("invoices").collect();
    const periodInvoices = invoices.filter(
      inv => inv.issueDate >= startDate && inv.issueDate <= endDate
    );

    // Get payments in date range
    const payments = await ctx.db.query("payments").collect();
    const periodPayments = payments.filter(
      payment => payment.paymentDate >= startDate && payment.paymentDate <= endDate
    );

    // Calculate cash flow metrics
    const totalInvoiced = periodInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalReceived = periodPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const outstandingReceivables = periodInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);

    // Calculate payment methods breakdown
    const paymentMethods = {
      bank_transfer: 0,
      check: 0,
      cash: 0,
      credit_card: 0,
      other: 0,
    };

    periodPayments.forEach(payment => {
      if (payment.method in paymentMethods) {
        paymentMethods[payment.method as keyof typeof paymentMethods] += payment.amount;
      }
    });

    return {
      totalInvoiced,
      totalReceived,
      outstandingReceivables,
      cashFlow: totalReceived - totalInvoiced,
      paymentMethods,
      invoiceCount: periodInvoices.length,
      paymentCount: periodPayments.length,
      averageInvoiceAmount: periodInvoices.length > 0 ? totalInvoiced / periodInvoices.length : 0,
      averagePaymentAmount: periodPayments.length > 0 ? totalReceived / periodPayments.length : 0,
    };
  },
});

// Get overdue invoices summary
export const getOverdueInvoicesSummary = query({
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    const now = Date.now();

    const overdueInvoices = invoices.filter(inv => 
      inv.outstandingBalance > 0 && inv.dueDate < now
    );

    const overdueSummary = {
      count: overdueInvoices.length,
      totalAmount: overdueInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0),
      averageDaysOverdue: 0,
      byAge: {
        days30to60: { count: 0, amount: 0 },
        days61to90: { count: 0, amount: 0 },
        over90: { count: 0, amount: 0 },
      },
    };

    let totalDaysOverdue = 0;
    overdueInvoices.forEach(invoice => {
      const daysOverdue = Math.floor((now - invoice.dueDate) / (1000 * 60 * 60 * 24));
      totalDaysOverdue += daysOverdue;

      if (daysOverdue <= 60) {
        overdueSummary.byAge.days30to60.count++;
        overdueSummary.byAge.days30to60.amount += invoice.outstandingBalance;
      } else if (daysOverdue <= 90) {
        overdueSummary.byAge.days61to90.count++;
        overdueSummary.byAge.days61to90.amount += invoice.outstandingBalance;
      } else {
        overdueSummary.byAge.over90.count++;
        overdueSummary.byAge.over90.amount += invoice.outstandingBalance;
      }
    });

    if (overdueInvoices.length > 0) {
      overdueSummary.averageDaysOverdue = Math.round(totalDaysOverdue / overdueInvoices.length);
    }

    return overdueSummary;
  },
});

// Get payment trends
export const getPaymentTrends = query({
  args: {
    months: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const months = args.months || 12;
    const endDate = Date.now();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startTimestamp = startDate.getTime();

    const payments = await ctx.db.query("payments").collect();
    const periodPayments = payments.filter(
      payment => payment.paymentDate >= startTimestamp && payment.paymentDate <= endDate
    );

    // Group by month
    const monthlyPayments = Array.from({ length: months }, (_, i) => {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - months + i + 1);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      const monthPayments = periodPayments.filter(
        payment => payment.paymentDate >= monthStart.getTime() && payment.paymentDate <= monthEnd.getTime()
      );

      return {
        month: monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        amount: monthPayments.reduce((sum, payment) => sum + payment.amount, 0),
        count: monthPayments.length,
      };
    });

    return monthlyPayments;
  },
});

// Get finance statistics for reports
export const getFinanceStats = query({
  args: {},
  handler: async (ctx, args) => {
    const invoices = await ctx.db.query("invoices").collect();
    const orders = await ctx.db.query("orders").collect();
    const payments = await ctx.db.query("payments").collect();
    
    const totalInvoices = invoices.length;
    const totalOrders = orders.length;
    const totalPayments = payments.length;
    
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.totalPaid, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    
    return {
      totalInvoices,
      totalOrders,
      totalPayments,
      totalAmount,
      totalPaid,
      totalOutstanding,
    };
  },
});