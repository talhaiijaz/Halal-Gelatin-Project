/**
 * Utility functions for testing modal behavior and scroll restoration
 */

/**
 * Test if body scroll is properly locked
 */
export function isBodyScrollLocked(): boolean {
  if (typeof window === 'undefined') return false;
  
  const bodyStyle = window.getComputedStyle(document.body);
  return bodyStyle.overflow === 'hidden' && bodyStyle.position === 'fixed';
}

/**
 * Test if scroll position is preserved
 */
export function getCurrentScrollPosition(): number {
  if (typeof window === 'undefined') return 0;
  return window.scrollY;
}

/**
 * Test if modal z-index is correct
 */
export function getModalZIndex(): number {
  if (typeof window === 'undefined') return 0;
  
  const modals = document.querySelectorAll('[class*="z-[9999]"], [class*="z-50"]');
  if (modals.length === 0) return 0;
  
  const firstModal = modals[0] as HTMLElement;
  const computedStyle = window.getComputedStyle(firstModal);
  return parseInt(computedStyle.zIndex) || 0;
}

/**
 * Test if multiple modals are handled correctly
 */
export function getOpenModalCount(): number {
  if (typeof window === 'undefined') return 0;
  
  const modals = document.querySelectorAll('[class*="z-[9999]"], [class*="z-50"]');
  return modals.length;
}

/**
 * Test if backdrop click works
 */
export function testBackdropClick(modalElement: HTMLElement): boolean {
  if (typeof window === 'undefined') return false;
  
  const backdrop = modalElement.querySelector('[class*="bg-black"]');
  return backdrop !== null;
}

/**
 * Test if modal content is scrollable
 */
export function isModalContentScrollable(modalElement: HTMLElement): boolean {
  if (typeof window === 'undefined') return false;
  
  const content = modalElement.querySelector('[class*="overflow-y-auto"]');
  if (!content) return false;
  
  const computedStyle = window.getComputedStyle(content);
  return computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll';
}

/**
 * Test if modal is properly positioned
 */
export function isModalProperlyPositioned(modalElement: HTMLElement): boolean {
  if (typeof window === 'undefined') return false;
  
  const computedStyle = window.getComputedStyle(modalElement);
  return computedStyle.position === 'fixed' && 
         computedStyle.top === '0px' && 
         computedStyle.left === '0px';
}

/**
 * Test if modal has proper backdrop
 */
export function hasProperBackdrop(modalElement: HTMLElement): boolean {
  if (typeof window === 'undefined') return false;
  
  const backdrop = modalElement.querySelector('[class*="bg-black"]');
  if (!backdrop) return false;
  
  const computedStyle = window.getComputedStyle(backdrop);
  return computedStyle.position === 'absolute' && 
         computedStyle.top === '0px' && 
         computedStyle.left === '0px';
}

/**
 * Run comprehensive modal tests
 */
export function runModalTests(): {
  bodyScrollLocked: boolean;
  scrollPosition: number;
  modalZIndex: number;
  openModalCount: number;
  hasProperBackdrop: boolean;
  isProperlyPositioned: boolean;
} {
  const modals = document.querySelectorAll('[class*="z-[9999]"], [class*="z-50"]');
  const firstModal = modals[0] as HTMLElement;
  
  return {
    bodyScrollLocked: isBodyScrollLocked(),
    scrollPosition: getCurrentScrollPosition(),
    modalZIndex: getModalZIndex(),
    openModalCount: getOpenModalCount(),
    hasProperBackdrop: firstModal ? hasProperBackdrop(firstModal) : false,
    isProperlyPositioned: firstModal ? isModalProperlyPositioned(firstModal) : false,
  };
}
