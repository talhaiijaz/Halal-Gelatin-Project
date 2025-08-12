// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Extended user profile data
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("sales"), v.literal("finance"), v.literal("operations")),
    createdAt: v.number(),
    lastLogin: v.optional(v.number()),
  })
    .index("by_email", ["email"]),

  // Clients table
  clients: defineTable({
    name: v.string(),
    contactPerson: v.string(),
    email: v.string(),
    phone: v.string(),
    address: v.string(),
    city: v.string(),
    country: v.string(),
    taxId: v.string(),
    type: v.union(v.literal("local"), v.literal("international")),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .searchIndex("search_name", {
      searchField: "name",
    }),

  // Orders table
  orders: defineTable({
    orderNumber: v.string(),
    clientId: v.id("clients"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    expectedDeliveryDate: v.number(),
    salesRepId: v.id("users"),
    totalAmount: v.number(), // Calculated from order items
    currency: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_order_number", ["orderNumber"])
    .index("by_sales_rep", ["salesRepId"]),

  // Order Items table
  orderItems: defineTable({
    orderId: v.id("orders"),
    product: v.string(),
    quantityKg: v.number(),
    unitPrice: v.number(),
    totalPrice: v.number(), // quantityKg * unitPrice
    notes: v.optional(v.string()),
  })
    .index("by_order", ["orderId"]),

  // Invoices table
  invoices: defineTable({
    invoiceNumber: v.string(),
    orderId: v.id("orders"),
    clientId: v.id("clients"),
    issueDate: v.number(),
    dueDate: v.number(),
    status: v.union(v.literal("draft"), v.literal("sent"), v.literal("due"), v.literal("partially_paid"), v.literal("paid"), v.literal("overdue")),
    amount: v.number(), // Same as order total
    currency: v.string(),
    totalPaid: v.number(),
    outstandingBalance: v.number(), // amount - totalPaid
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_invoice_number", ["invoiceNumber"]),

  // Payments table
  payments: defineTable({
    invoiceId: v.id("invoices"),
    amount: v.number(),
    currency: v.string(),
    paymentDate: v.number(),
    method: v.union(v.literal("bank_transfer"), v.literal("check"), v.literal("cash"), v.literal("credit_card"), v.literal("other")),
    reference: v.string(),
    notes: v.optional(v.string()),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_date", ["paymentDate"]),

  // Deliveries table
  deliveries: defineTable({
    orderId: v.id("orders"),
    carrier: v.string(),
    trackingNumber: v.optional(v.string()),
    shippedDate: v.optional(v.number()),
    deliveredDate: v.optional(v.number()),
    incoterms: v.string(), // FOB, CIF, EXW, etc.
    destination: v.string(),
    status: v.union(v.literal("preparing"), v.literal("shipped"), v.literal("in_transit"), v.literal("delivered")),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_status", ["status"]),

  // Bank Accounts table
  bankAccounts: defineTable({
    accountName: v.string(),
    bankName: v.string(),
    accountNumber: v.string(),
    currency: v.string(),
    accountType: v.union(v.literal("checking"), v.literal("savings"), v.literal("business")),
    status: v.union(v.literal("active"), v.literal("inactive")),
    openingBalance: v.number(),
    currentBalance: v.number(), // Calculated from transactions
    createdAt: v.number(),
  })
    .index("by_currency", ["currency"])
    .index("by_status", ["status"]),

  // Transactions table
  transactions: defineTable({
    bankAccountId: v.id("bankAccounts"),
    type: v.union(
      v.literal("deposit"),
      v.literal("withdrawal"),
      v.literal("payment"),
      v.literal("receipt"),
      v.literal("fee"),
      v.literal("transfer_in"),
      v.literal("transfer_out")
    ),
    amount: v.number(),
    currency: v.string(),
    transactionDate: v.number(),
    reference: v.string(),
    description: v.string(),
    invoiceId: v.optional(v.id("invoices")), // Optional link to invoice
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_account", ["bankAccountId"])
    .index("by_type", ["type"])
    .index("by_date", ["transactionDate"])
    .index("by_invoice", ["invoiceId"]),
});