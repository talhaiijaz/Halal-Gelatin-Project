/**
 * Utility functions for managing scroll position across the application
 */

let scrollPosition = 0;

/**
 * Save the current scroll position
 */
export function saveScrollPosition(): void {
  if (typeof window === 'undefined') return;
  scrollPosition = getScrollPosition();
}

/**
 * Restore the saved scroll position
 */
export function restoreScrollPosition(): void {
  if (typeof window === 'undefined') return;
  window.scrollTo(0, scrollPosition);
}

/**
 * Reset scroll position to top
 */
export function resetScrollPosition(): void {
  if (typeof window === 'undefined') return;
  window.scrollTo(0, 0);
  scrollPosition = 0;
}

/**
 * Get the current scroll position
 */
export function getScrollPosition(): number {
  if (typeof window === 'undefined') return 0;
  // If body is locked for a modal (position: fixed), window.scrollY will be 0.
  // In that case, derive the scroll from body's top offset to avoid saving 0.
  const body = document.body as HTMLBodyElement;
  const isFixed = body.style.position === 'fixed';
  if (isFixed) {
    const top = body.style.top || '0px';
    const parsed = parseInt(top, 10);
    if (!Number.isNaN(parsed)) {
      return Math.abs(parsed);
    }
  }
  return window.scrollY;
}

/**
 * Set scroll position to a specific value
 */
export function setScrollPosition(position: number): void {
  if (typeof window === 'undefined') return;
  window.scrollTo(0, position);
  scrollPosition = position;
}
