/**
 * Production-grade Redis-based rate limiting for distributed environments
 * Implements sliding window counter algorithm with automatic failover to in-memory storage
 */

import Redis from 'ioredis';

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

interface RedisRateLimiter {
  checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult>;
  cleanup(): Promise<void>;
}

/**
 * Redis-based sliding window rate limiter
 * Uses atomic Lua scripts for consistency in distributed environments
 */
class ProductionRedisRateLimiter implements RedisRateLimiter {
  private redis: Redis;
  private readonly luaScript = `
    local key = KEYS[1]
    local window = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    -- Remove expired entries from sorted set
    redis.call('zremrangebyscore', key, 0, now - window)

    -- Count current requests in window
    local current = redis.call('zcard', key)

    if current < limit then
      -- Add current request with score = timestamp
      redis.call('zadd', key, now, now .. ':' .. math.random())
      -- Set expiration to window + buffer
      redis.call('expire', key, math.ceil(window / 1000) + 60)
      return {1, limit - current - 1, now + window}
    else
      -- Find oldest entry to calculate reset time
      local oldest = redis.call('zrange', key, 0, 0, 'WITHSCORES')
      local resetTime = now + window
      if #oldest > 0 then
        resetTime = tonumber(oldest[2]) + window
      end
      return {0, 0, resetTime}
    end
  `;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Fail fast on connection issues for development
      connectTimeout: 2000,
    });

    // Handle Redis connection errors gracefully
    this.redis.on('error', (error) => {
      console.warn('Redis rate limiter connection error:', error.message);
    });
  }

  async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      const result = await this.redis.eval(
        this.luaScript,
        1,
        `rate_limit:${config.key}`,
        config.windowMs.toString(),
        config.limit.toString(),
        Date.now().toString()
      ) as [number, number, number];

      return {
        allowed: result[0] === 1,
        remaining: result[1],
        resetTime: result[2],
      };
    } catch (error) {
      console.warn('Redis rate limit check failed, will use fallback:', error);
      throw error; // Let fallback handler catch this
    }
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }
}

/**
 * In-memory fallback rate limiter using token bucket algorithm
 * Used when Redis is unavailable
 */
class FallbackMemoryRateLimiter implements RedisRateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, limit, windowMs } = config;
    const now = Date.now();

    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: limit, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Token bucket refill calculation
    const timeSinceRefill = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timeSinceRefill / windowMs) * limit);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

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

  async cleanup(): Promise<void> {
    this.buckets.clear();
  }
}

/**
 * Intelligent rate limiter that uses Redis in production and falls back to memory
 */
class HybridRateLimiter {
  private redisLimiter: ProductionRedisRateLimiter | null = null;
  private memoryLimiter = new FallbackMemoryRateLimiter();
  private useRedis = false;

  constructor() {
    // Only attempt Redis connection in production or when explicitly configured
    const shouldUseRedis =
      process.env.NODE_ENV === 'production' ||
      process.env.REDIS_URL ||
      process.env.ENABLE_REDIS_RATE_LIMIT === 'true';

    if (shouldUseRedis) {
      this.redisLimiter = new ProductionRedisRateLimiter();
      this.testRedisConnection();
    }
  }

  private async testRedisConnection(): Promise<void> {
    if (!this.redisLimiter) return;

    try {
      // Simple ping to test connectivity with timeout
      await Promise.race([
        this.redisLimiter.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout')), 3000)
        )
      ]);
      this.useRedis = true;
      console.log('Redis rate limiter initialized successfully');
    } catch (error) {
      console.warn('Redis rate limiter unavailable, using memory fallback:', error);
      this.useRedis = false;
    }
  }

  async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    if (this.useRedis && this.redisLimiter) {
      try {
        return await this.redisLimiter.checkRateLimit(config);
      } catch (error) {
        console.warn('Redis rate limit failed, falling back to memory:', error);
        this.useRedis = false; // Disable Redis for subsequent requests
        // Ensure we always fallback to memory limiter on Redis failure
        return await this.memoryLimiter.checkRateLimit(config);
      }
    }

    // Default to memory limiter when Redis is not available
    return await this.memoryLimiter.checkRateLimit(config);
  }

  async cleanup(): Promise<void> {
    if (this.redisLimiter) {
      await this.redisLimiter.cleanup();
    }
    await this.memoryLimiter.cleanup();
  }
}

// Global rate limiter instance with proper cleanup
let globalRateLimiter: HybridRateLimiter | null = null;

function getRateLimiter(): HybridRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new HybridRateLimiter();

    // Cleanup on process exit
    process.on('SIGTERM', async () => {
      if (globalRateLimiter) {
        await globalRateLimiter.cleanup();
      }
    });
  }

  return globalRateLimiter;
}

/**
 * Enhanced rate limiting with automatic Redis/memory hybrid approach
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const limiter = getGlobalRateLimiter();
  return await limiter.checkRateLimit(config);
}

/**
 * Get the global rate limiter instance for health checks
 */
export function getGlobalRateLimiter(): HybridRateLimiter {
  return getRateLimiter();
}

/**
 * Extract client identifier for rate limiting with enhanced fingerprinting
 */
export function getRateLimitKey(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Enhanced IP extraction with proxy support
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  const fastlyClientIp = request.headers.get('fastly-client-ip'); // Fastly

  const ip = cfConnectingIp || fastlyClientIp || forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  return `ip:${ip}`;
}

/**
 * Create enhanced rate limit error response with security headers
 */
export function createRateLimitResponse(resetTime: number): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
        // Security headers
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

/**
 * Enhanced rate limiting configurations with sliding window support
 */
export const RATE_LIMITS = {
  // Authentication endpoints - stricter limits
  AUTH_SIGN_IN: { limit: 5, windowMs: 5 * 60 * 1000 }, // 5 per 5 minutes
  AUTH_SIGN_UP: { limit: 3, windowMs: 10 * 60 * 1000 }, // 3 per 10 minutes
  PASSWORD_RESET: { limit: 3, windowMs: 15 * 60 * 1000 }, // 3 per 15 minutes

  // Plaid operations - moderate limits
  PLAID_LINK_TOKEN: { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
  PLAID_EXCHANGE: { limit: 5, windowMs: 60 * 1000 }, // 5 per minute
  PLAID_WEBHOOK: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute

  // Financial operations - careful limits
  TRANSACTION_CORRECTION: { limit: 50, windowMs: 60 * 1000 }, // 50 per minute
  BULK_OPERATIONS: { limit: 10, windowMs: 60 * 1000 }, // 10 per minute
  EXPORT_CREATION: { limit: 5, windowMs: 60 * 1000 }, // 5 per minute

  // General API endpoints
  API_DEFAULT: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute
  API_HEAVY: { limit: 20, windowMs: 60 * 1000 }, // 20 per minute for expensive operations

  // Development/testing - more generous
  DEV_DEFAULT: { limit: 1000, windowMs: 60 * 1000 }, // 1000 per minute in dev
} as const;

/**
 * Get appropriate rate limit config based on environment
 */
export function getRateLimitConfig(operation: keyof typeof RATE_LIMITS) {
  if (process.env.NODE_ENV === 'development' && RATE_LIMITS[operation]) {
    // Use more generous limits in development
    return RATE_LIMITS.DEV_DEFAULT;
  }

  return RATE_LIMITS[operation] || RATE_LIMITS.API_DEFAULT;
}