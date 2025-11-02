"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PostHog } from "posthog-js";

import { getPosthogClientBrowserAsync } from "@nexus/analytics/client";
import { PostHogProvider } from "posthog-js/react";
import { PostHogIdentify } from "@/components/posthog-identify";
import { FullPageLoader } from "@/components/ui/loading-spinner";
import { logConfigurationStatus } from "@/lib/railway-config";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  const [posthog, setPosthog] = useState<PostHog | null>(null);
  const [isPosthogLoading, setIsPosthogLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    // Log configuration status for debugging
    if (process.env.NODE_ENV === "development" || process.env.RAILWAY_ENVIRONMENT) {
      logConfigurationStatus();
    }

    // Initialize PostHog asynchronously without blocking render
    let mounted = true;

    const initializePosthog = async () => {
      try {
        // Set a maximum wait time of 3 seconds for PostHog initialization (reduced from 5)
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));

        const posthogPromise = getPosthogClientBrowserAsync();
        const client = await Promise.race([posthogPromise, timeoutPromise]);

        if (mounted) {
          setPosthog(client as PostHog | null);
          setIsPosthogLoading(false);
        }
      } catch (error) {
        console.warn("PostHog initialization failed:", error);
        if (mounted) {
          setInitializationError("Analytics initialization failed");
          setIsPosthogLoading(false);
        }
      }
    };

    // Start initialization but don't block render
    initializePosthog();

    return () => {
      mounted = false;
    };
  }, []);

  // Show loading state only for the first 1.5 seconds to prevent infinite loading (reduced from 2)
  const [showFullLoader, setShowFullLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFullLoader(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // If still loading and within the 1.5-second window, show full page loader
  if (isPosthogLoading && showFullLoader) {
    return <FullPageLoader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="nexus-ui-theme">
        {posthog && !initializationError ? (
          <PostHogProvider client={posthog}>
            <PostHogIdentify />
            {children}
          </PostHogProvider>
        ) : (
          // Render children even if PostHog failed to initialize
          children
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
