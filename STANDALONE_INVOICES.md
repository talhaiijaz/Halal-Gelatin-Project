# Standalone Invoices Feature

## Overview

The standalone invoices feature allows you to create invoices for clients without requiring an associated order. This is particularly useful for:

- Outstanding balances from previous platforms
- Manual adjustments
- One-off charges or credits
- Legacy invoice imports

## How to Use

### Creating a Standalone Invoice

1. **Navigate to Client Detail Page**
   - Go to Clients → Select a client
   - Scroll down to the "Standalone Invoices" section

2. **Click "Add Invoice"**
   - This opens the Create Standalone Invoice modal

3. **Fill in the Form**
   - **Invoice Number**: Unique identifier (e.g., INV-2024-001)
   - **Amount**: Invoice amount
   - **Currency**: Select appropriate currency
   - **Issue Date**: When the invoice was issued (optional, defaults to today)
   - **Due Date**: Payment due date (optional, defaults to 30 days from issue)
   - **Source**: Select the source of this invoice
     - "Previous Platform" - for outstanding balances from old system
     - "Current System" - for manual entries in current system
     - "Manual Entry" - for other manual adjustments
   - **Notes**: Additional information about the invoice

4. **Click "Create Invoice"**

### Viewing Standalone Invoices

- Standalone invoices appear in the client detail page under "Standalone Invoices"
- They show:
  - Invoice number
  - Issue date
  - Source
  - Amount
  - Payment status
  - Outstanding balance (if any)

### Payment Processing

- Standalone invoices work exactly like regular invoices for payments
- You can record payments against them using the existing payment system
- Outstanding balances are automatically calculated and included in client totals

## Technical Details

### Database Schema Changes

- `invoices.orderId` is now optional
- Added `isStandalone` boolean field
- Added `source` string field for tracking invoice origin

### Outstanding Balance Calculations

- Standalone invoices are always included in outstanding balance calculations
- Regular order-based invoices are only included when their orders are "shipped" or "delivered"
- This ensures standalone invoices (like legacy balances) are always visible for collection

### Integration Points

- **Client Detail Page**: Shows standalone invoices alongside orders
- **Finance Reports**: Include standalone invoices in all financial calculations
- **Payment System**: Full integration with existing payment recording
- **Audit Trail**: All standalone invoice actions are logged

## Migration from Previous Platform

To migrate outstanding balances from a previous platform:

1. Create a standalone invoice for each outstanding amount
2. Use "Previous Platform" as the source
3. Set the original issue date if known
4. Add notes about the original transaction

Example:
- Invoice Number: LEGACY-001
- Amount: $5,000.00
- Source: Previous Platform
- Notes: "Outstanding balance from Q4 2023 order #12345"

## Best Practices

1. **Invoice Numbering**: Use a clear prefix for standalone invoices (e.g., LEGACY-, ADJ-, etc.)
2. **Source Tracking**: Always select the appropriate source for audit purposes
3. **Documentation**: Use the notes field to explain the purpose of the invoice
4. **Date Accuracy**: Set accurate issue dates for proper aging reports

## Troubleshooting

### Common Issues

1. **Invoice Number Already Exists**
   - Ensure each invoice number is unique across the entire system
   - Use a consistent naming convention

2. **Outstanding Balance Not Showing**
   - Check that the invoice status is not "paid"
   - Verify the amount is greater than total payments

3. **Payment Not Recording**
   - Ensure the invoice exists and is not deleted
   - Check that the payment amount doesn't exceed outstanding balance

### Support

If you encounter issues with standalone invoices, check:
1. The audit log for the invoice creation
2. The client's total outstanding balance calculation
3. Any error messages in the browser console





