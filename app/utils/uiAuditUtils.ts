/**
 * Comprehensive UI/UX Audit Utilities
 * Tests for modal behavior, scroll management, and UI consistency
 */

/**
 * Test modal z-index consistency
 */
export function testModalZIndexConsistency(): {
  isConsistent: boolean;
  inconsistentModals: string[];
  allZIndexes: { selector: string; zIndex: string }[];
} {
  if (typeof window === 'undefined') {
    return { isConsistent: true, inconsistentModals: [], allZIndexes: [] };
  }

  const modals = document.querySelectorAll('[class*="z-"]');
  const allZIndexes: { selector: string; zIndex: string }[] = [];
  const inconsistentModals: string[] = [];

  modals.forEach((modal, index) => {
    const className = modal.className;
    const zIndexMatch = className.match(/z-\[(\d+)\]|z-(\d+)/);
    
    if (zIndexMatch) {
      const zIndex = zIndexMatch[1] || zIndexMatch[2];
      allZIndexes.push({
        selector: `Modal ${index + 1}`,
        zIndex: zIndex
      });

      // Check if z-index is not 9999 (our standard)
      if (zIndex !== '9999') {
        inconsistentModals.push(`Modal ${index + 1} (z-${zIndex})`);
      }
    }
  });

  return {
    isConsistent: inconsistentModals.length === 0,
    inconsistentModals,
    allZIndexes
  };
}

/**
 * Test scroll lock functionality
 */
export function testScrollLockFunctionality(): {
  isBodyScrollLocked: boolean;
  scrollPosition: number;
  bodyStyles: {
    overflow: string;
    position: string;
    top: string;
    width: string;
  };
} {
  if (typeof window === 'undefined') {
    return {
      isBodyScrollLocked: false,
      scrollPosition: 0,
      bodyStyles: { overflow: '', position: '', top: '', width: '' }
    };
  }

  const body = document.body;
  const computedStyle = window.getComputedStyle(body);
  
  return {
    isBodyScrollLocked: body.style.overflow === 'hidden' && body.style.position === 'fixed',
    scrollPosition: window.scrollY,
    bodyStyles: {
      overflow: body.style.overflow || computedStyle.overflow,
      position: body.style.position || computedStyle.position,
      top: body.style.top || computedStyle.top,
      width: body.style.width || computedStyle.width
    }
  };
}

/**
 * Test modal backdrop functionality
 */
export function testModalBackdropFunctionality(): {
  hasProperBackdrop: boolean;
  backdropElements: number;
  backdropOpacity: string[];
} {
  if (typeof window === 'undefined') {
    return { hasProperBackdrop: false, backdropElements: 0, backdropOpacity: [] };
  }

  const backdrops = document.querySelectorAll('[class*="bg-black"][class*="bg-opacity"]');
  const backdropOpacity: string[] = [];

  backdrops.forEach((backdrop) => {
    const className = backdrop.className;
    const opacityMatch = className.match(/bg-opacity-(\d+)/);
    if (opacityMatch) {
      backdropOpacity.push(opacityMatch[1]);
    }
  });

  return {
    hasProperBackdrop: backdrops.length > 0,
    backdropElements: backdrops.length,
    backdropOpacity
  };
}

/**
 * Test responsive design consistency
 */
export function testResponsiveDesignConsistency(): {
  hasMobileOptimizations: boolean;
  hasTouchOptimizations: boolean;
  hasSafeAreaSupport: boolean;
  issues: string[];
} {
  if (typeof window === 'undefined') {
    return { hasMobileOptimizations: false, hasTouchOptimizations: false, hasSafeAreaSupport: false, issues: [] };
  }

  const issues: string[] = [];
  let hasMobileOptimizations = false;
  let hasTouchOptimizations = false;
  let hasSafeAreaSupport = false;

  // Check for mobile-specific classes
  const mobileElements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]');
  if (mobileElements.length > 0) {
    hasMobileOptimizations = true;
  }

  // Check for touch optimizations
  const touchElements = document.querySelectorAll('[class*="touch"], [class*="active:"]');
  if (touchElements.length > 0) {
    hasTouchOptimizations = true;
  }

  // Check for safe area support
  const safeAreaElements = document.querySelectorAll('[style*="env(safe-area-inset)"]');
  if (safeAreaElements.length > 0) {
    hasSafeAreaSupport = true;
  }

  // Check for potential issues
  const fixedElements = document.querySelectorAll('[class*="fixed"]');
  fixedElements.forEach((element) => {
    const className = element.className;
    if (className.includes('fixed') && !className.includes('z-')) {
      issues.push('Fixed element without z-index');
    }
  });

  return {
    hasMobileOptimizations,
    hasTouchOptimizations,
    hasSafeAreaSupport,
    issues
  };
}

/**
 * Test accessibility features
 */
