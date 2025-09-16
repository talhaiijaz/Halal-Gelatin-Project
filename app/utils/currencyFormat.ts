/**
 * Centralized currency formatting utilities
 * Provides consistent currency formatting across the entire application
 */

export type SupportedCurrency = 'USD' | 'PKR' | 'EUR' | 'AED';

export interface CurrencyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showSymbol?: boolean;
}

/**
 * Format a number as currency with proper locale support
 * @param amount - The amount to format
 * @param currency - The currency code (USD, PKR, EUR, AED)
 * @param options - Additional formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number, 
  currency: SupportedCurrency = 'USD',
  options: CurrencyFormatOptions = {}
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    showSymbol = true
  } = options;

  // Handle EUR specially to ensure symbol appears before number
  if (currency === 'EUR') {
    const formatted = new Intl.NumberFormat('en-DE', {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
    return showSymbol ? `€${formatted}` : formatted;
  }
  
  // Use appropriate locale based on currency
  const locale = currency === 'USD' ? 'en-US' : 
                 currency === 'PKR' ? 'en-PK' : 
                 currency === 'AED' ? 'en-AE' : 'en-US';
  
  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

/**
 * Format currency with 2 decimal places (for precise amounts)
 * @param amount - The amount to format
 * @param currency - The currency code
 * @returns Formatted currency string with 2 decimal places
 */
export function formatCurrencyPrecise(
  amount: number, 
  currency: SupportedCurrency = 'USD'
): string {
  return formatCurrency(amount, currency, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format currency without symbol (for calculations or display where symbol is handled separately)
 * @param amount - The amount to format
 * @param currency - The currency code
 * @returns Formatted number string without currency symbol
 */
export function formatCurrencyNumber(
  amount: number, 
  currency: SupportedCurrency = 'USD'
): string {
  return formatCurrency(amount, currency, { showSymbol: false });
}

/**
 * Parse a currency string back to a number
 * @param currencyString - The formatted currency string
 * @returns The numeric value
 */
export function parseCurrency(currencyString: string): number {
  // Remove currency symbols and commas, then parse
  const cleanString = currencyString
    .replace(/[€$₹,]/g, '') // Remove common currency symbols
    .replace(/\s/g, '') // Remove spaces
    .trim();
  
  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get the appropriate currency for a client type
 * @param clientType - The client type ('local' or 'international')
 * @param defaultCurrency - Default currency to use if client type is not recognized
 * @returns The appropriate currency code
 */
export function getCurrencyForClientType(
  clientType: 'local' | 'international',
  defaultCurrency: SupportedCurrency = 'USD'
): SupportedCurrency {
  return clientType === 'local' ? 'PKR' : defaultCurrency;
}

/**
 * Validate if a currency code is supported
 * @param currency - The currency code to validate
 * @returns True if the currency is supported
 */
export function isValidCurrency(currency: string): currency is SupportedCurrency {
  return ['USD', 'PKR', 'EUR', 'AED'].includes(currency);
}

/**
 * Convert amount between currencies (requires exchange rate)
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @param exchangeRate - Exchange rate from source to target currency
 * @returns Converted amount in target currency
 */
export function convertCurrency(
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  exchangeRate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  return amount * exchangeRate;
}

/**
 * Calculate total from array of amounts
 * @param amounts - Array of amounts to sum
 * @returns Total amount
 */
export function calculateTotal(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + (amount || 0), 0);
}

/**
 * Format percentage
 * @param value - The percentage value (0-100)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
