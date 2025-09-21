// Utility functions for order highlighting based on international bank transactions

export interface BankAccount {
  _id: string;
  country?: string;
  currency: string;
}

export interface Order {
  status: string;
  bankAccountId?: string;
}

/**
 * Check if an order should be highlighted yellow based on international bank transactions
 * @param order - The order object
 * @param bankAccount - The associated bank account (optional)
 * @returns boolean indicating if the order should be highlighted
 */
export function shouldHighlightOrderYellow(order: Order, bankAccount?: BankAccount): boolean {
  // Only highlight if order is shipped or delivered
  if (order.status !== "shipped" && order.status !== "delivered") {
    return false;
  }

  // If no bank account is associated, don't highlight
  if (!order.bankAccountId || !bankAccount) {
    return false;
  }

  // Highlight if bank country is not Pakistan (international banks)
  return bankAccount.country !== "Pakistan";
}

/**
 * Get the CSS classes for highlighting an order
 * @param shouldHighlight - Whether the order should be highlighted
 * @returns CSS class string for styling
 */
export function getOrderHighlightClasses(shouldHighlight: boolean): string {
  return shouldHighlight 
    ? "bg-yellow-50 border-yellow-200" 
    : "";
}

/**
 * Get the CSS classes for highlighting text in a highlighted order
 * @param shouldHighlight - Whether the order should be highlighted
 * @returns CSS class string for text styling
 */
export function getOrderTextHighlightClasses(shouldHighlight: boolean): string {
  return shouldHighlight 
    ? "text-gray-900" 
    : "";
}
