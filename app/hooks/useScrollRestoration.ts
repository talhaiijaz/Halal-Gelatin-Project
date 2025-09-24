"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { saveScrollPosition, restoreScrollPosition } from '@/app/utils/scrollRestoration';

/**
 * Hook to handle scroll restoration on page navigation
 */
export function useScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    // Save scroll position when component unmounts
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };

    // Restore scroll position when component mounts
    const restoreScroll = () => {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        restoreScrollPosition();
      }, 100);
    };

    // Add event listener for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Restore scroll position on mount
    restoreScroll();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);
}

/**
 * Hook to handle scroll restoration for specific pages
 */
export function usePageScrollRestoration(pageKey: string) {
  const pathname = usePathname();

  useEffect(() => {
    const storageKey = `scroll-position-${pageKey}`;
    
    // Save scroll position when leaving the page
    const handleBeforeUnload = () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, window.scrollY.toString());
      }
    };

    // Restore scroll position when entering the page
    const restoreScroll = () => {
      if (typeof window !== 'undefined') {
        const savedPosition = localStorage.getItem(storageKey);
        if (savedPosition) {
          setTimeout(() => {
            window.scrollTo(0, parseInt(savedPosition));
          }, 100);
        }
      }
    };

    // Add event listener for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Restore scroll position on mount
    restoreScroll();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname, pageKey]);
}
