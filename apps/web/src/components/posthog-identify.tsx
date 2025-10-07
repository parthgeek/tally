"use client";

import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { createClient } from "@/lib/supabase";

export function PostHogIdentify() {
  const posthog = usePostHog();
  const supabase = createClient();
  const [isIdentifying, setIsIdentifying] = useState(false);

  useEffect(() => {
    // Skip if PostHog is not available yet
    if (!posthog) {
      return;
    }

    const identifyUser = async () => {
      // Prevent multiple simultaneous identification attempts
      if (isIdentifying) {
        return;
      }

      setIsIdentifying(true);

      try {
        // Add timeout to prevent hanging
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth timeout")), 5000)
        );

        const result = (await Promise.race([userPromise, timeoutPromise])) as {
          data: { user: { id: string; email: string } | null };
        };
        const {
          data: { user },
        } = result;

        if (user?.id) {
          // Get current org from cookie (non-blocking)
          const cookies = document.cookie.split(";");
          const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
          const currentOrgId = orgCookie ? orgCookie.split("=")[1] : null;

          // Identify user with PostHog (non-blocking)
          try {
            posthog.identify(user.id, {
              email: user.email,
              orgId: currentOrgId,
            });

            // Set user properties (non-blocking)
            posthog.setPersonProperties({
              email: user.email,
              currentOrgId: currentOrgId,
            });
          } catch (error) {
            console.warn("PostHog identification failed:", error);
          }
        }
      } catch (error) {
        console.warn("Error identifying user with PostHog:", error);
      } finally {
        setIsIdentifying(false);
      }
    };

    // Run identification in next tick to avoid blocking render
    const timeoutId = setTimeout(identifyUser, 0);

    // Listen for auth changes (non-blocking)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        setTimeout(() => {
          try {
            // Get current org from cookie on sign in
            const cookies = document.cookie.split(";");
            const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
            const currentOrgId = orgCookie ? orgCookie.split("=")[1] : null;

            posthog.identify(session.user.id, {
              email: session.user.email,
              orgId: currentOrgId,
            });
          } catch (error) {
            console.warn("PostHog sign-in identification failed:", error);
          }
        }, 0);
      } else if (event === "SIGNED_OUT") {
        setTimeout(() => {
          try {
            posthog.reset();
          } catch (error) {
            console.warn("PostHog reset failed:", error);
          }
        }, 0);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [posthog, supabase.auth, isIdentifying]);

  // This component doesn't render anything
  return null;
}
