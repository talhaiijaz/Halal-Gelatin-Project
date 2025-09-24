/**
 * Utility functions for managing scroll position across the application
 */

let scrollPosition = 0;

/**
 * Save the current scroll position
 */
export function saveScrollPosition(): void {
  if (typeof window !== 'undefined') {
    scrollPosition = window.scrollY;
  }
}

/**
 * Restore the saved scroll position
 */
export function restoreScrollPosition(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo(0, scrollPosition);
  }
}

/**
 * Reset scroll position to top
 */
export function resetScrollPosition(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo(0, 0);
    scrollPosition = 0;
  }
}

/**
 * Get the current scroll position
 */
export function getScrollPosition(): number {
  if (typeof window !== 'undefined') {
    return window.scrollY;
  }
  return 0;
}

/**
 * Set scroll position to a specific value
 */
export function setScrollPosition(position: number): void {
  if (typeof window !== 'undefined') {
    window.scrollTo(0, position);
    scrollPosition = position;
  }
}
