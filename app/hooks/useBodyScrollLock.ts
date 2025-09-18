"use client";

import { useEffect } from 'react';

/**
 * Hook to prevent body scrolling when a modal is open
 * This prevents background scrolling while maintaining the scroll position
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    
    if (isLocked) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      
      // Lock the body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore the original styles
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore the scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isLocked]);
}

/**
 * Hook specifically for modal components
 * Automatically locks body scroll when the modal is open
 */
export function useModalBodyScrollLock(isOpen: boolean) {
  useBodyScrollLock(isOpen);
}
