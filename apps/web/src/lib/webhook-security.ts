/**
 * Advanced webhook verification and security
 * Implements multiple layers of webhook authentication and validation
 */

import { NextRequest } from 'next/server';
import { validateRequestBody, validationSchemas } from './validation-enhanced';

export interface WebhookVerificationResult {
  valid: boolean;
  source?: string;
  error?: string;
  requestId?: string;
}

export interface WebhookSecurityConfig {
  enableSignatureVerification: boolean;
  enableTimestampValidation: boolean;
  enableIPWhitelisting: boolean;
  timestampToleranceMs: number;
  allowedIPs: string[];
  secrets: {
    plaid?: string;
    stripe?: string;
    square?: string;
  };
}

/**
 * Advanced webhook signature verification supporting multiple providers
 */
export class WebhookSecurity {
  private config: WebhookSecurityConfig;

  constructor(config: Partial<WebhookSecurityConfig> = {}) {
    this.config = {
      enableSignatureVerification: true,
      enableTimestampValidation: true,
      enableIPWhitelisting: false,
      timestampToleranceMs: 5 * 60 * 1000, // 5 minutes
      allowedIPs: [],
      secrets: {},
      ...config,
    };
  }

  /**
   * Verify Plaid webhook signature and payload
   */
  async verifyPlaidWebhook(
    request: NextRequest,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      const signature = request.headers.get('plaid-verification');
      const requestId = request.headers.get('plaid-request-id');

      if (!signature) {
        const result: WebhookVerificationResult = {
          valid: false,
          error: 'Missing Plaid signature header',
        };
        if (requestId) {
          result.requestId = requestId;
        }
        return result;
      }

      // Environment-specific verification
      const plaidEnv = process.env.PLAID_ENV || 'sandbox';
      const webhookSecret = this.config.secrets.plaid || process.env.PLAID_WEBHOOK_SECRET;

      // Fail closed in production if secret is missing
      if (!webhookSecret && (plaidEnv === 'production' || plaidEnv === 'development')) {
        console.error('PLAID_WEBHOOK_SECRET required in production environment');
        const result: WebhookVerificationResult = {
          valid: false,
          error: 'Webhook verification not configured',
        };
        if (requestId) {
          result.requestId = requestId;
        }
        return result;
      }

      // Skip verification in sandbox if no secret is configured
      if (!webhookSecret && plaidEnv === 'sandbox') {
        console.warn('Plaid webhook signature verification skipped in sandbox mode');
        const result: WebhookVerificationResult = {
          valid: true,
          source: 'plaid-sandbox',
        };
        if (requestId) {
          result.requestId = requestId;
        }
        return result;
      }

      // Verify HMAC signature
      const isValid = await this.verifyHmacSha256(
        webhookSecret!,
        rawBody,
        signature
      );

      if (!isValid) {
        console.warn('Invalid Plaid webhook signature', { requestId });
        const result: WebhookVerificationResult = {
          valid: false,
          error: 'Invalid signature',
        };
        if (requestId) {
          result.requestId = requestId;
        }
        return result;
      }

      // Validate payload structure
      const validationResult = await validateRequestBody(
        new Request(request.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: rawBody,
        }),
        validationSchemas.plaid.webhookVerification
      );

      if (!validationResult.success) {
        const result: WebhookVerificationResult = {
          valid: false,
          error: 'Invalid webhook payload',
        };
        if (requestId) {
          result.requestId = requestId;
        }
        return result;
      }

