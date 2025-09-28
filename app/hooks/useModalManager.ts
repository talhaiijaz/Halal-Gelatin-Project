"use client";

import { useEffect, useRef } from 'react';

/**
 * Global modal manager to handle multiple modals and prevent conflicts
 */
class ModalManager {
  private static instance: ModalManager;
  private openModals: Set<string> = new Set();
  private scrollPosition: number = 0;
  private originalStyles: {
    overflow: string;
    position: string;
    top: string;
    width: string;
  } | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingLockFrame: number | null = null;

  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
      
      // Add global error handler for scroll restoration issues
      if (typeof window !== 'undefined') {
        window.addEventListener('error', (event) => {
          if (event.message?.includes('scroll') || event.message?.includes('modal')) {
            ModalManager.instance.ensureBodyNotStuck();
          }
        });
        
        // Add beforeunload handler to ensure cleanup
        window.addEventListener('beforeunload', () => {
          ModalManager.instance.ensureBodyNotStuck();
        });
        
        // Add emergency keyboard shortcut (Ctrl+Shift+R) to fix stuck body
        window.addEventListener('keydown', (event) => {
          if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            event.preventDefault();
            ModalManager.instance.ensureBodyNotStuck();
            console.log('Emergency body position fix applied');
          }
        });
        
