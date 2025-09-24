"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { restoreScrollPosition } from '@/app/utils/scrollRestoration';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ModalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Modal Error Boundary caught an error:', error, errorInfo);
    
    // Restore scroll position when modal errors occur
    restoreScrollPosition();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Reset error state when children change
    if (prevState.hasError && !this.state.hasError) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    restoreScrollPosition();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900">Modal Error</h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              Something went wrong with the modal. This might be due to a scroll or display issue.
            </p>
            
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-sm text-gray-500 cursor-pointer">
                  Error Details
                </summary>
                <pre className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
