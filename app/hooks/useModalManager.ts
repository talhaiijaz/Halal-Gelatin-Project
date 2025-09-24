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

    // Restore original styles
    document.body.style.overflow = this.originalStyles.overflow;
    document.body.style.position = this.originalStyles.position;
    document.body.style.top = this.originalStyles.top;
    document.body.style.width = this.originalStyles.width;
    
    // Restore scroll position with a small delay
    setTimeout(() => {
      window.scrollTo(0, this.scrollPosition);
    }, 0);
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
