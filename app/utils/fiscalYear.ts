/**
 * Fiscal Year Utilities
 * Handles fiscal year calculations for July 1 to June 30
 * All calculations use Pakistan timezone (PKT - UTC+5) for consistency
 */

import { getCurrentPakistanDate } from './dateUtils';

export interface FiscalYearRange {
  startDate: number; // timestamp
  endDate: number;   // timestamp
  fiscalYear: number; // e.g., 2024 for FY 2024-25
}

/**
 * Get the current fiscal year
 * Uses Pakistan timezone for consistency
 * @returns The current fiscal year number (e.g., 2024 for FY 2024-25)
 */
export function getCurrentFiscalYear(): number {
  const now = getCurrentPakistanDate(); // Use Pakistan timezone
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-11 (Jan = 0, Dec = 11)
  
  // If we're in July (6) or later, we're in the next fiscal year
  // e.g., July 2024 = FY 2024-25
  if (currentMonth >= 6) { // July = 6
    return currentYear;
  } else {
    return currentYear - 1;
  }
}

/**
 * Get fiscal year range for a given fiscal year
 * Uses Pakistan timezone for consistency
 * @param fiscalYear The fiscal year (e.g., 2024 for FY 2024-25)
 * @returns Object with startDate, endDate, and fiscalYear
 */
export function getFiscalYearRange(fiscalYear: number): FiscalYearRange {
  // Create dates in Pakistan timezone (UTC+5)
  const startDate = new Date(Date.UTC(fiscalYear, 6, 1, 5, 0, 0)).getTime(); // July 1, 5 AM UTC = July 1, 10 AM PKT
  const endDate = new Date(Date.UTC(fiscalYear + 1, 5, 30, 18, 59, 59, 999)).getTime(); // June 30, 6:59 PM UTC = June 30, 11:59 PM PKT
  
  return {
    startDate,
    endDate,
    fiscalYear,
  };
}

/**
 * Get the fiscal year for a given date
 * Uses Pakistan timezone for consistency
 * @param date The date to check
 * @returns The fiscal year number
 */
export function getFiscalYearForDate(date: Date | number): number {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  
  // Convert to Pakistan timezone
  const pakistanTime = new Date(dateObj.getTime() + (5 * 60 * 60 * 1000)); // UTC+5
  
  const year = pakistanTime.getUTCFullYear();
  const month = pakistanTime.getUTCMonth(); // 0-11
  
  // If we're in July (6) or later, we're in the next fiscal year
  if (month >= 6) { // July = 6
    return year;
  } else {
    return year - 1;
  }
}

/**
 * Get the previous fiscal year
 * @param fiscalYear The current fiscal year
 * @returns The previous fiscal year
 */
export function getPreviousFiscalYear(fiscalYear: number): number {
  return fiscalYear - 1;
}

/**
 * Get the next fiscal year
 * @param fiscalYear The current fiscal year
 * @returns The next fiscal year
 */
export function getNextFiscalYear(fiscalYear: number): number {
  return fiscalYear + 1;
}

/**
 * Format fiscal year for display
 * @param fiscalYear The fiscal year number
 * @returns Formatted string (e.g., "2024-25")
 */
export function formatFiscalYear(fiscalYear: number): string {
  return `${fiscalYear}-${(fiscalYear + 1).toString().slice(-2)}`;
}

/**
 * Get fiscal year label for display
 * @param fiscalYear The fiscal year number
 * @returns Formatted string (e.g., "FY 2024-25")
 */
export function getFiscalYearLabel(fiscalYear: number): string {
  return `FY ${formatFiscalYear(fiscalYear)}`;
}

/**
 * Check if a date falls within a fiscal year
 * @param date The date to check
 * @param fiscalYear The fiscal year to check against
 * @returns True if the date is within the fiscal year
 */
export function isDateInFiscalYear(date: Date | number, fiscalYear: number): boolean {
  const range = getFiscalYearRange(fiscalYear);
  const timestamp = typeof date === 'number' ? date : date.getTime();
  
  return timestamp >= range.startDate && timestamp <= range.endDate;
}

/**
 * Get fiscal year options for dropdowns (current year, previous 5 years, and next year)
 * @returns Array of fiscal year options
 */
export function getFiscalYearOptions(): Array<{ value: number; label: string }> {
  const currentFY = getCurrentFiscalYear();
  const options = [];
  
  // Add next year (future fiscal year)
  options.push({
    value: currentFY + 1,
    label: getFiscalYearLabel(currentFY + 1),
  });
  
  // Add current year
  options.push({
    value: currentFY,
    label: getFiscalYearLabel(currentFY),
  });
  
  // Add previous 5 years
  for (let i = 1; i <= 5; i++) {
    const fy = currentFY - i;
    options.push({
      value: fy,
      label: getFiscalYearLabel(fy),
    });
  }
  
  return options;
}
