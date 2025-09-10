import { useCallback } from 'react';
import { captureException } from '@nexus/analytics';

/**
 * Hook for error boundary functionality in React components
 * Provides error handling with analytics tracking
 */
export function useErrorBoundary() {
  const captureError = useCallback((error: Error, errorInfo?: unknown) => {
    console.error('Error caught by error boundary:', error, errorInfo);
    
    // Track error in analytics
    captureException(error, {
      extra: errorInfo,
      tags: {
        component: 'review-interface',
        boundary: 'use-error-boundary',
      },
    });
  }, []);

  const handleAsyncError = useCallback((error: Error, context?: string) => {
    console.error(`Async error in ${context || 'unknown context'}:`, error);
    
    captureException(error, {
      extra: { context },
      tags: {
        component: 'review-interface',
        type: 'async-error',
      },
    });
  }, []);

  const wrapAsync = useCallback(<T extends (...args: unknown[]) => Promise<unknown>>(
    asyncFn: T,
    context?: string
  ): T => {
    return ((...args: unknown[]) => {
      return asyncFn(...args).catch((error: Error) => {
        handleAsyncError(error, context);
        throw error; // Re-throw so calling code can handle it
      });
    }) as T;
  }, [handleAsyncError]);

  return {
    captureError,
    handleAsyncError,
    wrapAsync,
  };
}