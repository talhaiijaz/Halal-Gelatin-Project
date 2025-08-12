import { query, mutation } from "./_generated/server";
import { v } from "convex/values";


// Generate order number with sequential format
const generateOrderNumber = async (ctx: any) => {
  const date = new Date();
  const year = date.getFullYear();
  
  // Get the count of orders in this year
  const orders = await ctx.db.query("orders").collect();
  const yearOrders = orders.filter((o: any) => {
    const orderYear = new Date(o.createdAt).getFullYear();
    return orderYear === year;
  });
  
  const orderCount = yearOrders.length + 1;
  const orderNumber = `ORD-${year}-${orderCount.toString().padStart(4, '0')}`;
  
  return orderNumber;
};

// List orders with filters
export const list = query({
  args: {
    clientId: v.optional(v.id("clients")),
    status: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    clientType: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
  handler: async (ctx, args) => {
    
    

    let orders = await ctx.db.query("orders").order("desc").collect();

    // If filtering by client type, first get matching clients
    if (args.clientType) {
      const clients = await ctx.db
        .query("clients")
        .withIndex("by_type", (q) => q.eq("type", args.clientType!))
        .collect();
      const clientIds = clients.map(c => c._id);
      orders = orders.filter(o => clientIds.includes(o.clientId));
    }

    // Apply other filters
    if (args.clientId) {
      orders = orders.filter(o => o.clientId === args.clientId);
    }

    if (args.status) {
      orders = orders.filter(o => o.status === args.status);
    }

    if (args.startDate) {
      orders = orders.filter(o => o.createdAt >= args.startDate!);
    }

    if (args.endDate) {
      orders = orders.filter(o => o.createdAt <= args.endDate!);
    }

    // Fetch client data for each order
    const ordersWithClients = await Promise.all(
      orders.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        
        // Get invoice if exists
        const invoice = await ctx.db
          .query("invoices")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .first();

        return {
          ...order,
          client: client ? {
            _id: client._id,
            name: client.name,
            city: client.city,
            country: client.country,
            type: client.type,
          } : null,
          items,
          invoice: invoice ? {
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            totalPaid: invoice.totalPaid,
            outstandingBalance: invoice.outstandingBalance,
          } : null,
        };
      })
    );

    return ordersWithClients;
  },
});

// Get single order with all details
export const get = query({
  args: {
    id: v.id("orders"),
  },
  handler: async (ctx, args) => {
    
    

    const order = await ctx.db.get(args.id);
    if (!order) return null;

    // Get related data
    const client = await ctx.db.get(order.clientId);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .collect();
    
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .first();

    let payments: any[] = [];
    if (invoice) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
        .collect();
    }

    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .first();

    const salesRep = await ctx.db.get(order.salesRepId);

    return {
      ...order,
      client,
      items,
      invoice,
      payments,
      delivery,
      salesRep: salesRep ? {
        _id: salesRep._id,
        name: salesRep.name,
        email: salesRep.email,
      } : null,
    };
  },
});

