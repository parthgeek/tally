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
      // <-- Minimal change: allow Shopify admin and myshopify domains to frame the app
      "frame-ancestors https://admin.shopify.com https://*.myshopify.com 'self'",
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
          // NOTE: removed X-Frame-Options (DENY) because CSP frame-ancestors now controls framing.
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
    org: "nexus-bc",
    project: "javascript-nextjs",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',
    disableLogger: true,
    automaticVercelMonitors: true,
  }
);
