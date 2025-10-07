"use client";

import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";

// Extend Window interface for chart hover throttling
declare global {
  interface Window {
    chartHoverTimeout?: NodeJS.Timeout;
  }
}

export function useDashboardAnalytics() {
  const posthog = usePostHog();

  const getCurrentOrgId = useCallback(() => {
    const cookies = document.cookie.split(";");
    const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
    return orgCookie ? orgCookie.split("=")[1] : null;
  }, []);

  const trackDashboardViewed = useCallback(() => {
    if (posthog) {
      posthog.capture("dashboard_viewed", {
        orgId: getCurrentOrgId(),
      });
    }
  }, [posthog, getCurrentOrgId]);

  const trackRangeToggle = useCallback(
    (range: "30d" | "90d") => {
      if (posthog) {
        posthog.capture("dashboard_toggle_range", {
          range,
          orgId: getCurrentOrgId(),
        });
      }
    },
    [posthog, getCurrentOrgId]
  );

  const trackAlertClicked = useCallback(
    (type: "low_balance" | "unusual_spend" | "needs_review") => {
      if (posthog) {
        posthog.capture("dashboard_alert_clicked", {
          type,
          orgId: getCurrentOrgId(),
        });
      }
    },
    [posthog, getCurrentOrgId]
  );

  const trackChartHover = useCallback(
    (chart: "inout" | "top5" | "trend") => {
      if (posthog) {
        // Throttle chart hover events to avoid spam
        clearTimeout(window.chartHoverTimeout);
        window.chartHoverTimeout = setTimeout(() => {
          posthog.capture("dashboard_chart_hover", {
            chart,
            orgId: getCurrentOrgId(),
          });
        }, 1000);
      }
    },
    [posthog, getCurrentOrgId]
  );

  return {
    trackDashboardViewed,
    trackRangeToggle,
    trackAlertClicked,
    trackChartHover,
  };
}
