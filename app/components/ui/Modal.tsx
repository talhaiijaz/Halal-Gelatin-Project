"use client";

import { ReactNode, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalManager } from '@/app/hooks/useModalManager';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  className = '',
}: ModalProps) {
  // Generate unique modal ID
  const modalId = useId();
  
  // Manage modal state and scroll locking
  useModalManager(modalId, isOpen);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div 
      className="fixed z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50"
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
      onClick={handleBackdropClick}
    >
      <div 
        className={`relative bg-white rounded-lg shadow-xl w-full ${maxWidthClasses[maxWidth]} mx-4 max-h-[90vh] overflow-hidden ${className} sm:mx-4 mx-0 sm:rounded-lg rounded-none sm:h-auto h-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6 sm:p-6 p-4">
          {children}
        </div>
      </div>
    </div>
  );

  // Use portal to render modal directly to document.body
  return createPortal(modalContent, document.body);
}
