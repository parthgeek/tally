/**
 * Rate limiting utility for API endpoints
 * Implements token bucket algorithm with in-memory storage for dev/testing
 * TODO: Replace with Redis for production to survive serverless restarts
 */

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

// In-memory rate limit storage (use Redis in production)
const buckets = new Map<string, RateLimitBucket>();

interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check if a request should be rate limited
 * Uses token bucket algorithm: tokens are refilled at a steady rate
 * and consumed when requests are made
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { key, limit, windowMs } = config;
  const now = Date.now();

  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = {
      tokens: limit,
      lastRefill: now,
    };
    buckets.set(key, bucket);
  }

  // Calculate tokens to add based on time elapsed
  const timeSinceRefill = now - bucket.lastRefill;
  const tokensToAdd = Math.floor((timeSinceRefill / windowMs) * limit);

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  // Check if request can be allowed
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetTime: now + windowMs,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetTime: bucket.lastRefill + windowMs,
  };
}

/**
 * Extract client identifier for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP
 */
export function getRateLimitKey(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Extract IP from headers (handling proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || "unknown";

  return `ip:${ip}`;
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(resetTime: number): Response {
  const retryAfter = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));

  return new Response(
    JSON.stringify({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Rate limiting configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Plaid link token creation - generous limit for legitimate usage
  PLAID_LINK_TOKEN: { limit: 20, windowMs: 60 * 1000 }, // 20 per minute

  // Plaid token exchange - stricter limit for security
  PLAID_EXCHANGE: { limit: 5, windowMs: 60 * 1000 }, // 5 per minute

  // General API endpoints
  API_DEFAULT: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute
} as const;