export function testAccessibilityFeatures(): {
  hasProperARIA: boolean;
  hasKeyboardNavigation: boolean;
  hasFocusManagement: boolean;
  issues: string[];
} {
  if (typeof window === 'undefined') {
    return { hasProperARIA: false, hasKeyboardNavigation: false, hasFocusManagement: false, issues: [] };
  }

  const issues: string[] = [];
  let hasProperARIA = false;
  let hasKeyboardNavigation = false;
  let hasFocusManagement = false;

  // Check for ARIA attributes
  const ariaElements = document.querySelectorAll('[aria-label], [aria-modal], [role]');
  if (ariaElements.length > 0) {
    hasProperARIA = true;
  }

  // Check for keyboard navigation
  const keyboardElements = document.querySelectorAll('[tabindex], button, input, select, textarea');
  if (keyboardElements.length > 0) {
    hasKeyboardNavigation = true;
  }

  // Check for focus management
  const focusElements = document.querySelectorAll('[class*="focus:"]');
  if (focusElements.length > 0) {
    hasFocusManagement = true;
  }

  // Check for potential accessibility issues
  const buttons = document.querySelectorAll('button');
  buttons.forEach((button) => {
    if (!button.getAttribute('aria-label') && !button.textContent?.trim()) {
      issues.push('Button without accessible label');
    }
  });

  const modals = document.querySelectorAll('[class*="modal"], [class*="Modal"]');
  modals.forEach((modal) => {
    if (!modal.getAttribute('aria-modal') && !modal.getAttribute('role')) {
      issues.push('Modal without proper ARIA attributes');
    }
  });

  return {
    hasProperARIA,
    hasKeyboardNavigation,
    hasFocusManagement,
    issues
  };
}

/**
 * Comprehensive UI audit
 */
export function runComprehensiveUIAudit(): {
  timestamp: string;
  modalZIndex: ReturnType<typeof testModalZIndexConsistency>;
  scrollLock: ReturnType<typeof testScrollLockFunctionality>;
  modalBackdrop: ReturnType<typeof testModalBackdropFunctionality>;
  responsive: ReturnType<typeof testResponsiveDesignConsistency>;
  accessibility: ReturnType<typeof testAccessibilityFeatures>;
  overallScore: number;
  recommendations: string[];
} {
  const modalZIndex = testModalZIndexConsistency();
  const scrollLock = testScrollLockFunctionality();
  const modalBackdrop = testModalBackdropFunctionality();
  const responsive = testResponsiveDesignConsistency();
  const accessibility = testAccessibilityFeatures();

  // Calculate overall score (0-100)
  let score = 100;
  
  if (!modalZIndex.isConsistent) score -= 20;
  if (!modalBackdrop.hasProperBackdrop) score -= 15;
  if (!responsive.hasMobileOptimizations) score -= 15;
  if (!accessibility.hasProperARIA) score -= 10;
  if (responsive.issues.length > 0) score -= 10;
  if (accessibility.issues.length > 0) score -= 10;
  if (scrollLock.isBodyScrollLocked && !modalBackdrop.hasProperBackdrop) score -= 20;

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (!modalZIndex.isConsistent) {
    recommendations.push('Standardize all modal z-index values to z-[9999]');
  }
  
  if (!modalBackdrop.hasProperBackdrop) {
    recommendations.push('Ensure all modals have proper backdrop overlays');
  }
  
  if (!responsive.hasMobileOptimizations) {
    recommendations.push('Add responsive design optimizations for mobile devices');
  }
  
  if (!accessibility.hasProperARIA) {
    recommendations.push('Improve ARIA attributes for better accessibility');
  }
  
  if (responsive.issues.length > 0) {
    recommendations.push('Fix responsive design issues: ' + responsive.issues.join(', '));
  }
  
  if (accessibility.issues.length > 0) {
    recommendations.push('Fix accessibility issues: ' + accessibility.issues.join(', '));
  }

  return {
    timestamp: new Date().toISOString(),
    modalZIndex,
    scrollLock,
    modalBackdrop,
    responsive,
    accessibility,
    overallScore: Math.max(0, score),
    recommendations
  };
}

/**
 * Test specific modal behavior
 */
export function testModalBehavior(modalElement: HTMLElement): {
  hasProperZIndex: boolean;
  hasBackdrop: boolean;
  isScrollable: boolean;
  hasCloseButton: boolean;
  hasProperPositioning: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check z-index
  const hasProperZIndex = modalElement.className.includes('z-[9999]');
  if (!hasProperZIndex) {
    issues.push('Modal does not have proper z-index');
  }
  
  // Check backdrop
  const hasBackdrop = modalElement.className.includes('bg-black') && modalElement.className.includes('bg-opacity');
  if (!hasBackdrop) {
    issues.push('Modal does not have proper backdrop');
  }
  
  // Check scrollability
  const isScrollable = modalElement.querySelector('[class*="overflow-y-auto"]') !== null;
  
  // Check close button
  const hasCloseButton = modalElement.querySelector('button[aria-label*="Close"], button[aria-label*="close"]') !== null;
  if (!hasCloseButton) {
    issues.push('Modal does not have accessible close button');
  }
  
  // Check positioning
  const hasProperPositioning = modalElement.className.includes('fixed') && 
                              (modalElement.className.includes('inset-0') || 
                               modalElement.className.includes('top-0'));
  if (!hasProperPositioning) {
    issues.push('Modal does not have proper positioning');
  }
  
  return {
    hasProperZIndex,
    hasBackdrop,
    isScrollable,
    hasCloseButton,
    hasProperPositioning,
    issues
  };
}
