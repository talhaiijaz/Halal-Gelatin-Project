"use client";

import { useEffect, useRef } from 'react';
import { saveScrollPosition } from '@/app/utils/scrollRestoration';

/**
 * Hook to prevent body scrolling when a modal is open
 * This prevents background scrolling while maintaining the scroll position
 * 
 * NOTE: This hook is deprecated in favor of useModalManager for modal components.
 * Use this only for non-modal scroll locking scenarios.
 */
export function useBodyScrollLock(isLocked: boolean) {
  const scrollPositionRef = useRef<number>(0);
  const originalStylesRef = useRef<{
    overflow: string;
    position: string;
    top: string;
    width: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isLocked) {
      // Store the current scroll position
      scrollPositionRef.current = window.scrollY;
      saveScrollPosition();
      
      // Store original styles
      const computedStyle = window.getComputedStyle(document.body);
      originalStylesRef.current = {
        overflow: computedStyle.overflow,
        position: computedStyle.position,
        top: computedStyle.top,
        width: computedStyle.width,
      };
      
      // Lock the body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore the original styles
        if (originalStylesRef.current) {
          document.body.style.overflow = originalStylesRef.current.overflow;
          document.body.style.position = originalStylesRef.current.position;
          document.body.style.top = originalStylesRef.current.top;
          document.body.style.width = originalStylesRef.current.width;
        }
        
        // Use requestAnimationFrame to avoid conflicts with ModalManager
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPositionRef.current);
        });
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
