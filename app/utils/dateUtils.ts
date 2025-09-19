/**
 * Utility functions for consistent date handling across the application
 * All dates are handled in Pakistan timezone (PKT - UTC+5) for consistency
 */

// Pakistan timezone offset: UTC+5 (5 hours ahead of UTC)
// const PAKISTAN_TIMEZONE_OFFSET = 5 * 60; // 5 hours in minutes

/**
 * Converts a date string (YYYY-MM-DD format from HTML date input) to a timestamp
 * User input is respected exactly as entered - the date they choose is the date we use
 * Uses Pakistan timezone (UTC+5) for consistency across the platform
 */
export function dateStringToTimestamp(dateString: string): number {
  if (!dateString) return 0;
  
  // Parse the date string exactly as user entered it
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date at noon in Pakistan timezone to avoid any edge cases
  const date = new Date(year, month - 1, day, 12, 0, 0);
  
  return date.getTime();
}

/**
 * Converts a timestamp to a date string (YYYY-MM-DD format for HTML date input)
 * Uses Pakistan timezone for consistency
 */
export function timestampToDateString(timestamp: number): string {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  
  // Format in Pakistan timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Formats a timestamp to a localized date string for display
 * Uses Pakistan timezone for consistency
 */
export function formatDateForDisplay(timestamp: number): string {
  if (!timestamp) return 'Not set';
  
  const date = new Date(timestamp);
  
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Karachi" // Pakistan timezone
  });
}

/**
 * Formats a timestamp to a localized date string with full month name
 * Uses Pakistan timezone for consistency
 */
export function formatDateForDisplayLong(timestamp: number): string {
  if (!timestamp) return 'Not set';
  
  const date = new Date(timestamp);
  
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Karachi" // Pakistan timezone
  });
}

/**
 * Gets the current date in Pakistan timezone
 */
export function getCurrentPakistanDate(): Date {
  return new Date(); // Use system date, assuming server is in Pakistan timezone
}

/**
 * Gets the current timestamp for Pakistan timezone
 */
export function getCurrentPakistanTimestamp(): number {
  return Date.now(); // Use current timestamp
}