// Create new order
export const create = mutation({
  args: {
    clientId: v.id("clients"),
    expectedDeliveryDate: v.number(),
    currency: v.string(),
    notes: v.optional(v.string()),
    items: v.array(v.object({
      product: v.string(),
      quantityKg: v.number(),
      unitPrice: v.number(),
      notes: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    
    

    // Calculate total
    const totalAmount = args.items.reduce(
      (sum, item) => sum + (item.quantityKg * item.unitPrice),
      0
    );

    // Create order
    const orderNumber = await generateOrderNumber(ctx);
    const orderId = await ctx.db.insert("orders", {
      orderNumber,
      clientId: args.clientId,
      status: "pending",
      expectedDeliveryDate: args.expectedDeliveryDate,
      salesRepId: "system" as any, // Removed auth
      totalAmount,
      currency: args.currency,
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create order items
    for (const item of args.items) {
      await ctx.db.insert("orderItems", {
        orderId,
        product: item.product,
        quantityKg: item.quantityKg,
        unitPrice: item.unitPrice,
        totalPrice: item.quantityKg * item.unitPrice,
        notes: item.notes,
      });
    }

    // Create invoice automatically
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const issueDate = Date.now();
    const dueDate = issueDate + (30 * 24 * 60 * 60 * 1000); // 30 days from issue

    await ctx.db.insert("invoices", {
      invoiceNumber,
      orderId,
      clientId: args.clientId,
      issueDate,
      dueDate,
      status: "due",
      amount: totalAmount,
      currency: args.currency,
      totalPaid: 0,
      outstandingBalance: totalAmount,
      notes: `Invoice for Order ${await ctx.db.get(orderId).then(o => o?.orderNumber)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return orderId;
  },
});

// Update order status
export const updateStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    
    

    await ctx.db.patch(args.orderId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    // If order is confirmed, create invoice
    if (args.status === "confirmed") {
      const order = await ctx.db.get(args.orderId);
      if (!order) throw new Error("Order not found");

      // Check if invoice already exists
      const existingInvoice = await ctx.db
        .query("invoices")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();

      if (!existingInvoice) {
        // Generate invoice number
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const invoiceNumber = `INV-${year}${month}-${random}`;

        await ctx.db.insert("invoices", {
          invoiceNumber,
          orderId: args.orderId,
          clientId: order.clientId,
          issueDate: Date.now(),
          dueDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          status: "sent",
          amount: order.totalAmount,
          currency: order.currency,
          totalPaid: 0,
          outstandingBalance: order.totalAmount,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // If order is shipped, create/update delivery
    if (args.status === "shipped") {
      const delivery = await ctx.db
        .query("deliveries")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();

      if (delivery) {
        await ctx.db.patch(delivery._id, {
          status: "shipped",
          shippedDate: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // If order is delivered, update delivery
    if (args.status === "delivered") {
      const delivery = await ctx.db
        .query("deliveries")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();

      if (delivery) {
        await ctx.db.patch(delivery._id, {
          status: "delivered",
          deliveredDate: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

// Add items to existing order
export const addItems = mutation({
  args: {
    orderId: v.id("orders"),
    items: v.array(v.object({
      product: v.string(),
      quantityKg: v.number(),
      unitPrice: v.number(),
      notes: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    
    

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // Add new items
    let additionalAmount = 0;
    for (const item of args.items) {
      const totalPrice = item.quantityKg * item.unitPrice;
      additionalAmount += totalPrice;
      
      await ctx.db.insert("orderItems", {
        orderId: args.orderId,
        product: item.product,
        quantityKg: item.quantityKg,
        unitPrice: item.unitPrice,
        totalPrice,
        notes: item.notes,
      });
    }

    // Update order total
    await ctx.db.patch(args.orderId, {
      totalAmount: order.totalAmount + additionalAmount,
      updatedAt: Date.now(),
    });

    // Update invoice if exists
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    if (invoice) {
      const newAmount = invoice.amount + additionalAmount;
      await ctx.db.patch(invoice._id, {
        amount: newAmount,
        outstandingBalance: newAmount - invoice.totalPaid,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Delete order (only if pending)
export const remove = mutation({
  args: {
    id: v.id("orders"),
  },
  handler: async (ctx, args) => {
    
    

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Order not found");

    if (order.status !== "pending") {
      throw new Error("Can only delete pending orders");
    }

    // Delete order items
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Delete order
    await ctx.db.delete(args.id);

    return { success: true };
  },
});

// Get order statistics
export const getStats = query({
  args: {
    clientType: v.optional(v.union(v.literal("local"), v.literal("international"))),
  },
  handler: async (ctx, args) => {
    
    

    let orders = await ctx.db.query("orders").collect();

    // Filter by client type if specified
    if (args.clientType) {
      const clients = await ctx.db
        .query("clients")
        .withIndex("by_type", (q) => q.eq("type", args.clientType!))
        .collect();
      const clientIds = clients.map(c => c._id);
      orders = orders.filter(o => clientIds.includes(o.clientId));
    }

    // Calculate statistics
    const statusCounts = {
      pending: 0,
      confirmed: 0,
      in_production: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    let totalRevenue = 0;
    let totalQuantity = 0;

    for (const order of orders) {
      statusCounts[order.status as keyof typeof statusCounts]++;
      
      if (order.status !== "cancelled") {
        totalRevenue += order.totalAmount;
        
        // Get order items for quantity
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        
        totalQuantity += items.reduce((sum, item) => sum + item.quantityKg, 0);
      }
    }

    return {
      totalOrders: orders.length,
      activeOrders: orders.filter(o => 
        ["pending", "confirmed", "in_production", "shipped"].includes(o.status)
      ).length,
      statusCounts,
      totalRevenue,
      totalQuantity,
      averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    };
  },
});