        // Add scroll event listener to detect interference
        let scrollTimeout: ReturnType<typeof setTimeout>;
        window.addEventListener('scroll', () => {
          // If we're in a modal and body is fixed, prevent scroll interference
          if (ModalManager.instance.isModalOpen() && document.body.style.position === 'fixed') {
            // Clear any pending scroll restoration
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
              ModalManager.instance.ensureBodyNotStuck();
            }, 50);
          }
        });
      }
    }
    return ModalManager.instance;
  }

  openModal(modalId: string): void {
    const wasEmpty = this.openModals.size === 0;
    this.openModals.add(modalId);

    if (wasEmpty) {
      // First modal opening - lock scroll with delay to handle createPortal timing
      this.lockScrollWithDelay();
    }
  }

  private lockScrollWithDelay(): void {
    if (typeof window === 'undefined') return;

    // Cancel any pending lock from a previous open/close race
    if (this.pendingLockFrame !== null) {
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.pendingLockFrame);
      }
      this.pendingLockFrame = null;
    }

    const executeLock = () => {
      this.pendingLockFrame = null;

      // If no modals are active by the time we run, skip locking
      if (!this.isModalOpen()) {
        return;
      }

      this.lockScroll();
    };

    const schedule = () => {
      if (typeof window.requestAnimationFrame === 'function') {
        this.pendingLockFrame = window.requestAnimationFrame(() => {
          this.pendingLockFrame = null;
          executeLock();
        });
      } else {
        executeLock();
      }
    };

    if (typeof window.requestAnimationFrame === 'function') {
      this.pendingLockFrame = window.requestAnimationFrame(() => {
        // Schedule one more frame so the portal content can mount fully
        schedule();
      });
    } else {
      executeLock();
    }
  }

  closeModal(modalId: string): void {
    if (!this.openModals.has(modalId)) {
      return;
    }

    this.openModals.delete(modalId);
    if (this.openModals.size === 0) {
      if (typeof window !== 'undefined' && this.pendingLockFrame !== null) {
        if (typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(this.pendingLockFrame);
        }
        this.pendingLockFrame = null;
      }
      // Last modal closed - unlock scroll
      this.unlockScroll();
      
      // Set a safety timer to ensure body is not stuck in fixed position
      this.setCleanupTimer();
    }
  }

  private setCleanupTimer(): void {
    // Clear any existing timer
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }
    
    // Set multiple timers to check and fix body position
    // First check after 100ms for immediate issues
    setTimeout(() => {
      this.ensureBodyNotStuck();
    }, 100);
    
    // Second check after 500ms for delayed issues
    setTimeout(() => {
      this.ensureBodyNotStuck();
    }, 500);
    
    // Final check after 1 second
    this.cleanupTimer = setTimeout(() => {
      this.ensureBodyNotStuck();
      this.cleanupTimer = null;
    }, 1000);
  }

  private ensureBodyNotStuck(): void {
    if (typeof window === 'undefined') return;
    
    // Check if body is stuck in fixed position
    const bodyStyle = document.body.style;
    const isStuck = bodyStyle.position === 'fixed' && this.openModals.size === 0;
    
    if (isStuck) {
      console.warn('ModalManager: Body was stuck in fixed position, fixing...');
      
      // Reset body styles to default
      bodyStyle.position = '';
      bodyStyle.top = '';
      bodyStyle.overflow = '';
      bodyStyle.width = '';
      
      // Restore scroll position using multiple methods
      if (this.scrollPosition > 0) {
        window.scrollTo(0, this.scrollPosition);
        document.documentElement.scrollTop = this.scrollPosition;
        document.body.scrollTop = this.scrollPosition;
      }
    }
    
    // Also check for any lingering fixed position issues
    const computedStyle = window.getComputedStyle(document.body);
    if (computedStyle.position === 'fixed' && this.openModals.size === 0) {
      console.warn('ModalManager: Body computed style shows fixed position, forcing reset...');
      bodyStyle.position = 'static';
      bodyStyle.top = '';
      bodyStyle.overflow = '';
      bodyStyle.width = '';
    }
  }

  private lockScroll(): void {
    if (typeof window === 'undefined') return;

    // Skip if all modals have been closed before we had a chance to lock
    if (!this.isModalOpen()) {
      return;
    }

    if (!this.originalStyles) {
      const computedStyle = window.getComputedStyle(document.body);
      this.originalStyles = {
        overflow: computedStyle.overflow,
        position: computedStyle.position,
        top: computedStyle.top,
        width: computedStyle.width,
      };
    }

    // Capture scroll position more reliably
    this.scrollPosition = Math.max(0, window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
    
    // Ensure we're not already in a fixed state
    if (document.body.style.position !== 'fixed') {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.scrollPosition}px`;
      document.body.style.width = '100%';
    }
  }

  private unlockScroll(): void {
    if (typeof window === 'undefined' || !this.originalStyles) return;

    const { overflow, position, top, width } = this.originalStyles;
    const targetScroll = this.scrollPosition;

    // Restore styles immediately to prevent visual glitches
    document.body.style.overflow = overflow;
    document.body.style.position = position;
    document.body.style.top = top;
    document.body.style.width = width;

    // Use a more reliable scroll restoration method
    const restore = () => {
      // Ensure we're not in a fixed position state
      if (document.body.style.position === 'fixed') {
        document.body.style.position = position;
        document.body.style.top = top;
      }

      // Temporarily disable smooth scrolling for precise positioning
      const htmlStyle = document.documentElement.style;
      const previousInlineBehavior = htmlStyle.scrollBehavior;
      htmlStyle.scrollBehavior = 'auto';

      // Restore scroll position with validation
      const scrollY = Number.isFinite(targetScroll) && targetScroll >= 0 ? targetScroll : 0;
      
      // Use multiple methods to ensure scroll restoration works
      window.scrollTo(0, scrollY);
      document.documentElement.scrollTop = scrollY;
      document.body.scrollTop = scrollY;

      // Restore smooth scrolling behavior
      if (previousInlineBehavior) {
        htmlStyle.scrollBehavior = previousInlineBehavior;
      } else {
        htmlStyle.removeProperty('scroll-behavior');
      }
    };

    // Use triple RAF for maximum reliability with createPortal timing
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(restore);
        });
      });
    } else {
      restore();
    }

    this.originalStyles = null;
  }

  isModalOpen(): boolean {
    return this.openModals.size > 0;
  }

  getOpenModalCount(): number {
    return this.openModals.size;
  }
}

/**
 * Hook to manage modal state and prevent scroll conflicts
 */
export function useModalManager(modalId: string, isOpen: boolean) {
  const modalManager = useRef(ModalManager.getInstance());

  useEffect(() => {
    if (isOpen) {
      modalManager.current.openModal(modalId);
    } else {
      modalManager.current.closeModal(modalId);
    }

    return () => {
      modalManager.current.closeModal(modalId);
    };
  }, [isOpen, modalId]);
}

/**
 * Hook to get global modal state
 */
export function useGlobalModalState() {
  const modalManager = useRef(ModalManager.getInstance());
  
  return {
    isAnyModalOpen: modalManager.current.isModalOpen(),
    openModalCount: modalManager.current.getOpenModalCount(),
  };
}
