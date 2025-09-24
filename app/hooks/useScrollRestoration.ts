"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getScrollPosition } from '@/app/utils/scrollRestoration';

/**
 * Hook to handle scroll restoration on page navigation
 */
export function useScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Force manual browser restoration to avoid native jumps
    if ('scrollRestoration' in window.history) {
      try {
        window.history.scrollRestoration = 'manual';
      } catch {}
    }

    const storageKey = `scroll:${pathname}`;

    // Try restoring only on back/forward navigations
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isBackForward = !!nav && (nav.type === 'back_forward' || nav.type === 'reload');

    const saved = sessionStorage.getItem(storageKey);
    if (saved && isBackForward) {
      // Defer to the end of current frame to avoid layout flicker
      requestAnimationFrame(() => {
        const y = parseInt(saved, 10);
        if (!Number.isNaN(y)) {
          window.scrollTo(0, y);
        }
      });
    }

    const handleBeforeUnload = () => {
      sessionStorage.setItem(storageKey, String(getScrollPosition()));
    };

    const handlePopState = () => {
      const val = sessionStorage.getItem(storageKey);
      if (val) {
        const y = parseInt(val, 10);
        if (!Number.isNaN(y)) {
          requestAnimationFrame(() => window.scrollTo(0, y));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      // Save on route change
      sessionStorage.setItem(storageKey, String(getScrollPosition()));
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
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
