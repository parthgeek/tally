"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { getPosthogClientBrowser } from "@nexus/analytics/client";
import { PostHogProvider } from "posthog-js/react";
import { PostHogIdentify } from "@/components/posthog-identify";

// Use the centralized PostHog client
const posthog = getPosthogClientBrowser();

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

  const [supabaseClient] = useState(() => createClientComponentClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContextProvider supabaseClient={supabaseClient}>
        {posthog ? (
          <PostHogProvider client={posthog}>
            <PostHogIdentify />
            {children}
          </PostHogProvider>
        ) : (
          children
        )}
      </SessionContextProvider>
    </QueryClientProvider>
  );
}
