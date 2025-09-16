/**
 * Centralized error handling utilities
 * Provides consistent error handling and user-friendly error messages across the application
 */

export interface AppError {
  message: string;
  type: 'validation' | 'network' | 'permission' | 'not_found' | 'duplicate' | 'unknown';
  originalError?: Error;
}

/**
 * Parse and categorize errors into user-friendly messages
 * @param error - The error to parse
 * @returns Formatted error information
 */
export function parseError(error: unknown): AppError {
  if (!error) {
    return {
      message: 'An unexpected error occurred',
      type: 'unknown'
    };
  }

  if (error instanceof Error) {
    const errorStr = error.message.toLowerCase();
    
    // Validation errors
    if (errorStr.includes('validation') || errorStr.includes('invalid') || errorStr.includes('required')) {
      return {
        message: 'Please check your input and try again. Make sure all required fields are filled correctly.',
        type: 'validation',
        originalError: error
      };
    }
    
    // Network/connection errors
    if (errorStr.includes('network') || errorStr.includes('connection') || errorStr.includes('timeout') || errorStr.includes('fetch')) {
      return {
        message: 'Network connection error. Please check your internet connection and try again.',
        type: 'network',
        originalError: error
      };
    }
    
    // Permission/authorization errors
    if (errorStr.includes('permission') || errorStr.includes('unauthorized') || errorStr.includes('forbidden')) {
      return {
        message: 'You don\'t have permission to perform this action. Please contact your administrator.',
        type: 'permission',
        originalError: error
      };
    }
    
    // Not found errors
    if (errorStr.includes('not found') || errorStr.includes('doesn\'t exist') || errorStr.includes('missing')) {
      return {
        message: 'The requested resource was not found. It may have been deleted or moved.',
        type: 'not_found',
        originalError: error
      };
    }
    
    // Duplicate errors
    if (errorStr.includes('duplicate') || errorStr.includes('already exists') || errorStr.includes('conflict')) {
      return {
        message: 'A record with this information already exists. Please use different details.',
        type: 'duplicate',
        originalError: error
      };
    }
    
    // Client-specific errors
    if (errorStr.includes('client') || errorStr.includes('customer')) {
      return {
        message: 'Client information is invalid or missing. Please select a valid client.',
        type: 'validation',
        originalError: error
      };
    }
    
    // Order-specific errors
    if (errorStr.includes('order')) {
      return {
        message: 'Order information is invalid. Please check the order details and try again.',
        type: 'validation',
        originalError: error
      };
    }
    
    // Invoice-specific errors
    if (errorStr.includes('invoice')) {
      return {
        message: 'Invoice information is invalid. Please check the invoice details and try again.',
        type: 'validation',
        originalError: error
      };
    }
    
    // Payment-specific errors
    if (errorStr.includes('payment') || errorStr.includes('amount')) {
      return {
        message: 'Payment information is invalid. Please check the amount and payment details.',
        type: 'validation',
        originalError: error
      };
    }
    
    // Bank account errors
    if (errorStr.includes('bank') || errorStr.includes('account')) {
      return {
        message: 'Bank account information is invalid. Please select a valid bank account.',
        type: 'validation',
        originalError: error
      };
    }
    
    // Fiscal year errors
    if (errorStr.includes('fiscal year') || errorStr.includes('year')) {
      return {
        message: 'Fiscal year information is invalid. Please select a valid fiscal year.',
        type: 'validation',
        originalError: error
      };
    }
    
    // Product/item errors
    if (errorStr.includes('product') || errorStr.includes('item')) {
      return {
        message: 'Product information is invalid. Please check product details and try again.',
        type: 'validation',
        originalError: error
      };
    }
    
    // For other errors, show the actual error message if it's not too technical
    const cleanMessage = error.message.replace(/^Error: /, '').replace(/^ConvexError: /, '');
    if (cleanMessage.length < 100 && !cleanMessage.includes('internal') && !cleanMessage.includes('server')) {
      return {
        message: cleanMessage,
        type: 'unknown',
        originalError: error
      };
    }
    
    return {
      message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      type: 'unknown',
      originalError: error
    };
  }
  
  // Handle non-Error objects
  if (typeof error === 'string') {
    return {
      message: error,
      type: 'unknown'
    };
  }
  
  return {
    message: 'An unexpected error occurred',
    type: 'unknown'
  };
}

/**
 * Display error to user using appropriate method (alert, toast, etc.)
 * @param error - The error to display
 * @param method - How to display the error ('alert' | 'toast' | 'console')
 */
export function displayError(error: unknown, method: 'alert' | 'toast' | 'console' = 'alert'): void {
  const parsedError = parseError(error);
  
  if (method === 'alert') {
    alert(parsedError.message);
  } else if (method === 'toast') {
    // This would integrate with toast notifications if available
    console.error(parsedError.message);
  } else {
    console.error('Error:', parsedError);
  }
}

/**
 * Handle async operations with error catching
 * @param operation - The async operation to execute
 * @param onError - Optional error handler
 * @param onSuccess - Optional success handler
 * @returns Promise with error handling
 */
export async function handleAsync<T>(
  operation: () => Promise<T>,
  onError?: (error: AppError) => void,
  onSuccess?: (result: T) => void
): Promise<T | null> {
  try {
    const result = await operation();
    onSuccess?.(result);
    return result;
  } catch (error) {
    const parsedError = parseError(error);
    onError?.(parsedError);
    return null;
  }
}

/**
 * Validate required fields
 * @param data - Object containing the data to validate
 * @param requiredFields - Array of required field names
 * @returns Validation result
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '' || 
           (Array.isArray(value) && value.length === 0);
  });
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Format validation error message
 * @param missingFields - Array of missing field names
 * @returns Formatted error message
 */
export function formatValidationError(missingFields: string[]): string {
  if (missingFields.length === 0) return '';
  
  if (missingFields.length === 1) {
    return `Please fill in the ${missingFields[0]} field.`;
  }
  
  if (missingFields.length === 2) {
    return `Please fill in the ${missingFields[0]} and ${missingFields[1]} fields.`;
  }
  
  const lastField = missingFields[missingFields.length - 1];
  const otherFields = missingFields.slice(0, -1).join(', ');
  return `Please fill in the ${otherFields}, and ${lastField} fields.`;
}
