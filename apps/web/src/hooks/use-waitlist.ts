"use client";

import { useState } from "react";
import { getPosthogClientBrowser } from "@nexus/analytics/client";

interface UseWaitlistReturn {
  subscribe: (email: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

/**
 * Custom hook for waitlist form submission
 * Handles email validation, API calls, and analytics tracking
 */
export function useWaitlist(): UseWaitlistReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const subscribe = async (email: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join waitlist");
      }

      setSuccess(true);

      // Track successful signup with PostHog (client-side)
      const posthog = getPosthogClientBrowser();
      if (posthog) {
        const emailDomain = email.split("@")[1];
        posthog.capture("waitlist_form_success", {
          email_domain: emailDomain,
          duplicate: data.duplicate || false,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      setError(errorMessage);

      // Track error with PostHog
      const posthog = getPosthogClientBrowser();
      if (posthog) {
        posthog.capture("waitlist_form_error", {
          error_message: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { subscribe, isLoading, error, success };
}
