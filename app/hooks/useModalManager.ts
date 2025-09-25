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

  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  openModal(modalId: string): void {
    if (this.openModals.size === 0) {
      // First modal opening - lock scroll
      this.lockScroll();
    }
    this.openModals.add(modalId);
  }

  closeModal(modalId: string): void {
    this.openModals.delete(modalId);
    if (this.openModals.size === 0) {
      // Last modal closed - unlock scroll
      this.unlockScroll();
    }
  }

  private lockScroll(): void {
    if (typeof window === 'undefined') return;

    this.scrollPosition = window.scrollY;
    
    const computedStyle = window.getComputedStyle(document.body);
    this.originalStyles = {
      overflow: computedStyle.overflow,
      position: computedStyle.position,
      top: computedStyle.top,
      width: computedStyle.width,
    };
    
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollPosition}px`;
    document.body.style.width = '100%';
  }

  private unlockScroll(): void {
    if (typeof window === 'undefined' || !this.originalStyles) return;

    const { overflow, position, top, width } = this.originalStyles;
    const targetScroll = this.scrollPosition;

    document.body.style.overflow = overflow;
    document.body.style.position = position;
    document.body.style.width = width;

    const restore = () => {
      document.body.style.top = top;

      const htmlStyle = document.documentElement.style;
      const previousInlineBehavior = htmlStyle.scrollBehavior;
      htmlStyle.scrollBehavior = 'auto';

      window.scrollTo(0, Number.isFinite(targetScroll) ? targetScroll : 0);

      if (previousInlineBehavior) {
        htmlStyle.scrollBehavior = previousInlineBehavior;
      } else {
        htmlStyle.removeProperty('scroll-behavior');
      }
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(restore);
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
