// convex/fiscalYearUtils.ts
// Utility functions for fiscal year management

/**
 * Convert a calendar year to fiscal year format
 * @param year - Calendar year (e.g., 2025)
 * @returns Fiscal year string (e.g., "2025-26")
 */
export function getFiscalYear(year: number): string {
  const nextYear = year + 1;
  const nextYearShort = nextYear.toString().slice(-2);
  return `${year}-${nextYearShort}`;
}

/**
 * Get the next fiscal year
 * @param fiscalYear - Current fiscal year (e.g., "2025-26")
 * @returns Next fiscal year (e.g., "2026-27")
 */
export function getNextFiscalYear(fiscalYear: string): string {
  const [startYear] = fiscalYear.split('-');
  const nextStartYear = parseInt(startYear) + 1;
  return getFiscalYear(nextStartYear);
}

/**
 * Get the calendar year from fiscal year
 * @param fiscalYear - Fiscal year (e.g., "2025-26")
 * @returns Calendar year (e.g., 2025)
 */
export function getCalendarYearFromFiscal(fiscalYear: string): number {
  const [startYear] = fiscalYear.split('-');
  return parseInt(startYear);
}

/**
 * Get current fiscal year based on current date
 * @returns Current fiscal year string
 */
export function getCurrentFiscalYear(): string {
  const currentYear = new Date().getFullYear();
  return getFiscalYear(currentYear);
}

/**
 * Validate fiscal year format
 * @param fiscalYear - Fiscal year string to validate
 * @returns true if valid format
 */
export function isValidFiscalYear(fiscalYear: string): boolean {
  const pattern = /^\d{4}-\d{2}$/;
  if (!pattern.test(fiscalYear)) {
    return false;
  }
  
  const [startYear, endYear] = fiscalYear.split('-');
  const start = parseInt(startYear);
  const end = parseInt('20' + endYear);
  
  return end === start + 1;
}
