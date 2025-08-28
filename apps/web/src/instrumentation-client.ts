// Use client-specific imports only
import { getPosthogClientBrowser, initSentryClient } from "@nexus/analytics/client";
import { replayIntegration } from "@sentry/nextjs";

// Initialize PostHog for client-side
getPosthogClientBrowser();

// Initialize Sentry for client-side using the analytics package
initSentryClient({
  // Override specific settings to match the previous configuration
  tracesSampleRate: 1,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
  integrations: [
    // Add replay integration from @sentry/nextjs
    replayIntegration(),
  ],
});

// Re-export Sentry helpers for Next.js integration
export { captureRouterTransitionStart as onRouterTransitionStart } from "@sentry/nextjs";
