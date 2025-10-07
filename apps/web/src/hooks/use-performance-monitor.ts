import { useEffect, useRef, useCallback } from "react";
import { reviewEvents } from "@/lib/analytics/review-events";

/**
 * Hook for monitoring performance metrics in the review interface
 * Tracks key performance indicators for optimization
 */
export function usePerformanceMonitor(userId: string, orgId: string) {
  const renderStartTime = useRef<number | undefined>(undefined);
  const lastScrollTime = useRef<number | undefined>(undefined);
  const scrollMetrics = useRef({ count: 0, totalTime: 0 });

  // Track component render performance
  useEffect(() => {
    renderStartTime.current = performance.now();

    return () => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;
        if (renderTime > 100) {
          // Only track slow renders
          console.warn(`Slow render detected: ${renderTime}ms`);
        }
      }
    };
  });

  // Track table virtualization performance
  const trackTablePerformance = useCallback(
    (data: { totalItems: number; renderedItems: number; scrollPerformance?: number }) => {
      reviewEvents.tableVirtualizationPerformance(userId, orgId, {
        total_items: data.totalItems,
        rendered_items: data.renderedItems,
        scroll_performance_ms: data.scrollPerformance || 0,
      });
    },
    [userId, orgId]
  );

  // Track API response times
  const trackApiResponse = useCallback(
    (endpoint: string, responseTime: number, statusCode: number, itemsCount?: number) => {
      reviewEvents.apiResponseTime(userId, orgId, {
        endpoint,
        response_time_ms: responseTime,
        status_code: statusCode,
        ...(itemsCount !== undefined && { items_count: itemsCount }),
      });
    },
    [userId, orgId]
  );

  // Monitor scroll performance
  const handleScroll = useCallback(() => {
    const now = performance.now();
    if (lastScrollTime.current) {
      const scrollTime = now - lastScrollTime.current;
      scrollMetrics.current.count++;
      scrollMetrics.current.totalTime += scrollTime;

      // Track if scroll performance is degrading
      const avgScrollTime = scrollMetrics.current.totalTime / scrollMetrics.current.count;
      if (avgScrollTime > 16.67) {
        // Worse than 60fps
        console.warn(`Poor scroll performance: ${avgScrollTime.toFixed(2)}ms avg`);
      }
    }
    lastScrollTime.current = now;
  }, []);

  // Memory usage monitoring
  const trackMemoryUsage = useCallback(() => {
    if ("memory" in performance) {
      const memory = (performance as any).memory;
      if (memory.usedJSHeapSize > 50 * 1024 * 1024) {
        // > 50MB
        console.warn(`High memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
      }
    }
  }, []);

  // FPS monitoring
  const measureFPS = useCallback(() => {
    let frames = 0;
    const startTime = performance.now();

    function countFrames() {
      frames++;
      requestAnimationFrame(countFrames);
    }

    requestAnimationFrame(countFrames);

    return () => {
      const duration = performance.now() - startTime;
      const fps = Math.round((frames * 1000) / duration);
      if (fps < 30) {
        console.warn(`Low FPS detected: ${fps} fps`);
      }
      return fps;
    };
  }, []);

  // Bundle size and load time tracking
  useEffect(() => {
    // Track page load performance
    if (typeof window !== "undefined") {
      window.addEventListener("load", () => {
        const navigation = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
          if (loadTime > 2000) {
            // > 2 seconds
            console.warn(`Slow page load: ${loadTime}ms`);
          }
        }
      });
    }
  }, []);

  return {
    trackTablePerformance,
    trackApiResponse,
    handleScroll,
    trackMemoryUsage,
    measureFPS,
  };
}
