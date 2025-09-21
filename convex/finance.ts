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
    totalRevenue: v.number(),
    totalPaid: v.number(),
    totalOutstanding: v.number(),
    totalRevenueUSD: v.number(),
    totalRevenuePKR: v.number(),
    totalRevenueEUR: v.number(),
    totalRevenueAED: v.number(),
    totalPaidUSD: v.number(),
    totalPaidPKR: v.number(),
    totalPaidEUR: v.number(),
    totalPaidAED: v.number(),
    totalOutstandingUSD: v.number(),
    totalOutstandingPKR: v.number(),
    totalOutstandingEUR: v.number(),
    totalOutstandingAED: v.number(),
    outstandingByCurrency: v.record(v.string(), v.number()),
    revenueByCurrency: v.record(v.string(), v.number()),
    paidByCurrency: v.record(v.string(), v.number()),
    advancePaymentsUSD: v.number(),
    advancePaymentsPKR: v.number(),
    advancePaymentsEUR: v.number(),
    advancePaymentsAED: v.number(),
    overdueInvoices: v.number(),
    totalPaymentsReceived: v.number(),
    averagePaymentAmount: v.number(),
    paymentCount: v.number(),
    // Pipeline order value by currency (pending + in_production)
    pendingOrdersValueUSD: v.number(),
    pendingOrdersValuePKR: v.number(),
    pendingOrdersValueEUR: v.number(),
    pendingOrdersValueAED: v.number(),
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
    
    // Calculate outstanding only for shipped/delivered orders - ROLLING (all invoices)
    const shippedOrDeliveredInvoices = invoices.filter(inv => {
      const order = allOrders.find(o => o._id === inv.orderId);
      return order && (order.status === "shipped" || order.status === "delivered");
    });
    const totalOutstanding = shippedOrDeliveredInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    
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
    
    // Calculate revenue by currency using orders (not payments)
    const revenueByCurrency: Record<string, number> = {};
    const paidByCurrency: Record<string, number> = {};
    
    // Revenue comes from orders
    activeYearOrders.forEach(order => {
      const currency = order.currency;
      revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + order.totalAmount;
    });
    
    // Payments come from actual payments (respect bank currency if conversion occurred)
    for (const payment of yearPayments) {
      let bucketCurrency = payment.currency;
      let bucketAmount = payment.amount;
      if (payment.bankAccountId) {
        const bank = await ctx.db.get(payment.bankAccountId);
        if (bank && bank.currency && bank.currency !== payment.currency && (payment as any).convertedAmountUSD) {
          bucketCurrency = bank.currency;
          bucketAmount = (payment as any).convertedAmountUSD as number;
        }
      }
      paidByCurrency[bucketCurrency] = (paidByCurrency[bucketCurrency] || 0) + bucketAmount;
    }
    
    // For backward compatibility, extract individual currency totals
    const totalRevenueUSD = revenueByCurrency["USD"] || 0;
    const totalRevenuePKR = revenueByCurrency["PKR"] || 0;
    const totalRevenueEUR = revenueByCurrency["EUR"] || 0;
    const totalRevenueAED = revenueByCurrency["AED"] || 0;
    
    const totalPaidUSD = paidByCurrency["USD"] || 0;
    const totalPaidPKR = paidByCurrency["PKR"] || 0;
    const totalPaidEUR = paidByCurrency["EUR"] || 0;
    const totalPaidAED = paidByCurrency["AED"] || 0;
    
    // Compute advance payments as payments recorded against invoices whose orders are pending/in_production
    // Advance payments for orders not yet shipped (pending/in_production) - ROLLING (all invoices)
    const preShipmentInvoices = invoices.filter(inv => {
      const order = allOrders.find(o => o._id === inv.orderId);
      return order && (order.status === "pending" || order.status === "in_production");
    });
    const advanceByCurrency: Record<string, number> = {};
    // Derive advance totals by bank currency where applicable
    for (const inv of preShipmentInvoices) {
      // Gather payments linked to this invoice (ROLLING - all payments)
      const invoicePayments = payments.filter(p => p.invoiceId === inv._id);
      for (const p of invoicePayments) {
        let cur = inv.currency;
        let amt = p.amount;
        if (p.bankAccountId) {
          const bank = await ctx.db.get(p.bankAccountId);
          if (bank && bank.currency && bank.currency !== p.currency && (p as any).convertedAmountUSD) {
            cur = bank.currency;
            amt = (p as any).convertedAmountUSD as number;
          }
        }
        advanceByCurrency[cur] = (advanceByCurrency[cur] || 0) + amt;
      }
    }
    const advancePaymentsUSD = advanceByCurrency["USD"] || 0;
    const advancePaymentsPKR = advanceByCurrency["PKR"] || 0;
    const advancePaymentsEUR = advanceByCurrency["EUR"] || 0;
    const advancePaymentsAED = advanceByCurrency["AED"] || 0;

    // Pipeline order value by currency (pending + in_production) - ROLLING (all orders)
    const pipelineOrders = allOrders.filter(o => ["pending", "in_production"].includes(o.status));
    const pipelineByCurrency: Record<string, number> = {};
    pipelineOrders.forEach(order => {
      pipelineByCurrency[order.currency] = (pipelineByCurrency[order.currency] || 0) + order.totalAmount;
    });
    const pendingOrdersValueUSD = pipelineByCurrency["USD"] || 0;
    const pendingOrdersValuePKR = pipelineByCurrency["PKR"] || 0;
    const pendingOrdersValueEUR = pipelineByCurrency["EUR"] || 0;
    const pendingOrdersValueAED = pipelineByCurrency["AED"] || 0;
    
    // Calculate outstanding by currency (only for shipped/delivered orders)
    const outstandingByCurrency: Record<string, number> = {};
    shippedOrDeliveredInvoices.forEach(invoice => {
      const currency = invoice.currency;
      if (invoice.outstandingBalance > 0) {
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + invoice.outstandingBalance;
      }
    });

    // For backward compatibility, also calculate individual currency totals
    const totalOutstandingUSD = outstandingByCurrency["USD"] || 0;
    const totalOutstandingPKR = outstandingByCurrency["PKR"] || 0;
    const totalOutstandingEUR = outstandingByCurrency["EUR"] || 0;
    const totalOutstandingAED = outstandingByCurrency["AED"] || 0;

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
        ["pending", "in_production", "shipped"].includes(o.status)
      ).length,
      totalQuantityKg: Math.round(totalQuantity),
      totalRevenue,
      totalPaid,
      totalOutstanding,
      totalRevenueUSD,
      totalRevenuePKR,
      totalRevenueEUR,
      totalRevenueAED,
      totalPaidUSD,
      totalPaidPKR,
      totalPaidEUR,
      totalPaidAED,
      totalOutstandingUSD,
      totalOutstandingPKR,
      totalOutstandingEUR,
      totalOutstandingAED,
      outstandingByCurrency,
      revenueByCurrency,
      paidByCurrency,
      advancePaymentsUSD,
      advancePaymentsPKR,
      advancePaymentsEUR,
      advancePaymentsAED,
      overdueInvoices: overdueInvoices.length,
      // Payment statistics
      totalPaymentsReceived,
      averagePaymentAmount,
      paymentCount: yearPayments.length,
      pendingOrdersValueUSD,
      pendingOrdersValuePKR,
      pendingOrdersValueEUR,
      pendingOrdersValueAED,
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
      
      // Use factoryDepartureDate when available; fall back to orderCreationDate, then createdAt
      // This ensures orders are counted in the correct month based on factory departure date
      const monthOrders = orders.filter(order => {
        const orderTimestamp = (order as any).factoryDepartureDate ?? (order as any).orderCreationDate ?? order.createdAt;
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
    totalOutstandingEUR: v.number(),
    totalOutstandingAED: v.number(),
    totalPaidUSD: v.number(),
    totalPaidPKR: v.number(),
    totalPaidEUR: v.number(),
    totalPaidAED: v.number(),
    outstandingByCurrency: v.record(v.string(), v.number()),
    paidByCurrency: v.record(v.string(), v.number()),
    advancePaymentsUSD: v.number(),
    advancePaymentsPKR: v.number(),
    advancePaymentsEUR: v.number(),
    advancePaymentsAED: v.number(),
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

    // Calculate outstanding by currency (only for shipped/delivered orders)
    const allOrders = await ctx.db.query("orders").collect();
    const shippedOrDeliveredInvoices = invoices.filter(invoice => {
      const order = allOrders.find(o => o._id === invoice.orderId);
      return order && (order.status === "shipped" || order.status === "delivered");
    });

    const outstandingByCurrency: Record<string, number> = {};
    shippedOrDeliveredInvoices.forEach(invoice => {
      const currency = invoice.currency;
      if (invoice.outstandingBalance > 0) {
        outstandingByCurrency[currency] = (outstandingByCurrency[currency] || 0) + invoice.outstandingBalance;
      }
    });

    // Get payments
    const payments = await ctx.db.query("payments").collect();
    
    // Calculate paid amounts by currency using actual payments; group by bank currency when converted
    const paidByCurrency: Record<string, number> = {};
    for (const p of payments) {
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

    const totalPaidUSD = paidByCurrency["USD"] || 0;
    const totalPaidPKR = paidByCurrency["PKR"] || 0;
    const totalPaidEUR = paidByCurrency["EUR"] || 0;
    const totalPaidAED = paidByCurrency["AED"] || 0;

    // Calculate advance payments by currency using same grouping
    const advanceByCurrency: Record<string, number> = {};
    for (const p of payments.filter(p => p.type === "advance")) {
      let cur = p.currency;
      let amt = p.amount;
      if (p.bankAccountId) {
        const bank = await ctx.db.get(p.bankAccountId);
        if (bank && bank.currency && bank.currency !== p.currency && (p as any).convertedAmountUSD) {
          cur = bank.currency;
          amt = (p as any).convertedAmountUSD as number;
        }
      }
      advanceByCurrency[cur] = (advanceByCurrency[cur] || 0) + amt;
    }
    const advancePaymentsUSD = advanceByCurrency["USD"] || 0;
    const advancePaymentsPKR = advanceByCurrency["PKR"] || 0;
    const advancePaymentsEUR = advanceByCurrency["EUR"] || 0;
    const advancePaymentsAED = advanceByCurrency["AED"] || 0;

    const totalOutstanding = shippedOrDeliveredInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
    const totalPaid = totalPaidUSD + totalPaidPKR + totalPaidEUR + totalPaidAED; // Use grouped amounts
    const totalOutstandingUSD = shippedOrDeliveredInvoices.filter(i => i.currency === "USD").reduce((s, i) => s + i.outstandingBalance, 0);
    const totalOutstandingPKR = shippedOrDeliveredInvoices.filter(i => i.currency === "PKR").reduce((s, i) => s + i.outstandingBalance, 0);
    const totalOutstandingEUR = shippedOrDeliveredInvoices.filter(i => i.currency === "EUR").reduce((s, i) => s + i.outstandingBalance, 0);
    const totalOutstandingAED = shippedOrDeliveredInvoices.filter(i => i.currency === "AED").reduce((s, i) => s + i.outstandingBalance, 0);
    const overdueCount = 0;
    const totalCount = invoices.length;

    // Include all currencies present
    // Note: paidByCurrency already built above

    return {
      totalOutstanding,
      totalPaid,
      overdueCount,
      totalCount,
      totalOutstandingUSD,
      totalOutstandingPKR,
      totalOutstandingEUR,
      totalOutstandingAED,
      totalPaidUSD,
      totalPaidPKR,
      totalPaidEUR: totalPaidUSD, // For now, use USD as EUR equivalent
      totalPaidAED: totalPaidUSD, // For now, use USD as AED equivalent
      outstandingByCurrency,
      paidByCurrency,
      advancePaymentsUSD,
      advancePaymentsPKR,
      advancePaymentsEUR,
      advancePaymentsAED,
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
      inv.outstandingBalance > 0 && inv.dueDate && inv.dueDate < now
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
      const daysOverdue = invoice.dueDate ? Math.floor((now - invoice.dueDate) / (1000 * 60 * 60 * 24)) : 0;
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
