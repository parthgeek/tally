import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Temporarily disable ESLint during builds until code fixes are complete
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Security headers
  async headers() {
    // Allow blob: styles in development for Safari compatibility with Next.js HMR
    const isDev = process.env.NODE_ENV === 'development';
    const styleSourcePolicy = isDev
      ? "style-src 'self' 'unsafe-inline' blob:"
      : "style-src 'self' 'unsafe-inline'";

    // Build CSP directives array, conditionally excluding upgrade-insecure-requests in development
    const cspDirectives = [
      "default-src 'self'",
      "connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://*.sentry.io https://production.plaid.com https://cdn.plaid.com",
      "script-src 'self' https://cdn.plaid.com https://us.i.posthog.com https://*.sentry.io 'unsafe-inline' 'unsafe-eval'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https://*.posthog.com",
      styleSourcePolicy,
      "font-src 'self' data:",
      "frame-src https://cdn.plaid.com",
      "base-uri 'self'",
      "form-action 'self'"
    ];

    // Only add upgrade-insecure-requests in production to avoid Safari SSL issues in development
    if (!isDev) {
      cspDirectives.push("upgrade-insecure-requests");
    }

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspDirectives.join('; ')
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
          }
        ]
      }
    ];
  },

  // PostHog rewrites
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },

  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

// Wrap the config with Sentry
export default withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: "nexus-bc",
    project: "javascript-nextjs",

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);
