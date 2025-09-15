import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function logOrderEvent(ctx: any, params: { entityId: string; action: "create" | "update" | "delete"; message: string; metadata?: any; userId?: Id<"users"> | undefined; }) {
  try {
    await ctx.db.insert("logs", {
      entityTable: "orders",
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

// Fiscal year validation helper functions
const getFiscalYearRange = (fiscalYear: number) => {
  const startDate = new Date(fiscalYear, 6, 1).getTime(); // July 1
  const endDate = new Date(fiscalYear + 1, 5, 30, 23, 59, 59, 999).getTime(); // June 30
  
  return {
    startDate,
    endDate,
    fiscalYear,
  };
};

const isDateInFiscalYear = (date: number, fiscalYear: number): boolean => {
  const range = getFiscalYearRange(fiscalYear);
  return date >= range.startDate && date <= range.endDate;
};

// Generate order number with sequential format using fiscal year
const generateOrderNumber = async (ctx: any, selectedFiscalYear?: number) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  
  // Use selected fiscal year or determine current fiscal year
  const fiscalYear = selectedFiscalYear || (month >= 6 ? year : year - 1);
  
  // Format fiscal year as FY25-26
  const fiscalYearStart = fiscalYear;
  const fiscalYearEnd = fiscalYear + 1;
  const fiscalYearLabel = `FY${fiscalYearStart.toString().slice(-2)}-${fiscalYearEnd.toString().slice(-2)}`;
  
  // Get the count of orders in this fiscal year using the stored fiscalYear field
  const orders = await ctx.db.query("orders").collect();
  const fiscalYearOrders = orders.filter((o: any) => o.fiscalYear === fiscalYear);
  
  const orderCount = fiscalYearOrders.length + 1;
  const orderNumber = `ORD-${fiscalYearLabel}-${orderCount.toString().padStart(3, '0')}`;
  
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
    fiscalYear: v.optional(v.number()), // Add fiscal year filter
  },
  handler: async (ctx, args) => {
    
    

    let orders = await ctx.db.query("orders").collect();

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

    if (args.fiscalYear) {
      orders = orders.filter(o => o.fiscalYear === args.fiscalYear);
    }

    // Sort orders: first by fiscal year (descending - latest year first), then by status priority, then by creation date (descending)
    const statusPriority = {
      pending: 1,
      in_production: 2,
      shipped: 3,
      delivered: 4,
      cancelled: 5
    };
    
    orders.sort((a, b) => {
      // First sort by fiscal year (descending - latest year first)
      if (a.fiscalYear !== b.fiscalYear) {
        return (b.fiscalYear || 0) - (a.fiscalYear || 0);
      }
      // Then sort by status priority (pending first, then in_production, shipped, delivered, cancelled)
      const statusA = statusPriority[a.status as keyof typeof statusPriority] || 6;
      const statusB = statusPriority[b.status as keyof typeof statusPriority] || 6;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      // Finally sort by creation date (descending - latest first)
      return b.createdAt - a.createdAt;
    });

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

        // Get payments for financial calculations
        let payments: any[] = [];
        if (invoice) {
          payments = await ctx.db
            .query("payments")
            .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
            .collect();
        }

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
            invoiceNumber: order.invoiceNumber, // Use the invoice number from the order
            status: invoice.status,
            amount: invoice.amount,
            totalPaid: invoice.totalPaid,
            outstandingBalance: invoice.outstandingBalance,
          } : null,
          payments,
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

    const salesRep = order.salesRepId ? await ctx.db.get(order.salesRepId) : null;

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
    invoiceNumber: v.string(), // Required invoice number for tracking
    fiscalYear: v.optional(v.number()), // Optional fiscal year for order number
    currency: v.optional(v.string()), // Currency for international clients (defaults to USD)
    notes: v.optional(v.string()),
    freightCost: v.optional(v.number()),
    // Timeline fields
    orderCreationDate: v.optional(v.number()),
    factoryDepartureDate: v.optional(v.number()),
    estimatedDepartureDate: v.optional(v.number()),
    estimatedArrivalDate: v.optional(v.number()),
    deliveryDate: v.optional(v.number()), // Actual delivery date
    timelineNotes: v.optional(v.string()),
    // Shipment information
    shipmentMethod: v.optional(v.union(v.literal("air"), v.literal("sea"), v.literal("road"), v.literal("train"))),
    shippingCompany: v.optional(v.string()),
    shippingOrderNumber: v.optional(v.string()),
    items: v.array(v.object({
      product: v.string(),
      bloom: v.optional(v.string()),
      mesh: v.optional(v.number()),
      lotNumbers: v.optional(v.array(v.string())),
      quantityKg: v.number(),
      unitPrice: v.number(),
      exclusiveValue: v.optional(v.number()),
      gstRate: v.optional(v.number()),
      gstAmount: v.optional(v.number()),
      inclusiveTotal: v.optional(v.number()),
      notes: v.optional(v.string()),
      // Discount fields
      discountType: v.optional(v.union(v.literal("amount"), v.literal("percentage"))),
      discountValue: v.optional(v.number()),
      discountAmount: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    
    // Check if invoice number already exists in orders table
    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_invoice_number", q => q.eq("invoiceNumber", args.invoiceNumber))
      .first();
    
    if (existingOrder) {
      throw new Error(`Invoice number ${args.invoiceNumber} already exists. Please use a unique invoice number.`);
    }

    // Validate order creation date against fiscal year
    if (args.orderCreationDate && args.fiscalYear) {
      if (!isDateInFiscalYear(args.orderCreationDate, args.fiscalYear)) {
        const range = getFiscalYearRange(args.fiscalYear);
        const startDate = new Date(range.startDate).toLocaleDateString();
        const endDate = new Date(range.endDate).toLocaleDateString();
        throw new Error(`Order creation date must be within fiscal year ${args.fiscalYear}-${(args.fiscalYear + 1).toString().slice(-2)} (${startDate} - ${endDate})`);
      }
    }

    // Calculate total using inclusive total (with GST) plus freight cost
    const itemsTotal = args.items.reduce(
      (sum, item) => sum + (item.inclusiveTotal || (item.quantityKg * item.unitPrice)),
      0
    );
    const totalAmount = itemsTotal + (args.freightCost || 0);

    // Get client and determine currency
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found");
    
    // Currency logic: Local clients use PKR, International clients can use any currency
    let currencyToUse: string;
    if (client.type === "local") {
      currencyToUse = "PKR";
    } else {
      // For international clients, use provided currency or default to USD
      currencyToUse = args.currency || "USD";
    }

    // Create order
    const orderNumber = await generateOrderNumber(ctx, args.fiscalYear);
    
    // Ensure fiscal year is properly set
    let fiscalYearToUse = args.fiscalYear;
    if (!fiscalYearToUse) {
      // Calculate fiscal year from order creation date or current date
      const orderDate = args.orderCreationDate || Date.now();
      const date = new Date(orderDate);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      fiscalYearToUse = month >= 6 ? year : year - 1; // July = 6
    }
    
    const orderId = await ctx.db.insert("orders", {
      orderNumber,
      invoiceNumber: args.invoiceNumber,
      clientId: args.clientId,
      status: "pending",
      // Timeline fields
      orderCreationDate: args.orderCreationDate || Date.now(), // Default to current timestamp if not provided
      factoryDepartureDate: args.factoryDepartureDate,
      estimatedDepartureDate: args.estimatedDepartureDate,
      estimatedArrivalDate: args.estimatedArrivalDate,
      deliveryDate: args.deliveryDate,
      timelineNotes: args.timelineNotes,
      // Shipment information
      shipmentMethod: args.shipmentMethod,
      shippingCompany: args.shippingCompany,
      shippingOrderNumber: args.shippingOrderNumber,
      // salesRepId is now optional - omitted for now
      totalAmount,
      freightCost: args.freightCost,
      currency: currencyToUse,
      notes: args.notes,
      fiscalYear: fiscalYearToUse, // Store the calculated fiscal year
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create order items
    for (const item of args.items) {
      const exclusiveValue = item.exclusiveValue || (item.quantityKg * item.unitPrice);
      const gstRate = item.gstRate !== undefined ? item.gstRate : 0; // Default 18% GST, but allow 0
      const gstAmount = item.gstAmount !== undefined ? item.gstAmount : ((exclusiveValue * gstRate) / 100);
      const totalBeforeDiscount = exclusiveValue + gstAmount;
      
      // Calculate discount on total (after GST)
      let discountAmount = 0;
      if (item.discountType && item.discountValue) {
        if (item.discountType === "amount") {
          discountAmount = item.discountValue;
        } else if (item.discountType === "percentage") {
          discountAmount = (totalBeforeDiscount * item.discountValue) / 100;
        }
      }
      
      // Apply discount to total
      const inclusiveTotal = item.inclusiveTotal || (totalBeforeDiscount - discountAmount);
      
      await ctx.db.insert("orderItems", {
        orderId,
        product: item.product,
        bloom: item.bloom,
        mesh: item.mesh,
        lotNumbers: item.lotNumbers,
        quantityKg: item.quantityKg,
        unitPrice: item.unitPrice,
        exclusiveValue: exclusiveValue,
        gstRate: gstRate,
        gstAmount: gstAmount,
        inclusiveTotal: inclusiveTotal,
        totalPrice: inclusiveTotal, // Legacy field for backward compatibility
        notes: item.notes,
        // Discount fields
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: discountAmount,
      });
    }

    // Create invoice automatically
    const issueDate = Date.now();
    const dueDate = issueDate + (30 * 24 * 60 * 60 * 1000); // 30 days from issue

    // Use the provided invoice number (required field)
    const invoiceNumber = args.invoiceNumber;

    const invoiceId = await ctx.db.insert("invoices", {
      invoiceNumber: invoiceNumber,
      orderId,
      clientId: args.clientId,
      issueDate,
      dueDate,
      status: "unpaid",
      amount: totalAmount,
      currency: currencyToUse,
      totalPaid: 0,
      outstandingBalance: 0, // New orders don't have outstanding amounts until shipped
      notes: `Invoice for Order ${orderNumber}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Get client information for meaningful logging
    // client is already fetched above
    const clientName = client?.name || "Unknown Client";
    
    await logOrderEvent(ctx, { 
      entityId: String(orderId), 
      action: "create", 
      message: `Order created ${orderNumber} (${clientName})`, 
      metadata: { invoiceId, clientName, orderNumber } 
    });
    return { orderId, invoiceId };
  },
});

// Update invoice number
export const updateInvoiceNumber = mutation({
  args: {
    orderId: v.id("orders"),
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if invoice number already exists in orders table
    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_invoice_number", q => q.eq("invoiceNumber", args.invoiceNumber))
      .first();
    
    if (existingOrder && existingOrder._id !== args.orderId) {
      throw new Error(`Invoice number ${args.invoiceNumber} already exists. Please use a unique invoice number.`);
    }

    // Check if invoice number already exists in invoices table
    const existingInvoice = await ctx.db
      .query("invoices")
      .withIndex("by_invoice_number", q => q.eq("invoiceNumber", args.invoiceNumber))
      .first();
    
    if (existingInvoice && existingInvoice.orderId !== args.orderId) {
      throw new Error(`Invoice number ${args.invoiceNumber} already exists. Please use a unique invoice number.`);
    }

    // Update the order
    await ctx.db.patch(args.orderId, {
      invoiceNumber: args.invoiceNumber,
      updatedAt: Date.now(),
    });

    // Find and update the invoice associated with this order
    const orderInvoice = await ctx.db
      .query("invoices")
      .withIndex("by_order", q => q.eq("orderId", args.orderId))
      .first();

    if (orderInvoice) {
      // Update the invoice associated with this order
      await ctx.db.patch(orderInvoice._id, {
        invoiceNumber: args.invoiceNumber,
        updatedAt: Date.now(),
      });
    }

    return true;
  },
});

// Update order status
export const updateStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    deliveryDate: v.optional(v.number()), // Optional delivery date when changing to delivered
  },
  handler: async (ctx, args) => {
    // Validate delivery date when changing status to delivered
    if (args.status === "delivered") {
      const order = await ctx.db.get(args.orderId);
      if (!order) throw new Error("Order not found");
      
      // Check if delivery date is provided or already exists
      if (!args.deliveryDate && !order.deliveryDate) {
        throw new Error("Delivery date is required when changing order status to delivered. Please provide a delivery date.");
      }
    }
    
    

    const updateData: any = {
      status: args.status,
      updatedAt: Date.now(),
    };
    
    // Set delivery date if provided
    if (args.deliveryDate) {
      updateData.deliveryDate = args.deliveryDate;
    }
    
    await ctx.db.patch(args.orderId, updateData);
    await logOrderEvent(ctx, { entityId: String(args.orderId), action: "update", message: `Order status updated to ${args.status}` });

    // If order moves to in_production, create invoice
    if (args.status === "in_production") {
      const order = await ctx.db.get(args.orderId);
      if (!order) throw new Error("Order not found");

      // Check if invoice already exists
      const existingInvoice = await ctx.db
        .query("invoices")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();

      if (!existingInvoice) {
        // Use the order's invoice number for consistency
        const invoiceNumber = order.invoiceNumber;

        // Create invoice
        await ctx.db.insert("invoices", {
          invoiceNumber: invoiceNumber,
          orderId: args.orderId,
          clientId: order.clientId,
          issueDate: Date.now(),
          dueDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          status: "unpaid",
          amount: order.totalAmount,
          currency: order.currency,
          totalPaid: 0,
          outstandingBalance: 0, // New invoices don't have outstanding amounts until shipped
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // If order is shipped, create/update delivery and update outstanding balance
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

      // Update invoice outstanding balance when order is shipped
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();

      if (invoice) {
        const newOutstandingBalance = invoice.amount - invoice.totalPaid;
        let newStatus: "unpaid" | "partially_paid" | "paid";
        if (newOutstandingBalance === 0) newStatus = "paid";
        else if (invoice.totalPaid > 0) newStatus = "partially_paid";
        else newStatus = "unpaid";
        
        await ctx.db.patch(invoice._id, {
          outstandingBalance: newOutstandingBalance,
          status: newStatus,
          updatedAt: Date.now(),
        });
      }
    }

    // If order is delivered, update delivery and recalculate outstanding balance
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

      // Update invoice outstanding balance when order is delivered
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();

      if (invoice) {
        const newOutstandingBalance = invoice.amount - invoice.totalPaid;
        let newStatus: "unpaid" | "partially_paid" | "paid";
        if (newOutstandingBalance === 0) newStatus = "paid";
        else if (invoice.totalPaid > 0) newStatus = "partially_paid";
        else newStatus = "unpaid";
        
        await ctx.db.patch(invoice._id, {
          outstandingBalance: newOutstandingBalance,
          status: newStatus,
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
      exclusiveValue: v.optional(v.number()),
      gstRate: v.optional(v.number()),
      gstAmount: v.optional(v.number()),
      inclusiveTotal: v.optional(v.number()),
      notes: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    
    

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // Add new items
    let additionalAmount = 0;
    for (const item of args.items) {
      const exclusiveValue = item.exclusiveValue || (item.quantityKg * item.unitPrice);
      const gstRate = item.gstRate !== undefined ? item.gstRate : 18; // Default 18% GST, but allow 0
      const gstAmount = item.gstAmount !== undefined ? item.gstAmount : ((exclusiveValue * gstRate) / 100);
      const inclusiveTotal = item.inclusiveTotal || (exclusiveValue + gstAmount);
      
      additionalAmount += inclusiveTotal;
      
      await ctx.db.insert("orderItems", {
        orderId: args.orderId,
        product: item.product,
        quantityKg: item.quantityKg,
        unitPrice: item.unitPrice,
        exclusiveValue: exclusiveValue,
        gstRate: gstRate,
        gstAmount: gstAmount,
        inclusiveTotal: inclusiveTotal,
        totalPrice: inclusiveTotal, // Legacy field for backward compatibility
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
      const newOutstandingBalance = newAmount - invoice.totalPaid;
      let newStatus: "unpaid" | "partially_paid" | "paid";
      if (newOutstandingBalance === 0) newStatus = "paid";
      else if (invoice.totalPaid > 0) newStatus = "partially_paid";
      else newStatus = "unpaid";
      
      await ctx.db.patch(invoice._id, {
        amount: newAmount,
        outstandingBalance: newOutstandingBalance,
        status: newStatus,
        updatedAt: Date.now(),
      });
    } else {
      // Create invoice if it doesn't exist using the order's invoice number
      const invoiceNumber = order.invoiceNumber;

      await ctx.db.insert("invoices", {
        invoiceNumber: invoiceNumber,
        orderId: args.orderId,
        clientId: order.clientId,
        issueDate: Date.now(),
        dueDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
        status: "unpaid",
        amount: order.totalAmount + additionalAmount,
        currency: order.currency,
        totalPaid: 0,
        outstandingBalance: 0, // New invoices don't have outstanding amounts until shipped
        notes: "",
        createdAt: Date.now(),
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

    // Delete associated files from storage
    const filesToDelete = [
      order.packingListId,
      order.proformaInvoiceId,
      order.commercialInvoiceId
    ].filter(Boolean);

    for (const fileId of filesToDelete) {
      try {
        await ctx.storage.delete(fileId as any);
      } catch (error) {
        console.error("Failed to delete file from storage:", error);
        // Continue with deletion even if file cleanup fails
      }
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

// Upload document to order
export const uploadDocument = mutation({
  args: {
    orderId: v.id("orders"),
    documentType: v.union(v.literal("packingList"), v.literal("proformaInvoice"), v.literal("commercialInvoice")),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    let oldStorageId: string | undefined;
    const updateData: any = {
      updatedAt: Date.now(),
    };

    // Get old storage ID and update the appropriate document field
    switch (args.documentType) {
      case "packingList":
        oldStorageId = order.packingListId;
        updateData.packingListId = args.storageId;
        break;
      case "proformaInvoice":
        oldStorageId = order.proformaInvoiceId;
        updateData.proformaInvoiceId = args.storageId;
        break;
      case "commercialInvoice":
        oldStorageId = order.commercialInvoiceId;
        updateData.commercialInvoiceId = args.storageId;
        break;
    }

    // Delete the old file from storage if it exists
    if (oldStorageId) {
      try {
        await ctx.storage.delete(oldStorageId as any);
      } catch (error) {
        console.error("Failed to delete old file from storage:", error);
        // Continue with upload even if old file deletion fails
      }
    }

    await ctx.db.patch(args.orderId, updateData);

    // Get order and client details for meaningful logging
    const orderDetails = await ctx.db.get(args.orderId);
    const clientDetails = orderDetails ? await ctx.db.get(orderDetails.clientId) : null;
    
    // Log the document upload activity with meaningful details
    const documentLabels = {
      packingList: "Packing List",
      proformaInvoice: "Pro Forma Invoice", 
      commercialInvoice: "Commercial Invoice"
    };
    
    const clientName = clientDetails?.name || "Unknown Client";
    const orderNumber = orderDetails?.orderNumber || "Unknown Order";
    
    await ctx.db.insert("logs", {
      entityTable: "orders",
      entityId: String(args.orderId),
      action: "update",
      message: `${documentLabels[args.documentType]} uploaded for ${orderNumber} (${clientName})`,
      metadata: {
        documentType: args.documentType,
        storageId: args.storageId,
        action: "document_upload",
        orderNumber: orderNumber,
        clientName: clientName
      },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Remove document from order
export const removeDocument = mutation({
  args: {
    orderId: v.id("orders"),
    documentType: v.union(v.literal("packingList"), v.literal("proformaInvoice"), v.literal("commercialInvoice")),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    let storageIdToDelete: string | undefined;
    const updateData: any = {
      updatedAt: Date.now(),
    };

    // Get the storage ID to delete and remove the appropriate document field
    switch (args.documentType) {
      case "packingList":
        storageIdToDelete = order.packingListId;
        updateData.packingListId = undefined;
        break;
      case "proformaInvoice":
        storageIdToDelete = order.proformaInvoiceId;
        updateData.proformaInvoiceId = undefined;
        break;
      case "commercialInvoice":
        storageIdToDelete = order.commercialInvoiceId;
        updateData.commercialInvoiceId = undefined;
        break;
    }

    // Delete the file from storage if it exists
    if (storageIdToDelete) {
      try {
        await ctx.storage.delete(storageIdToDelete as any);
      } catch (error) {
        console.error("Failed to delete file from storage:", error);
        // Continue with order update even if file deletion fails
      }
    }

    await ctx.db.patch(args.orderId, updateData);

    // Get order and client details for meaningful logging
    const orderDetails = await ctx.db.get(args.orderId);
    const clientDetails = orderDetails ? await ctx.db.get(orderDetails.clientId) : null;
    
    // Log the document removal activity with meaningful details
    const documentLabels = {
      packingList: "Packing List",
      proformaInvoice: "Pro Forma Invoice", 
      commercialInvoice: "Commercial Invoice"
    };
    
    const clientName = clientDetails?.name || "Unknown Client";
    const orderNumber = orderDetails?.orderNumber || "Unknown Order";
    
    await ctx.db.insert("logs", {
      entityTable: "orders",
      entityId: String(args.orderId),
      action: "update",
      message: `${documentLabels[args.documentType]} deleted from ${orderNumber} (${clientName})`,
      metadata: {
        documentType: args.documentType,
        storageId: storageIdToDelete,
        action: "document_delete",
        orderNumber: orderNumber,
        clientName: clientName
      },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Get document URL
export const getDocumentUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Log document view activity
export const logDocumentView = mutation({
  args: {
    orderId: v.id("orders"),
    documentType: v.union(v.literal("packingList"), v.literal("proformaInvoice"), v.literal("commercialInvoice")),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get order and client details for meaningful logging
    const orderDetails = await ctx.db.get(args.orderId);
    const clientDetails = orderDetails ? await ctx.db.get(orderDetails.clientId) : null;
    
    const documentLabels = {
      packingList: "Packing List",
      proformaInvoice: "Pro Forma Invoice", 
      commercialInvoice: "Commercial Invoice"
    };
    
    const clientName = clientDetails?.name || "Unknown Client";
    const orderNumber = orderDetails?.orderNumber || "Unknown Order";
    
    await ctx.db.insert("logs", {
      entityTable: "orders",
      entityId: String(args.orderId),
      action: "update",
      message: `${documentLabels[args.documentType]} viewed for ${orderNumber} (${clientName})`,
      metadata: {
        documentType: args.documentType,
        storageId: args.storageId,
        action: "document_view",
        orderNumber: orderNumber,
        clientName: clientName
      },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Update order timeline
export const updateTimeline = mutation({
  args: {
    orderId: v.id("orders"),
    orderCreationDate: v.optional(v.number()),
    factoryDepartureDate: v.optional(v.number()),
    estimatedDepartureDate: v.optional(v.number()),
    estimatedArrivalDate: v.optional(v.number()),
    deliveryDate: v.optional(v.number()), // Actual delivery date
    timelineNotes: v.optional(v.string()),
    // Shipment information
    shipmentMethod: v.optional(v.union(v.literal("air"), v.literal("sea"), v.literal("road"), v.literal("train"))),
    shippingCompany: v.optional(v.string()),
    shippingOrderNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orderId, ...timelineData } = args;
    
    // Remove undefined values
    const updateData = Object.fromEntries(
      Object.entries(timelineData).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No valid timeline data provided" };
    }

    // Add updatedAt timestamp
    updateData.updatedAt = Date.now();

    await ctx.db.patch(orderId, updateData);
    await logOrderEvent(ctx, { entityId: String(orderId), action: "update", message: `Order timeline updated`, metadata: updateData });
    return { success: true };
  },
});

// Get order statistics
export const getStats = query({
  args: {
    clientType: v.optional(v.union(v.literal("local"), v.literal("international"))),
    fiscalYear: v.optional(v.number()),
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

    // Filter by fiscal year if specified
    if (args.fiscalYear) {
      orders = orders.filter(order => order.fiscalYear === args.fiscalYear);
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
    };
  },
});

// Update order
export const update = mutation({
  args: {
    orderId: v.id("orders"),
    clientId: v.optional(v.id("clients")),
    // currency cannot be changed; derived from client type
    notes: v.optional(v.string()),
    freightCost: v.optional(v.number()),
    // Timeline fields
    orderCreationDate: v.optional(v.number()),
    factoryDepartureDate: v.optional(v.number()),
    estimatedDepartureDate: v.optional(v.number()),
    estimatedArrivalDate: v.optional(v.number()),
    deliveryDate: v.optional(v.number()), // Actual delivery date
    timelineNotes: v.optional(v.string()),
    // Shipment information
    shipmentMethod: v.optional(v.union(v.literal("air"), v.literal("sea"), v.literal("road"), v.literal("train"))),
    shippingCompany: v.optional(v.string()),
    shippingOrderNumber: v.optional(v.string()),
    items: v.optional(v.array(v.object({
      product: v.string(),
      bloom: v.optional(v.string()),
      mesh: v.optional(v.number()),
      lotNumbers: v.optional(v.array(v.string())),
      quantityKg: v.number(),
      unitPrice: v.number(),
      exclusiveValue: v.optional(v.number()),
      gstRate: v.optional(v.number()),
      gstAmount: v.optional(v.number()),
      inclusiveTotal: v.optional(v.number()),
      notes: v.optional(v.string()),
      // Discount fields
      discountType: v.optional(v.union(v.literal("amount"), v.literal("percentage"))),
      discountValue: v.optional(v.number()),
      discountAmount: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    const { orderId, items, ...updateData } = args;
    
    // Remove undefined values
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    // If items are provided, recalculate total amount
    if (items && items.length > 0) {
      const itemsTotal = items.reduce(
        (sum, item) => sum + (item.inclusiveTotal || (item.quantityKg * item.unitPrice)),
        0
      );
      const freightCost = (cleanUpdateData as any).freightCost || 0;
      (cleanUpdateData as any).totalAmount = itemsTotal + freightCost;
    }

    // Add updatedAt timestamp
    cleanUpdateData.updatedAt = Date.now();

    // Update the order
    await ctx.db.patch(orderId, cleanUpdateData);
    await logOrderEvent(ctx, { entityId: String(orderId), action: "update", message: `Order updated`, metadata: cleanUpdateData });

    // If items are provided, update order items
    if (items && items.length > 0) {
      // Delete existing order items
      const existingItems = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .collect();
      
      for (const item of existingItems) {
        await ctx.db.delete(item._id);
      }

      // Create new order items
      for (const item of items) {
        const exclusiveValue = item.exclusiveValue || (item.quantityKg * item.unitPrice);
        const gstRate = item.gstRate !== undefined ? item.gstRate : 18; // Default 18% GST, but allow 0
        const gstAmount = item.gstAmount !== undefined ? item.gstAmount : ((exclusiveValue * gstRate) / 100);
        const totalBeforeDiscount = exclusiveValue + gstAmount;
        
        // Calculate discount on total (after GST)
        let discountAmount = 0;
        if (item.discountType && item.discountValue) {
          if (item.discountType === "amount") {
            discountAmount = item.discountValue;
          } else if (item.discountType === "percentage") {
            discountAmount = (totalBeforeDiscount * item.discountValue) / 100;
          }
        }
        
        // Apply discount to total
        const inclusiveTotal = item.inclusiveTotal || (totalBeforeDiscount - discountAmount);
        
        await ctx.db.insert("orderItems", {
          orderId,
          product: item.product,
          bloom: item.bloom,
          mesh: item.mesh,
          lotNumbers: item.lotNumbers,
          quantityKg: item.quantityKg,
          unitPrice: item.unitPrice,
          exclusiveValue: exclusiveValue,
          gstRate: gstRate,
          gstAmount: gstAmount,
          inclusiveTotal: inclusiveTotal,
          totalPrice: inclusiveTotal, // Legacy field for backward compatibility
          notes: item.notes,
          // Discount fields
          discountType: item.discountType,
          discountValue: item.discountValue,
          discountAmount: discountAmount,
        });
      }

      // Update invoice if it exists
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .first();

      if (invoice) {
        const order = await ctx.db.get(orderId);
        const newOutstandingBalance = order && (order.status === "shipped" || order.status === "delivered") 
          ? (cleanUpdateData as any).totalAmount - invoice.totalPaid
          : 0; // Only outstanding if order is shipped or delivered
        
        let newStatus: "unpaid" | "partially_paid" | "paid";
        if (newOutstandingBalance === 0) newStatus = "paid";
        else if (invoice.totalPaid > 0) newStatus = "partially_paid";
        else newStatus = "unpaid";
        
        await ctx.db.patch(invoice._id, {
          amount: (cleanUpdateData as any).totalAmount,
          outstandingBalance: newOutstandingBalance,
          status: newStatus,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

// Delete order
export const deleteOrder = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    // Delete order items
    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    
    for (const item of orderItems) {
      await ctx.db.delete(item._id);
    }

    // Delete invoice if it exists
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    if (invoice) {
      await ctx.db.delete(invoice._id);
    }

    // Delete delivery if it exists
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    if (delivery) {
      await ctx.db.delete(delivery._id);
    }

    // Get order details before deletion for logging
    const order = await ctx.db.get(args.orderId);
    const client = order ? await ctx.db.get(order.clientId) : null;
    
    // Delete the order
    await ctx.db.delete(args.orderId);
    
    // Create detailed log message
    const orderDetails = order ? `${order.orderNumber} - ${order.totalAmount} ${order.currency}` : String(args.orderId);
    const clientName = client ? ` from ${client.name}` : '';
    const logMessage = `Order deleted: ${orderDetails}${clientName}`;
    
    await logOrderEvent(ctx, { entityId: String(args.orderId), action: "delete", message: logMessage });

    return { success: true };
  },
});

// Migration function to add invoice numbers to existing orders
export const migrateInvoiceNumbers = mutation({
  args: {},
  handler: async (ctx, args) => {
    // Get all orders without invoice numbers
    const orders = await ctx.db.query("orders").collect();
    const ordersWithoutInvoiceNumbers = orders.filter(order => !order.invoiceNumber);
    
    let updatedCount = 0;
    
    for (const order of ordersWithoutInvoiceNumbers) {
      // Generate a unique invoice number
      const year = new Date(order.createdAt).getFullYear();
      const timestamp = order.createdAt.toString().slice(-6);
      const invoiceNumber = `INV-${year}-${timestamp}`;
      
      // Check if this invoice number already exists
      const existingOrder = await ctx.db
        .query("orders")
        .withIndex("by_invoice_number", q => q.eq("invoiceNumber", invoiceNumber))
        .first();
      
      if (!existingOrder) {
        // Update the order with the invoice number
        await ctx.db.patch(order._id, {
          invoiceNumber: invoiceNumber,
          updatedAt: Date.now(),
        });
        
        // Also update the corresponding invoice if it exists
        const invoice = await ctx.db
          .query("invoices")
          .withIndex("by_order", q => q.eq("orderId", order._id))
          .first();
        
        if (invoice) {
          await ctx.db.patch(invoice._id, {
            invoiceNumber: invoiceNumber,
            updatedAt: Date.now(),
          });
        }
        
        updatedCount++;
      }
    }
    
    return { updatedCount, totalOrders: ordersWithoutInvoiceNumbers.length };
  },
});

// Utility function to check and resolve invoice number conflicts
export const checkInvoiceNumberConflicts = mutation({
  args: {},
  handler: async (ctx, args) => {
    // Get all orders with invoice numbers
    const orders = await ctx.db.query("orders").collect();
    const ordersWithInvoiceNumbers = orders.filter(order => order.invoiceNumber);
    
    // Find duplicates
    const invoiceNumberCounts: Record<string, number> = {};
    ordersWithInvoiceNumbers.forEach(order => {
      if (order.invoiceNumber) {
        invoiceNumberCounts[order.invoiceNumber] = (invoiceNumberCounts[order.invoiceNumber] || 0) + 1;
      }
    });
    
    const duplicates = Object.entries(invoiceNumberCounts)
      .filter(([_, count]) => (count as number) > 1)
      .map(([invoiceNumber, count]) => ({ invoiceNumber, count: count as number }));
    
    // Resolve duplicates by updating them with unique numbers
    let resolvedCount = 0;
    for (const duplicate of duplicates) {
      const conflictingOrders = ordersWithInvoiceNumbers.filter(
        order => order.invoiceNumber === duplicate.invoiceNumber
      );
      
      // Keep the first one, update the rest
      for (let i = 1; i < conflictingOrders.length; i++) {
        const order = conflictingOrders[i];
        const newInvoiceNumber = `${duplicate.invoiceNumber}-${i}`;
        
        await ctx.db.patch(order._id, {
          invoiceNumber: newInvoiceNumber,
          updatedAt: Date.now(),
        });
        
        // Also update the corresponding invoice
        const invoice = await ctx.db
          .query("invoices")
          .withIndex("by_order", q => q.eq("orderId", order._id))
          .first();
        
        if (invoice) {
          await ctx.db.patch(invoice._id, {
            invoiceNumber: newInvoiceNumber,
            updatedAt: Date.now(),
          });
        }
        
        resolvedCount++;
      }
    }
    
    return {
      duplicates,
      resolvedCount,
      totalOrdersWithInvoiceNumbers: ordersWithInvoiceNumbers.length
    };
  },
});

// Clear all invoice numbers (for testing purposes)
export const clearAllInvoiceNumbers = mutation({
  args: {},
  handler: async (ctx, args) => {
    // Clear invoice numbers from all orders
    const orders = await ctx.db.query("orders").collect();
    let updatedOrders = 0;
    
    for (const order of orders) {
      await ctx.db.patch(order._id, {
        invoiceNumber: undefined,
        updatedAt: Date.now(),
      });
      updatedOrders++;
    }
    
    // Clear invoice numbers from all invoices
    const invoices = await ctx.db.query("invoices").collect();
    let updatedInvoices = 0;
    
    for (const invoice of invoices) {
      await ctx.db.patch(invoice._id, {
        invoiceNumber: undefined,
        updatedAt: Date.now(),
      });
      updatedInvoices++;
    }
    
    return { updatedOrders, updatedInvoices };
  },
});

// List all order items
export const listItems = query({
  args: {},
  handler: async (ctx, args) => {
    const orderItems = await ctx.db.query("orderItems").collect();
    return orderItems;
  },
});