      const result: WebhookVerificationResult = {
        valid: true,
        source: 'plaid',
      };
      if (requestId) {
        result.requestId = requestId;
      }
      return result;

    } catch (error) {
      console.error('Plaid webhook verification error:', error);
      return {
        valid: false,
        error: 'Verification failed',
      };
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  async verifyStripeWebhook(
    request: NextRequest,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      const signature = request.headers.get('stripe-signature');
      const stripeSecret = this.config.secrets.stripe || process.env.STRIPE_WEBHOOK_SECRET;

      if (!signature || !stripeSecret) {
        return {
          valid: false,
          error: 'Missing Stripe signature or secret',
        };
      }

      // Parse Stripe signature header
      const elements = signature.split(',');
      const signatureElements: Record<string, string> = {};

      for (const element of elements) {
        const [key, value] = element.split('=');
        if (key && value) {
          signatureElements[key] = value;
        }
      }

      const timestamp = signatureElements.t;
      const v1Signature = signatureElements.v1;

      if (!timestamp || !v1Signature) {
        return {
          valid: false,
          error: 'Invalid Stripe signature format',
        };
      }

      // Verify timestamp if enabled
      if (this.config.enableTimestampValidation) {
        const webhookTimestamp = parseInt(timestamp) * 1000;
        const now = Date.now();

        if (Math.abs(now - webhookTimestamp) > this.config.timestampToleranceMs) {
          return {
            valid: false,
            error: 'Webhook timestamp out of tolerance',
          };
        }
      }

      // Create expected signature
      const payload = `${timestamp}.${rawBody}`;
      const expectedSignature = await this.computeHmacSha256(stripeSecret, payload);

      if (expectedSignature !== v1Signature) {
        return {
          valid: false,
          error: 'Invalid Stripe signature',
        };
      }

      return {
        valid: true,
        source: 'stripe',
      };

    } catch (error) {
      console.error('Stripe webhook verification error:', error);
      return {
        valid: false,
        error: 'Verification failed',
      };
    }
  }

  /**
   * Verify Square webhook signature
   */
  async verifySquareWebhook(
    request: NextRequest,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      const signature = request.headers.get('x-square-hmacsha256-signature');
      const squareSecret = this.config.secrets.square || process.env.SQUARE_WEBHOOK_SECRET;

      if (!signature || !squareSecret) {
        return {
          valid: false,
          error: 'Missing Square signature or secret',
        };
      }

      // Square uses the notification URL + body for signature
      const notificationUrl = process.env.SQUARE_WEBHOOK_URL || request.url;
      const payload = notificationUrl + rawBody;

      const isValid = await this.verifyHmacSha256(squareSecret, payload, signature);

      const result: WebhookVerificationResult = {
        valid: isValid,
        source: 'square',
      };

      if (!isValid) {
        result.error = 'Invalid Square signature';
      }

      return result;

    } catch (error) {
      console.error('Square webhook verification error:', error);
      return {
        valid: false,
        error: 'Verification failed',
      };
    }
  }

  /**
   * Validate webhook source IP address
   */
  validateSourceIP(request: NextRequest): boolean {
    if (!this.config.enableIPWhitelisting || this.config.allowedIPs.length === 0) {
      return true;
    }

    const clientIP = this.extractClientIP(request);
    if (!clientIP) {
      return false;
    }

    return this.config.allowedIPs.includes(clientIP);
  }

  /**
   * Extract client IP address considering various proxy headers
   */
  private extractClientIP(request: NextRequest): string | null {
    // Check various headers in order of preference
    const headers = [
      'cf-connecting-ip', // Cloudflare
      'fastly-client-ip', // Fastly
      'x-real-ip',
      'x-forwarded-for',
      'x-client-ip',
      'x-cluster-client-ip',
    ];

    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        // Handle comma-separated IPs (take the first one)
        const ip = value.split(',')[0]?.trim();
        if (ip && this.isValidIP(ip)) {
          return ip;
        }
      }
    }

    return null;
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Verify HMAC-SHA256 signature
   */
  private async verifyHmacSha256(
    secret: string,
    payload: string,
    signature: string
  ): Promise<boolean> {
    try {
      const expectedSignature = await this.computeHmacSha256(secret, payload);
      const providedSignature = signature.replace('sha256=', '');

      return this.secureCompare(expectedSignature, providedSignature);
    } catch (error) {
      console.error('HMAC verification error:', error);
      return false;
    }
  }

  /**
   * Compute HMAC-SHA256 signature
   */
  private async computeHmacSha256(secret: string, payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Secure string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

/**
 * Auto-detect webhook provider and verify
 */
export async function verifyWebhook(
  request: NextRequest,
  rawBody: string,
  config?: Partial<WebhookSecurityConfig>
): Promise<WebhookVerificationResult> {
  const security = new WebhookSecurity(config);

  // Check IP whitelist if enabled
  if (!security.validateSourceIP(request)) {
    return {
      valid: false,
      error: 'Source IP not whitelisted',
    };
  }

  // Auto-detect provider based on headers
  const plaidSignature = request.headers.get('plaid-verification');
  const stripeSignature = request.headers.get('stripe-signature');
  const squareSignature = request.headers.get('x-square-hmacsha256-signature');

  if (plaidSignature) {
    return await security.verifyPlaidWebhook(request, rawBody);
  }

  if (stripeSignature) {
    return await security.verifyStripeWebhook(request, rawBody);
  }

  if (squareSignature) {
    return await security.verifySquareWebhook(request, rawBody);
  }

  // Unknown webhook provider
  return {
    valid: false,
    error: 'Unknown webhook provider',
  };
}

/**
 * Middleware for webhook security validation
 */
export function withWebhookSecurity(config?: Partial<WebhookSecurityConfig>) {
  return function (handler: (request: NextRequest, body: string) => Promise<Response>) {
    return async (request: NextRequest): Promise<Response> => {
      try {
        // Get raw body for signature verification
        const rawBody = await request.text();

        // Verify webhook
        const verification = await verifyWebhook(request, rawBody, config);

        if (!verification.valid) {
          console.warn('Webhook verification failed:', {
            error: verification.error,
            source: verification.source,
            requestId: verification.requestId,
            url: request.url,
          });

          return new Response(
            JSON.stringify({
              error: 'Webhook verification failed',
              message: verification.error,
            }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
              },
            }
          );
        }

        // Call the original handler with verified webhook
        return await handler(request, rawBody);

      } catch (error) {
        console.error('Webhook security middleware error:', error);
        return new Response(
          JSON.stringify({
            error: 'Internal security error',
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
          }
        );
      }
    };
  };
}

/**
 * Log webhook security events for monitoring
 */
export function logWebhookSecurityEvent(
  event: 'verification_success' | 'verification_failed' | 'ip_blocked' | 'timestamp_invalid',
  details: {
    source?: string;
    requestId?: string;
    clientIP?: string;
    error?: string;
    timestamp?: number;
  }
): void {
  const logEntry = {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  };

  // In production, send to security monitoring system
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with security monitoring (Datadog, Splunk, etc.)
    console.log('WEBHOOK_SECURITY_EVENT:', JSON.stringify(logEntry));
  } else {
    console.log('Webhook security event:', logEntry);
  }
}

/**
 * Known IP ranges for webhook providers (for IP whitelisting)
 */
export const WEBHOOK_IP_RANGES = {
  plaid: [
    // Plaid webhook IP ranges
    '52.21.26.131/32',
    '52.21.47.157/32',
    '52.41.247.19/32',
    '52.88.82.239/32',
  ],
  stripe: [
    // Stripe webhook IP ranges
    '3.18.12.63/32',
    '3.130.192.231/32',
    '13.235.14.237/32',
    '13.235.122.149/32',
    // ... more IPs would be added here
  ],
  square: [
    // Square webhook IP ranges
    '185.199.108.0/22',
    '185.199.109.0/24',
    '185.199.110.0/24',
    '185.199.111.0/24',
  ],
};

/**
 * Validate IP against CIDR ranges
 */
export function isIPInRange(ip: string, cidrRanges: string[]): boolean {
  // This is a simplified implementation
  // In production, use a proper CIDR matching library
  for (const range of cidrRanges) {
    if (range.includes(ip)) {
      return true;
    }
  }
  return false;
}