// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Extended user profile data
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("sales"), v.literal("finance"), v.literal("operations"), v.literal("user")),
    createdAt: v.number(),
    lastLogin: v.optional(v.number()),
  })
    .index("by_email", ["email"]),

  // Clients table
  clients: defineTable({
    name: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    taxId: v.optional(v.string()),
    type: v.union(v.literal("local"), v.literal("international")),
    status: v.union(v.literal("active"), v.literal("inactive")),
    // Profile picture
    profilePictureId: v.optional(v.id("_storage")),
    // Historical outstanding balance from previous years (used in finance and payments flows)
    outstandingBalance: v.optional(v.number()),
    approvalStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    approvalNotes: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .searchIndex("search_name", {
      searchField: "name",
    }),

  // Orders table
  orders: defineTable({
    orderNumber: v.string(), // Internal use only
    invoiceNumber: v.string(), // Required - main identifier for tracking
    clientId: v.id("clients"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    expectedDeliveryDate: v.optional(v.number()),
    deliveryDate: v.optional(v.number()), // Actual delivery date when order is delivered
    salesRepId: v.optional(v.id("users")),
    totalAmount: v.number(), // Calculated from order items
    freightCost: v.optional(v.number()), // Freight/shipping cost
    currency: v.string(),
    notes: v.optional(v.string()),
    fiscalYear: v.optional(v.number()), // Fiscal year when the order was created
    // Timeline fields
    orderCreationDate: v.optional(v.number()),
    factoryDepartureDate: v.optional(v.number()),
    estimatedDepartureDate: v.optional(v.number()),
    estimatedArrivalDate: v.optional(v.number()),
    timelineNotes: v.optional(v.string()),
    // Shipment information
    shipmentMethod: v.optional(v.union(v.literal("air"), v.literal("sea"), v.literal("road"), v.literal("train"))),
    shippingCompany: v.optional(v.string()),
    shippingOrderNumber: v.optional(v.string()),
    // Document attachments
    packingListId: v.optional(v.id("_storage")),
    proformaInvoiceId: v.optional(v.id("_storage")),
    commercialInvoiceId: v.optional(v.id("_storage")),
    approvalStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_order_number", ["orderNumber"])
    .index("by_invoice_number", ["invoiceNumber"]),

  // Order Items table
  orderItems: defineTable({
    orderId: v.id("orders"),
    product: v.string(),
    // Product specifications
    bloom: v.optional(v.string()),
    mesh: v.optional(v.number()),
    lotNumbers: v.optional(v.array(v.string())),
    quantityKg: v.number(),
    unitPrice: v.number(),
    exclusiveValue: v.optional(v.number()), // quantityKg * unitPrice (before GST)
    gstRate: v.optional(v.number()), // GST percentage
    gstAmount: v.optional(v.number()), // GST amount
    inclusiveTotal: v.optional(v.number()), // Total including GST
    totalPrice: v.number(), // Legacy field for backward compatibility (same as inclusiveTotal)
    notes: v.optional(v.string()),
    // Discount fields
    discountType: v.optional(v.union(v.literal("amount"), v.literal("percentage"))),
    discountValue: v.optional(v.number()), // Amount or percentage value
    discountAmount: v.optional(v.number()), // Calculated discount amount
  })
    .index("by_order", ["orderId"]),

  // Shipment Schedules table
  shipmentSchedules: defineTable({
    month: v.string(), // e.g., "Jun-25", "Jul-25"
    bloom: v.string(), // e.g., "160-180", "200-220", "220-240", "240-260", "250-270"
    clientQuantities: v.record(v.string(), v.number()), // Client name -> quantity mapping
    partyName: v.optional(v.string()),
    partyType: v.optional(v.string()),
    totalQty: v.number(), // Total quantity for this bloom range
    totalByBloom: v.record(v.string(), v.number()), // Bloom range -> total quantity mapping
    fiscalYear: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_month_and_bloom", ["month", "bloom"])
    .index("by_fiscal_year", ["fiscalYear"])
    .index("by_month", ["month"]),

  // Invoices table
  invoices: defineTable({
    invoiceNumber: v.optional(v.string()), // Unique invoice number (e.g., INV-2025-0001)
    orderId: v.id("orders"),
    clientId: v.id("clients"),
    issueDate: v.number(),
    dueDate: v.number(),
    status: v.union(v.literal("unpaid"), v.literal("partially_paid"), v.literal("paid")),
    amount: v.number(), // Same as order total
    currency: v.string(),
    totalPaid: v.number(),
    outstandingBalance: v.number(), // amount - totalPaid
    notes: v.optional(v.string()),
    approvalStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_invoice_number", ["invoiceNumber"]),

  // Payments table
  payments: defineTable({
    // Either linked to an invoice or recorded as an advance against a client
    type: v.union(v.literal("invoice"), v.literal("advance")),
    invoiceId: v.optional(v.id("invoices")),
    clientId: v.id("clients"),
    amount: v.number(),
    currency: v.string(),
    paymentDate: v.number(),
    method: v.union(
      v.literal("bank_transfer"),
      v.literal("check"),
      v.literal("cash"),
      v.literal("credit_card"),
      v.literal("other")
    ),
    reference: v.string(),
    notes: v.optional(v.string()),
    bankAccountId: v.optional(v.id("bankAccounts")), // Link to bank account for bank transfers
    // Multi-currency conversion support
    conversionRateToUSD: v.optional(v.number()), // Required for non-USD international payments
    convertedAmountUSD: v.optional(v.number()), // Calculated amount in USD for dashboard
    // Withholding support (for local clients)
    cashReceived: v.optional(v.number()), // Net cash deposited to bank (amount - withheld)
    withheldTaxRate: v.optional(v.number()), // Percentage rate e.g., 5 for 5%
    withheldTaxAmount: v.optional(v.number()), // Calculated from cashReceived * rate / 100
    recordedBy: v.optional(v.id("users")),
    approvalStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    createdAt: v.number(),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_date", ["paymentDate"])
    .index("by_bank_account", ["bankAccountId"])
    .index("by_client", ["clientId"]),

  // Deliveries table
  deliveries: defineTable({
    orderId: v.id("orders"),
    carrier: v.string(),
    trackingNumber: v.optional(v.string()),
    // New optional fields to align with UI usage
    address: v.optional(v.string()),
    scheduledDate: v.optional(v.number()),
    shippedDate: v.optional(v.number()),
    deliveredDate: v.optional(v.number()),
    incoterms: v.string(), // FOB, CIF, EXW, etc.
    destination: v.string(),
    // Extend statuses to match UI while keeping legacy values for compatibility
    status: v.union(
      v.literal("pending"),        // UI expects "pending"
      v.literal("preparing"),      // legacy value
      v.literal("shipped"),        // legacy value
      v.literal("in_transit"),
      v.literal("delivered"),
      v.literal("failed")          // UI expects "failed"
    ),
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
    approvalStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    createdAt: v.number(),
  })
    .index("by_currency", ["currency"])
    .index("by_status", ["status"]),

  // Audit Logs table
  logs: defineTable({
    entityTable: v.string(), // e.g., "orders", "clients", "invoices", "payments", "banks"
    entityId: v.string(), // stringified id for cross-table reference
    action: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
    message: v.string(),
    metadata: v.optional(v.any()),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityTable", "entityId"]) 
    .index("by_createdAt", ["createdAt"]),

  // User Feedback table
  feedback: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("bug_report"),
      v.literal("feature_request"),
      v.literal("improvement"),
      v.literal("general_feedback")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("rejected")
    ),
    submittedBy: v.string(), // User name or identifier
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_priority", ["priority"])
    .index("by_createdAt", ["createdAt"]),

  // Application Settings table
  settings: defineTable({
    key: v.string(), // Setting key (e.g., "monthlyShipmentLimit")
    value: v.union(v.string(), v.number(), v.boolean()), // Setting value
    description: v.optional(v.string()), // Human-readable description
    category: v.optional(v.string()), // Setting category (e.g., "shipments", "finance")
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()), // User who last updated this setting
  })
    .index("by_key", ["key"])
    .index("by_category", ["category"]),
});