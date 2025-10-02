import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOrderAccess, getCurrentUser } from "./authUtils";

// List deliveries with optional filters and enrichment
export const list = query({
  args: {
    status: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Require order access
    await requireOrderAccess(ctx);
    let deliveries = await ctx.db.query("deliveries").order("desc").collect();

    if (args.status) {
      deliveries = deliveries.filter(d => d.status === args.status);
    }

    if (args.startDate) {
      deliveries = deliveries.filter(d => (d.createdAt || 0) >= args.startDate!);
    }
    if (args.endDate) {
      deliveries = deliveries.filter(d => (d.createdAt || 0) <= args.endDate!);
    }

    // Enrich with related order and client data
    const enriched = await Promise.all(
      deliveries.map(async (delivery) => {
        const order = await ctx.db.get(delivery.orderId);
        const client = order ? await ctx.db.get(order.clientId) : null;
        return {
          ...delivery,
          order: order
            ? { _id: order._id, orderNumber: order.orderNumber }
            : null,
          client: client
            ? { _id: client._id, name: client.name, type: client.type }
            : null,
        } as any;
      })
    );

    return enriched;
  },
});

// Get delivery statistics for header cards
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Require order access
    await requireOrderAccess(ctx);
    
    const deliveries = await ctx.db.query("deliveries").collect();
    const total = deliveries.length;
    const inTransit = deliveries.filter(d => d.status === "in_transit").length;
    const delivered = deliveries.filter(d => d.status === "delivered").length;
    const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

    return { total, inTransit, delivered, deliveryRate };
  },
});

// Update delivery status
export const updateStatus = mutation({
  args: {
    deliveryId: v.id("deliveries"),
    status: v.union(
      v.literal("pending"),
      v.literal("preparing"),
      v.literal("shipped"),
      v.literal("in_transit"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    // Require order access
    await requireOrderAccess(ctx);
    
    await ctx.db.patch(args.deliveryId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});


