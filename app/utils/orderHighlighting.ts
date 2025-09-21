// Utility functions for order highlighting based on international bank transactions

export interface BankAccount {
  _id: string;
  country?: string;
  currency: string;
}

export interface Order {
  status: string;
  bankAccountId?: string;
  _id?: string;
  factoryDepartureDate?: number;
}

export interface Invoice {
  _id: string;
  amount: number;
  currency: string;
  orderId?: string;
}

export interface TransferStatus {
  invoiceAmount: number;
  totalTransferredToPakistan: number;
  percentageTransferred: number;
  hasMetThreshold: boolean;
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

/**
 * Check if an order should be highlighted red (20+ days past factory departure)
 * @param order - The order object
 * @param bankAccount - The associated bank account (optional)
 * @param transferStatus - The transfer status for the associated invoice (optional)
 * @returns boolean indicating if the order should be highlighted red
 */
export function shouldHighlightOrderRed(
  order: Order, 
  bankAccount?: BankAccount, 
  transferStatus?: TransferStatus
): boolean {
  // Must be yellow first (international bank order)
  if (!shouldHighlightOrderYellowWithTransfers(order, bankAccount, transferStatus)) {
    return false;
  }

  // Must have factory departure date
  if (!order.factoryDepartureDate) {
    return false;
  }

  // Calculate days since factory departure
  const factoryDepartureDate = new Date(order.factoryDepartureDate);
  const currentDate = new Date();
  const daysSinceDeparture = Math.floor((currentDate.getTime() - factoryDepartureDate.getTime()) / (1000 * 60 * 60 * 24));

  // Red if 20+ days have passed and 70% transfer threshold not met
  return daysSinceDeparture >= 20 && (!transferStatus || !transferStatus.hasMetThreshold);
}

/**
 * Get the CSS classes for highlighting an order (yellow or red)
 * @param shouldHighlightYellow - Whether the order should be highlighted yellow
 * @param shouldHighlightRed - Whether the order should be highlighted red
 * @returns CSS class string for styling
 */
export function getOrderHighlightClassesWithRed(shouldHighlightYellow: boolean, shouldHighlightRed: boolean): string {
  if (shouldHighlightRed) {
    return "bg-red-50 border-red-200";
  }
  if (shouldHighlightYellow) {
    return "bg-yellow-50 border-yellow-200";
  }
  return "";
}

/**
 * Get the CSS classes for highlighting text in a highlighted order (yellow or red)
 * @param shouldHighlightYellow - Whether the order should be highlighted yellow
 * @param shouldHighlightRed - Whether the order should be highlighted red
 * @returns CSS class string for text styling
 */
export function getOrderTextHighlightClassesWithRed(shouldHighlightYellow: boolean, shouldHighlightRed: boolean): string {
  if (shouldHighlightRed || shouldHighlightYellow) {
    return "text-gray-900";
  }
  return "";
}

/**
 * Check if an order/invoice should be highlighted yellow based on transfer status
 * This is the enhanced version that considers 70% transfer threshold
 * @param order - The order object
 * @param bankAccount - The associated bank account (optional)
 * @param transferStatus - The transfer status for the associated invoice (optional)
 * @returns boolean indicating if the order should be highlighted
 */
export function shouldHighlightOrderYellowWithTransfers(
  order: Order, 
  bankAccount?: BankAccount, 
  transferStatus?: TransferStatus
): boolean {
  // Only highlight if order is shipped or delivered
  if (order.status !== "shipped" && order.status !== "delivered") {
    return false;
  }

  // If no bank account is associated, don't highlight
  if (!order.bankAccountId || !bankAccount) {
    return false;
  }

  // If bank country is Pakistan, don't highlight (domestic bank)
  if (bankAccount.country === "Pakistan") {
    return false;
  }

  // If we have transfer status and 70% has been transferred to Pakistan, don't highlight
  if (transferStatus && transferStatus.hasMetThreshold) {
    return false;
  }

  // Highlight if money is in international bank and hasn't been transferred to Pakistan
  return true;
}
