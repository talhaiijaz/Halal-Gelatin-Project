/**
 * Utility functions for consistent date handling across the application
 * All dates are handled in Pakistan timezone (PKT - UTC+5) for consistency
 */

// Pakistan timezone offset: UTC+5 (5 hours ahead of UTC)
const PAKISTAN_TIMEZONE_OFFSET = 5 * 60; // 5 hours in minutes

/**
 * Converts a date string (YYYY-MM-DD format from HTML date input) to a timestamp
 * This ensures consistent date handling using Pakistan timezone
 * User input is respected regardless of their local timezone
 */
export function dateStringToTimestamp(dateString: string): number {
  if (!dateString) return 0;
  
  // Parse the date string and create a date in Pakistan timezone
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date at noon Pakistan time (UTC+5)
  const pakistanDate = new Date(Date.UTC(year, month - 1, day, 12 - 5, 0, 0)); // noon PKT = 7 AM UTC
  
  return pakistanDate.getTime();
}

/**
 * Converts a timestamp to a date string (YYYY-MM-DD format for HTML date input)
 * Uses Pakistan timezone for consistency
 */
export function timestampToDateString(timestamp: number): string {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  
  // Convert to Pakistan timezone
  const pakistanTime = new Date(date.getTime() + (PAKISTAN_TIMEZONE_OFFSET * 60 * 1000));
  
  const year = pakistanTime.getUTCFullYear();
  const month = String(pakistanTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pakistanTime.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Formats a timestamp to a localized date string for display
 * Uses Pakistan timezone for consistency
 */
export function formatDateForDisplay(timestamp: number): string {
  if (!timestamp) return 'Not set';
  
  const date = new Date(timestamp);
  
  // Convert to Pakistan timezone for display
  const pakistanTime = new Date(date.getTime() + (PAKISTAN_TIMEZONE_OFFSET * 60 * 1000));
  
  return pakistanTime.toLocaleDateString("en-US", {
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
  
  // Convert to Pakistan timezone for display
  const pakistanTime = new Date(date.getTime() + (PAKISTAN_TIMEZONE_OFFSET * 60 * 1000));
  
  return pakistanTime.toLocaleDateString("en-US", {
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
  const now = new Date();
  return new Date(now.getTime() + (PAKISTAN_TIMEZONE_OFFSET * 60 * 1000));
}

/**
 * Gets the current timestamp adjusted for Pakistan timezone
 */
export function getCurrentPakistanTimestamp(): number {
  return getCurrentPakistanDate().getTime();
}
