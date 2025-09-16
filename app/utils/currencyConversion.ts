// Currency conversion utilities for banking system

export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  convertedAmountUSD?: number;
}

// Supported currencies in the system
export const SUPPORTED_CURRENCIES = ['USD', 'PKR', 'EUR', 'AED'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

// Currency symbols for display
export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  PKR: '₨',
  EUR: '€',
  AED: 'د.إ'
};

// Currency names for display
export const CURRENCY_NAMES: Record<SupportedCurrency, string> = {
  USD: 'US Dollar',
  PKR: 'Pakistani Rupee',
  EUR: 'Euro',
  AED: 'UAE Dirham'
};

/**
 * Convert amount from one currency to another using exchange rate
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): CurrencyConversion {
  if (fromCurrency === toCurrency) {
    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: amount,
      targetCurrency: toCurrency,
      exchangeRate: 1,
    };
  }

  const convertedAmount = amount * exchangeRate;
  
  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    convertedAmount,
    targetCurrency: toCurrency,
    exchangeRate,
  };
}

/**
 * Convert any currency to USD using exchange rate
 */
export function convertToUSD(
  amount: number,
  currency: string,
  exchangeRateToUSD: number
): number {
  if (currency === 'USD') {
    return amount;
  }
  return amount * exchangeRateToUSD;
}

/**
 * Get exchange rate description text
 */
export function getExchangeRateDescription(
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): string {
  if (fromCurrency === toCurrency) {
    return 'Same currency - no conversion needed';
  }
  return `1 ${fromCurrency} = ${exchangeRate.toFixed(4)} ${toCurrency}`;
}

/**
 * Format currency amount with proper symbol and formatting
 */
export function formatCurrencyAmount(
  amount: number,
  currency: string,
  options: {
    showSymbol?: boolean;
    decimals?: number;
  } = {}
): string {
  const { showSymbol = true, decimals = 2 } = options;
  
  const symbol = CURRENCY_SYMBOLS[currency as SupportedCurrency] || currency;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));
  
  if (showSymbol) {
    // For EUR, put symbol before the number
    if (currency === 'EUR') {
      return `${symbol}${formattedAmount}`;
    }
    // For other currencies, use standard formatting
    return `${symbol}${formattedAmount}`;
  }
  
  return `${formattedAmount} ${currency}`;
}

/**
 * Validate exchange rate for currency conversion
 */
export function validateExchangeRate(
  exchangeRate: number,
  fromCurrency: string,
  toCurrency: string
): { isValid: boolean; error?: string } {
  if (fromCurrency === toCurrency) {
    return { isValid: true };
  }
  
  if (exchangeRate <= 0) {
    return { 
      isValid: false, 
      error: 'Exchange rate must be greater than 0' 
    };
  }
  
  if (exchangeRate > 1000) {
    return { 
      isValid: false, 
      error: 'Exchange rate seems unusually high. Please verify.' 
    };
  }
  
  return { isValid: true };
}

/**
 * Get suggested exchange rates (for UI placeholders)
 */
export function getSuggestedExchangeRate(
  fromCurrency: string,
  toCurrency: string
): number | null {
  // These are rough estimates - in production, you'd fetch real-time rates
  const rates: Record<string, Record<string, number>> = {
    USD: {
      PKR: 280,
      EUR: 0.92,
      AED: 3.67,
    },
    PKR: {
      USD: 0.0036,
      EUR: 0.0033,
      AED: 0.013,
    },
    EUR: {
      USD: 1.09,
      PKR: 305,
      AED: 4.0,
    },
    AED: {
      USD: 0.27,
      PKR: 76,
      EUR: 0.25,
    },
  };
  
  return rates[fromCurrency]?.[toCurrency] || null;
}
