import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Backfill missing fiscalYear on orders using createdAt (or orderCreationDate if present)
export const backfillFiscalYear = mutation({
  args: {},
  returns: v.object({ updated: v.number(), totalMissing: v.number() }),
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    const missing = orders.filter(o => o.fiscalYear === undefined || o.fiscalYear === null);

    let updated = 0;
    for (const order of missing) {
      const timestamp = (order as any).orderCreationDate ?? order.createdAt;
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11, July = 6
      const fiscalYear = month >= 6 ? year : year - 1;
      await ctx.db.patch(order._id, { fiscalYear, updatedAt: Date.now() });
      updated++;
    }

    return { updated, totalMissing: missing.length };
  },
});

// Seed deliveries for orders that are shipped/in_transit/delivered but lack a delivery record
export const seedDeliveriesFromOrders = mutation({
  args: {},
  returns: v.object({ created: v.number(), examined: v.number() }),
  handler: async (ctx) => {
    const targetStatuses = new Set(["shipped", "in_transit", "delivered"]);
    const orders = await ctx.db.query("orders").collect();
    const candidates = orders.filter(o => targetStatuses.has(o.status as any));

    let created = 0;
    for (const order of candidates) {
      // Skip if a delivery already exists
      const existing = await ctx.db
        .query("deliveries")
        .withIndex("by_order", q => q.eq("orderId", order._id))
        .first();
      if (existing) continue;

      const client = await ctx.db.get(order.clientId);
      const destinationParts = [client?.city, client?.country].filter(Boolean);
      const destination = destinationParts.join(", ") || "Unknown";

      // Choose scheduled date heuristically
      const scheduledDate = (order as any).estimatedArrivalDate
        || (order as any).estimatedDepartureDate
        || (order as any).orderCreationDate
        || order.createdAt;

      await ctx.db.insert("deliveries", {
        orderId: order._id,
        carrier: (order as any).shippingCompany || "Unknown",
        trackingNumber: (order as any).shippingOrderNumber || undefined,
        address: undefined,
        scheduledDate,
        shippedDate: order.status !== "pending" ? order.updatedAt : undefined,
        deliveredDate: order.status === "delivered" ? Date.now() : undefined,
        incoterms: "FOB",
        destination,
        status: (order.status as any) === "shipped" ? "in_transit" : (order.status as any),
        notes: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      created++;
    }

    return { created, examined: candidates.length };
  },
});

// Migration to update invoice statuses to the new simplified system
export const migrateInvoiceStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    let updatedCount = 0;

    for (const invoice of invoices) {
      let newStatus: "unpaid" | "partially_paid" | "paid";

      // Determine new status based on payment information
      if (invoice.outstandingBalance === 0) {
        newStatus = "paid";
      } else if (invoice.totalPaid > 0) {
        newStatus = "partially_paid";
      } else {
        newStatus = "unpaid";
      }

      // Update the invoice status
      await ctx.db.patch(invoice._id, {
        status: newStatus,
        updatedAt: Date.now(),
      });
      updatedCount++;
    }

    return { updatedCount };
  },
});

// Initialize default application settings
export const initializeSettings = mutation({
  args: {},
  returns: v.object({ created: v.number() }),
  handler: async (ctx) => {
    const defaults = [
      {
        key: "monthlyShipmentLimit",
        value: 150000,
        description: "Maximum allowed shipment quantity per month (in kg)",
        category: "shipments",
      },
    ];
    
    let created = 0;
    for (const setting of defaults) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", setting.key))
        .first();
      
      if (!existing) {
        await ctx.db.insert("settings", {
          ...setting,
          updatedAt: Date.now(),
        });
        created++;
      }
    }
    
    return { created };
  },
});

// Migration to remove balance fields from bank accounts
export const migrateRemoveBankBalances = mutation({
  args: {},
  handler: async (ctx) => {
    const bankAccounts = await ctx.db.query("bankAccounts").collect();
    let updatedCount = 0;

    for (const account of bankAccounts) {
      // Remove balance fields by patching with only the fields we want to keep
      await ctx.db.patch(account._id, {
        accountName: account.accountName,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        currency: account.currency,
        accountType: account.accountType,
        status: account.status,
        createdAt: account.createdAt,
      });
      updatedCount++;
    }

    return { updatedCount };
  },
});

// Migration to delete problematic bank account
export const deleteProblematicBankAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const bankAccount = await ctx.db.get("j57cnn373qwp3m5gwnnyqmzs417nxbx4" as any);
    if (bankAccount) {
      await ctx.db.delete("j57cnn373qwp3m5gwnnyqmzs417nxbx4" as any);
      return { deleted: true };
    }
    return { deleted: false };
  },
});

// Migration to convert any existing numeric bloom values to strings
export const migrateBloomValues = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all order items
    const orderItems = await ctx.db.query("orderItems").collect();
    
    let migratedCount = 0;
    
    for (const item of orderItems) {
      // If bloom is a number, convert it to string
      if (item.bloom !== undefined && typeof item.bloom === 'number') {
        await ctx.db.patch(item._id, {
          bloom: (item.bloom as number).toString()
        });
        migratedCount++;
      }
    }
    
    console.log(`Migrated ${migratedCount} bloom values from number to string`);
    return { migratedCount };
  },
});


