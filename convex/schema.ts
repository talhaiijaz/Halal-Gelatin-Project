// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Extended user profile data
      users: defineTable({
        email: v.string(),
        name: v.string(),
        role: v.union(v.literal("super-admin"), v.literal("admin"), v.literal("production")),
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
    // Bank account for payment processing
    bankAccountId: v.optional(v.id("bankAccounts")),
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
    orderId: v.optional(v.id("orders")), // Optional for standalone invoices
    clientId: v.id("clients"),
    issueDate: v.number(),
    dueDate: v.optional(v.number()),
    status: v.union(v.literal("unpaid"), v.literal("partially_paid"), v.literal("paid")),
    amount: v.number(), // Same as order total
    currency: v.string(),
    totalPaid: v.number(),
    outstandingBalance: v.number(), // amount - totalPaid
    notes: v.optional(v.string()),
    // Standalone invoice fields
    isStandalone: v.optional(v.boolean()), // True for invoices created without orders
    source: v.optional(v.string()), // "previous_platform", "current_system", etc.
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_invoice_number", ["invoiceNumber"])
    .index("by_standalone", ["isStandalone"]),

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
    // Reversal support
    isReversed: v.optional(v.boolean()),
    reversalReason: v.optional(v.string()),
    reversedAt: v.optional(v.number()),
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
    accountType: v.optional(v.union(v.literal("business"), v.literal("personal"))), // Account type
    currency: v.string(),
    country: v.optional(v.string()), // Country where the bank is located
    openingBalance: v.optional(v.number()), // Opening balance when bank account is created
    currentBalance: v.optional(v.number()), // Current balance (calculated from all transactions)
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
  })
    .index("by_currency", ["currency"])
    .index("by_status", ["status"]),

  // Bank Transactions table - comprehensive banking system
  bankTransactions: defineTable({
    bankAccountId: v.id("bankAccounts"),
    transactionType: v.union(
      v.literal("deposit"),           // Money coming in
      v.literal("withdrawal"),        // Money going out
      v.literal("transfer_in"),       // Transfer from another account
      v.literal("transfer_out"),      // Transfer to another account
      v.literal("payment_received"),  // Payment from customer (linked to payment)
      v.literal("fee"),               // Bank fees
      v.literal("interest"),          // Interest earned
      v.literal("adjustment")         // Manual adjustments
    ),
    amount: v.number(), // Positive for deposits, negative for withdrawals
    currency: v.string(),
    description: v.string(), // Transaction description
    reference: v.optional(v.string()), // Reference number or check number
    // Link to related entities
    paymentId: v.optional(v.id("payments")), // If this is from a customer payment
    relatedBankAccountId: v.optional(v.id("bankAccounts")), // For transfers
    interBankTransferId: v.optional(v.id("interBankTransfers")), // Link to inter-bank transfer record
    // Currency conversion support for transfers between different currencies
    originalAmount: v.optional(v.number()), // Original amount before conversion
    originalCurrency: v.optional(v.string()), // Original currency before conversion
    exchangeRate: v.optional(v.number()), // Exchange rate used for conversion (1 originalCurrency = ? targetCurrency)
    convertedAmountUSD: v.optional(v.number()), // Amount converted to USD for reporting
    // Tax deduction fields for inter-bank transfers
    hasTaxDeduction: v.optional(v.boolean()), // Whether tax was deducted
    taxDeductionRate: v.optional(v.number()), // Tax deduction percentage (e.g., 5 for 5%)
    taxDeductionAmount: v.optional(v.number()), // Tax deduction amount
    taxDeductionCurrency: v.optional(v.string()), // Currency of tax deduction
    netAmountReceived: v.optional(v.number()), // Amount actually received after tax deduction
    // Transaction details
    transactionDate: v.number(),
    effectiveDate: v.optional(v.number()), // When transaction actually takes effect
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
    // Additional metadata
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())), // For categorization
    recordedBy: v.optional(v.id("users")),
    // Reversal support
    isReversed: v.optional(v.boolean()), // If this transaction has been reversed
    reversalReason: v.optional(v.string()), // Reason for reversal
    reversedAt: v.optional(v.number()), // When the transaction was reversed
    linkedTransactionId: v.optional(v.id("bankTransactions")), // For linking transfer_in/out pairs or reversal link
    createdAt: v.number(),
  })
    .index("by_bank_account", ["bankAccountId"])
    .index("by_transaction_type", ["transactionType"])
    .index("by_date", ["transactionDate"])
    .index("by_status", ["status"])
    .index("by_payment", ["paymentId"])
    .index("by_bank_and_date", ["bankAccountId", "transactionDate"]),

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

  // Inter-bank Transfers table
  interBankTransfers: defineTable({
    fromBankAccountId: v.id("bankAccounts"), // Source bank account
    toBankAccountId: v.id("bankAccounts"),   // Destination bank account
    amount: v.number(),                      // Transfer amount (converted amount)
    currency: v.string(),                    // Currency of transfer (destination currency)
    originalAmount: v.optional(v.number()),  // Original amount before conversion
    originalCurrency: v.optional(v.string()), // Original currency before conversion
    exchangeRate: v.optional(v.number()),    // Exchange rate used for conversion
    invoiceId: v.optional(v.id("invoices")), // Optional invoice this transfer is for
    reference: v.optional(v.string()),       // Transfer reference number
    notes: v.optional(v.string()),           // Additional notes
    // Tax deduction fields
    hasTaxDeduction: v.optional(v.boolean()), // Whether tax was deducted
    taxDeductionRate: v.optional(v.number()), // Tax deduction percentage (e.g., 5 for 5%)
    taxDeductionAmount: v.optional(v.number()), // Tax deduction amount in destination currency
    taxDeductionCurrency: v.optional(v.string()), // Currency of tax deduction (usually destination currency)
    netAmountReceived: v.optional(v.number()), // Amount actually received after tax deduction
    status: v.union(
      v.literal("pending"),    // Transfer initiated but not completed
      v.literal("completed"),  // Transfer completed successfully
      v.literal("failed"),     // Transfer failed
      v.literal("cancelled")   // Transfer cancelled
    ),
    transferDate: v.optional(v.number()),    // When the transfer actually happened
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_from_bank", ["fromBankAccountId"])
    .index("by_to_bank", ["toBankAccountId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_status", ["status"])
    .index("by_date", ["transferDate"]),

  // Production Processing State table
  productionProcessing: defineTable({
    status: v.union(v.literal("uploading"), v.literal("processing"), v.literal("completed"), v.literal("error")),
    fileName: v.string(),
    progress: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    completedBatches: v.optional(v.array(v.id("productionBatches"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  // Outsource Processing State table
  outsourceProcessing: defineTable({
    status: v.union(v.literal("uploading"), v.literal("processing"), v.literal("completed"), v.literal("error")),
    fileName: v.string(),
    progress: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    completedBatches: v.optional(v.array(v.id("outsourceBatches"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  // Production Year Settings table
  productionYearSettings: defineTable({
    currentYear: v.number(), // The currently active year for production (legacy)
    currentFiscalYear: v.optional(v.string()), // The currently active fiscal year (e.g., "2025-26")
    availableYears: v.array(v.number()), // All available years (legacy)
    availableFiscalYears: v.optional(v.array(v.string())), // All available fiscal years (e.g., ["2025-26", "2026-27"])
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Production Batch Data table
  productionBatches: defineTable({
    batchNumber: v.number(), // Continuous batch number across all reports (1, 2, 3... 3000+) - UNIQUE
    serialNumber: v.string(), // SR number from the report (e.g., "SR #1", "SR #2")
    // Quality parameters
    viscosity: v.optional(v.number()),
    bloom: v.optional(v.number()),
    percentage: v.optional(v.number()),
    ph: v.optional(v.number()),
    conductivity: v.optional(v.number()),
    moisture: v.optional(v.number()),
    h2o2: v.optional(v.number()), // H2O2 content
    so2: v.optional(v.number()), // SO2 content
    color: v.optional(v.string()),
    clarity: v.optional(v.string()),
    odour: v.optional(v.string()),
    // Metadata
    sourceReport: v.optional(v.string()), // Original PDF filename
    reportDate: v.optional(v.number()), // Date when the report was generated
    fileId: v.optional(v.id("_storage")), // Storage ID for the original PDF file
    isUsed: v.optional(v.boolean()), // For future batch selection logic - tracks if batch has been used
    isOnHold: v.optional(v.boolean()), // If true, exclude from blending/optimizer
    usedInOrder: v.optional(v.string()), // Order number where this batch was used
    usedDate: v.optional(v.number()), // When this batch was used
    notes: v.optional(v.string()), // Additional notes
    // Year tracking for reset functionality
    year: v.optional(v.number()), // Year this batch belongs to (e.g., 2024, 2025) - legacy
    fiscalYear: v.optional(v.string()), // Fiscal year this batch belongs to (e.g., "2025-26", "2026-27")
    isActive: v.optional(v.boolean()), // Whether this batch is active (not reset)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batch_number", ["batchNumber"])
    .index("by_serial_number", ["serialNumber"])
    .index("by_source_report", ["sourceReport"])
    .index("by_is_used", ["isUsed"])
    .index("by_used_in_order", ["usedInOrder"])
    .index("by_viscosity_range", ["viscosity"])
    .index("by_bloom_range", ["bloom"])
    .index("by_year", ["year"])
    .index("by_year_and_active", ["year", "isActive"])
    .index("by_fiscal_year", ["fiscalYear"])
    .index("by_fiscal_year_and_active", ["fiscalYear", "isActive"]),

  // Outsource Batch Data table - batches from other companies/factories
  outsourceBatches: defineTable({
    batchNumber: v.number(), // Continuous batch number for outsource batches (1, 2, 3...)
    serialNumber: v.string(), // Serial number from the report
    // Quality parameters
    viscosity: v.optional(v.number()),
    bloom: v.optional(v.number()),
    percentage: v.optional(v.number()),
    ph: v.optional(v.number()),
    conductivity: v.optional(v.number()),
    moisture: v.optional(v.number()),
    h2o2: v.optional(v.number()), // H2O2 content
    so2: v.optional(v.number()), // SO2 content
    color: v.optional(v.string()),
    clarity: v.optional(v.string()),
    odour: v.optional(v.string()),
    // Metadata
    sourceReport: v.optional(v.string()), // Original PDF filename
    reportDate: v.optional(v.number()), // Date when the report was generated
    fileId: v.optional(v.id("_storage")), // Storage ID for the original PDF file
    isUsed: v.optional(v.boolean()), // For future batch selection logic - tracks if batch has been used
    isOnHold: v.optional(v.boolean()), // If true, exclude from blending/optimizer
    usedInOrder: v.optional(v.string()), // Order number where this batch was used
    usedDate: v.optional(v.number()), // When this batch was used
    notes: v.optional(v.string()), // Additional notes
    // Year tracking for reset functionality
    year: v.optional(v.number()), // Year this batch belongs to (e.g., 2024, 2025) - legacy
    fiscalYear: v.optional(v.string()), // Fiscal year this batch belongs to (e.g., "2025-26", "2026-27")
    isActive: v.optional(v.boolean()), // Whether this batch is active (not reset)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
        .index("by_batch_number", ["batchNumber"])
        .index("by_serial_number", ["serialNumber"])
        .index("by_source_report", ["sourceReport"])
    .index("by_is_used", ["isUsed"])
    .index("by_used_in_order", ["usedInOrder"])
    .index("by_viscosity_range", ["viscosity"])
    .index("by_bloom_range", ["bloom"])
    .index("by_year", ["year"])
    .index("by_year_and_active", ["year", "isActive"])
    .index("by_fiscal_year", ["fiscalYear"])
    .index("by_fiscal_year_and_active", ["fiscalYear", "isActive"]),

  // Batch Reset Records table - tracks when batch numbers were reset
  batchResetRecords: defineTable({
    year: v.number(), // Year the reset was for (legacy)
    fiscalYear: v.optional(v.string()), // Fiscal year the reset was for (e.g., "2025-26")
    resetDate: v.number(), // When the reset was performed
    resetBy: v.optional(v.id("users")), // User who performed the reset
    previousYearMaxBatch: v.number(), // Highest batch number from previous year
    newYearStartBatch: v.number(), // Starting batch number for new year (usually 1)
    notes: v.optional(v.string()), // Notes about the reset
    createdAt: v.number(),
  })
    .index("by_year", ["year"])
    .index("by_fiscal_year", ["fiscalYear"])
    .index("by_reset_date", ["resetDate"]),

  // Blends table - stores blend records
  blends: defineTable({
    lotNumber: v.string(), // Primary unique identifier (e.g., "HG-720-MFI-912-3")
    // Legacy fields kept optional for backward compatibility during migration
    blendNumber: v.optional(v.string()),
    serialNumber: v.number(), // SR number - sequential number assigned when blend is created
    date: v.number(), // Date when blend was created
    // Target specifications
    targetBloomMin: v.optional(v.number()), // Target bloom minimum
    targetBloomMax: v.optional(v.number()), // Target bloom maximum
    targetMeanBloom: v.optional(v.number()), // Target mean bloom (preferred average)
    bloomSelectionMode: v.optional(v.union(v.literal("target-range"), v.literal("high-low"), v.literal("random-average"))), // Bloom selection strategy
    targetMesh: v.optional(v.number()), // Target mesh size
    // Additional target parameters (optional)
    targetViscosity: v.optional(v.string()),
    targetPercentage: v.optional(v.string()),
    targetPh: v.optional(v.string()),
    targetConductivity: v.optional(v.string()),
    targetMoisture: v.optional(v.string()),
    targetH2o2: v.optional(v.string()),
    targetSo2: v.optional(v.string()),
    targetColor: v.optional(v.string()),
    targetClarity: v.optional(v.string()),
    targetOdour: v.optional(v.string()),
    // Blend results
    selectedBatches: v.array(v.object({
      batchId: v.union(v.id("productionBatches"), v.id("outsourceBatches")),
      batchNumber: v.number(),
      bags: v.number(), // Number of bags used from this batch
      bloom: v.optional(v.number()),
      viscosity: v.optional(v.number()),
      percentage: v.optional(v.number()),
      ph: v.optional(v.number()),
      conductivity: v.optional(v.number()),
      moisture: v.optional(v.number()),
      h2o2: v.optional(v.number()),
      so2: v.optional(v.number()),
      color: v.optional(v.string()),
      clarity: v.optional(v.string()),
      odour: v.optional(v.string()),
      isOutsource: v.optional(v.boolean()),
    })),
    // Calculated results
    totalBags: v.number(),
    totalWeight: v.number(), // Total weight in kg
    averageBloom: v.number(),
    averageViscosity: v.optional(v.number()),
    ct3AverageBloom: v.optional(v.number()), // CT3 average bloom calculation
    // Status and metadata
    status: v.union(v.literal("draft"), v.literal("completed")),
    notes: v.optional(v.string()),
    fiscalYear: v.optional(v.string()), // Fiscal year this blend belongs to
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_lot_number", ["lotNumber"])
    .index("by_serial_number", ["serialNumber"])
    .index("by_date", ["date"])
    .index("by_status", ["status"])
    .index("by_fiscal_year", ["fiscalYear"]),
});