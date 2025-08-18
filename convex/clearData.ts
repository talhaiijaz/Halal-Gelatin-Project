import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Clear all data from all tables
export const clearAllData = mutation({
  args: {},
  returns: v.object({
    deletedCounts: v.object({
      users: v.number(),
      clients: v.number(),
      orders: v.number(),
      orderItems: v.number(),
      invoices: v.number(),
      payments: v.number(),
      deliveries: v.number(),
      bankAccounts: v.number(),
    }),
  }),
  handler: async (ctx) => {
    // Delete all data from all tables
    const deletedCounts = {
      users: 0,
      clients: 0,
      orders: 0,
      orderItems: 0,
      invoices: 0,
      payments: 0,
      deliveries: 0,
      bankAccounts: 0,
    };



    // Delete payments (they reference invoices)
    const payments = await ctx.db.query("payments").collect();
    for (const payment of payments) {
      await ctx.db.delete(payment._id);
      deletedCounts.payments++;
    }

    // Delete invoices (they reference orders)
    const invoices = await ctx.db.query("invoices").collect();
    for (const invoice of invoices) {
      await ctx.db.delete(invoice._id);
      deletedCounts.invoices++;
    }

    // Delete deliveries (they reference orders)
    const deliveries = await ctx.db.query("deliveries").collect();
    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
      deletedCounts.deliveries++;
    }

    // Delete order items (they reference orders)
    const orderItems = await ctx.db.query("orderItems").collect();
    for (const item of orderItems) {
      await ctx.db.delete(item._id);
      deletedCounts.orderItems++;
    }

    // Delete orders (they reference clients)
    const orders = await ctx.db.query("orders").collect();
    for (const order of orders) {
      await ctx.db.delete(order._id);
      deletedCounts.orders++;
    }

    // Delete clients
    const clients = await ctx.db.query("clients").collect();
    for (const client of clients) {
      await ctx.db.delete(client._id);
      deletedCounts.clients++;
    }

    // Delete bank accounts
    const bankAccounts = await ctx.db.query("bankAccounts").collect();
    for (const account of bankAccounts) {
      await ctx.db.delete(account._id);
      deletedCounts.bankAccounts++;
    }

    // Delete users (keep at least one admin user)
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
      deletedCounts.users++;
    }

    return { deletedCounts };
  },
});
