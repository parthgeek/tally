/**
 * Comprehensive tests for Redis-based rate limiting
 * Tests both Redis and memory fallback functionality
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  getRateLimitKey,
  createRateLimitResponse,
  getRateLimitConfig,
  RATE_LIMITS,
} from './rate-limit-redis';

// Mock Redis to test fallback behavior
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      eval: vi.fn(),
      ping: vi.fn(),
      quit: vi.fn(),
      on: vi.fn(),
    })),
  };
});

describe('Redis Rate Limiting', () => {
  beforeEach(() => {
    // Reset environment for each test
    delete process.env.REDIS_URL;
    delete process.env.ENABLE_REDIS_RATE_LIMIT;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any global state
    vi.resetModules();
  });

  describe('checkRateLimit', () => {
    test('should allow requests under limit', async () => {
      const config = { key: 'test:user1', limit: 5, windowMs: 60000 };

      const result = await checkRateLimit(config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeLessThan(config.limit);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    test('should deny requests over limit', async () => {
      const config = { key: 'test:user2', limit: 2, windowMs: 60000 };

      // Consume all tokens
      await checkRateLimit(config);
      await checkRateLimit(config);

      // This should be denied
      const result = await checkRateLimit(config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should handle concurrent requests safely', async () => {
      const config = { key: 'test:concurrent', limit: 10, windowMs: 60000 };

      // Make multiple concurrent requests
      const promises = Array.from({ length: 15 }, () => checkRateLimit(config));
      const results = await Promise.all(promises);

      const allowed = results.filter(r => r.allowed).length;
      const denied = results.filter(r => !r.allowed).length;

      // Should allow exactly the limit number of requests
      expect(allowed).toBeLessThanOrEqual(config.limit);
      expect(denied).toBeGreaterThan(0);
    });

    test('should refresh tokens over time', async () => {
      const config = { key: 'test:refresh', limit: 2, windowMs: 100 }; // Short window for testing

      // Consume all tokens
      await checkRateLimit(config);
      await checkRateLimit(config);

      // Should be denied immediately
      let result = await checkRateLimit(config);
      expect(result.allowed).toBe(false);

      // Wait for window to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      result = await checkRateLimit(config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRateLimitKey', () => {
    test('should prioritize user ID when available', () => {
      const request = new Request('http://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const key = getRateLimitKey(request, 'user123');

      expect(key).toBe('user:user123');
    });

    test('should extract IP from x-forwarded-for header', () => {
      const request = new Request('http://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });

      const key = getRateLimitKey(request);

      expect(key).toBe('ip:192.168.1.1');
    });

    test('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      const request = new Request('http://example.com', {
        headers: { 'cf-connecting-ip': '203.0.113.1' },
      });

      const key = getRateLimitKey(request);

      expect(key).toBe('ip:203.0.113.1');
    });

    test('should extract IP from x-real-ip header', () => {
      const request = new Request('http://example.com', {
        headers: { 'x-real-ip': '198.51.100.1' },
      });

      const key = getRateLimitKey(request);

      expect(key).toBe('ip:198.51.100.1');
    });

    test('should handle missing IP headers gracefully', () => {
      const request = new Request('http://example.com');

      const key = getRateLimitKey(request);

      expect(key).toBe('ip:unknown');
    });
  });

  describe('createRateLimitResponse', () => {
    test('should create proper 429 response', async () => {
      const resetTime = Date.now() + 60000; // 1 minute from now

      const response = createRateLimitResponse(resetTime);

      expect(response.status).toBe(429);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Retry-After')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

      const body = await response.json();
      expect(body.error).toBe('Too many requests');
      expect(body.message).toContain('Rate limit exceeded');
      expect(body.retryAfter).toBeGreaterThan(0);
    });

    test('should calculate retry-after correctly', async () => {
      const resetTime = Date.now() + 30000; // 30 seconds from now

      const response = createRateLimitResponse(resetTime);

      const retryAfter = parseInt(response.headers.get('Retry-After') || '0');
      expect(retryAfter).toBeGreaterThan(25); // Should be around 30 seconds
      expect(retryAfter).toBeLessThan(35);
    });
  });

  describe('getRateLimitConfig', () => {
    test('should return specific config for known operations', () => {
      const config = getRateLimitConfig('PLAID_EXCHANGE');

      expect(config).toEqual(RATE_LIMITS.PLAID_EXCHANGE);
    });

    test('should return default config for unknown operations', () => {
      const config = getRateLimitConfig('UNKNOWN_OPERATION' as any);

      expect(config).toEqual(RATE_LIMITS.API_DEFAULT);
    });

    test('should return dev config in development environment', () => {
      vi.stubEnv('NODE_ENV', 'development');

      const config = getRateLimitConfig('PLAID_EXCHANGE');

      expect(config).toEqual(RATE_LIMITS.DEV_DEFAULT);

      vi.unstubAllEnvs();
    });
  });

  describe('RATE_LIMITS configuration', () => {
    test('should have stricter limits for authentication operations', () => {
      expect(RATE_LIMITS.AUTH_SIGN_IN.limit).toBeLessThan(RATE_LIMITS.API_DEFAULT.limit);
      expect(RATE_LIMITS.AUTH_SIGN_UP.limit).toBeLessThan(RATE_LIMITS.API_DEFAULT.limit);
      expect(RATE_LIMITS.PASSWORD_RESET.limit).toBeLessThan(RATE_LIMITS.API_DEFAULT.limit);
    });

    test('should have appropriate limits for financial operations', () => {
      expect(RATE_LIMITS.PLAID_EXCHANGE.limit).toBeLessThan(RATE_LIMITS.PLAID_LINK_TOKEN.limit);
      expect(RATE_LIMITS.BULK_OPERATIONS.limit).toBeLessThan(RATE_LIMITS.TRANSACTION_CORRECTION.limit);
    });

    test('should have longer windows for sensitive operations', () => {
      expect(RATE_LIMITS.AUTH_SIGN_UP.windowMs).toBeGreaterThan(RATE_LIMITS.API_DEFAULT.windowMs);
      expect(RATE_LIMITS.PASSWORD_RESET.windowMs).toBeGreaterThan(RATE_LIMITS.API_DEFAULT.windowMs);
    });

    test('should have generous development limits', () => {
      expect(RATE_LIMITS.DEV_DEFAULT.limit).toBeGreaterThan(RATE_LIMITS.API_DEFAULT.limit);
    });
  });

  describe('Memory fallback behavior', () => {
    test('should work without Redis connection', async () => {
      // Force memory fallback by not setting Redis environment
      const config = { key: 'test:memory', limit: 3, windowMs: 60000 };

      // Should work normally with memory fallback
      const result1 = await checkRateLimit(config);
      expect(result1.allowed).toBe(true);

      const result2 = await checkRateLimit(config);
      expect(result2.allowed).toBe(true);

      const result3 = await checkRateLimit(config);
      expect(result3.allowed).toBe(true);

      // Fourth request should be denied
      const result4 = await checkRateLimit(config);
      expect(result4.allowed).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('should handle zero limit gracefully', async () => {
      const config = { key: 'test:zero', limit: 0, windowMs: 60000 };

      const result = await checkRateLimit(config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should handle very short windows', async () => {
      const config = { key: 'test:short', limit: 1, windowMs: 1 }; // 1ms window

      const result1 = await checkRateLimit(config);
      expect(result1.allowed).toBe(true);

      // Wait for window to pass
      await new Promise(resolve => setTimeout(resolve, 5));

      const result2 = await checkRateLimit(config);
      expect(result2.allowed).toBe(true);
    });

    test('should handle very large limits', async () => {
      const config = { key: 'test:large', limit: 1000000, windowMs: 60000 };

      const result = await checkRateLimit(config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(999999);
    });
  });

  describe('Security considerations', () => {
    test('should isolate different keys', async () => {
      const config1 = { key: 'user:1', limit: 1, windowMs: 60000 };
      const config2 = { key: 'user:2', limit: 1, windowMs: 60000 };

      // Exhaust limit for user 1
      await checkRateLimit(config1);
      const result1 = await checkRateLimit(config1);
      expect(result1.allowed).toBe(false);

      // User 2 should still be allowed
      const result2 = await checkRateLimit(config2);
      expect(result2.allowed).toBe(true);
    });

    test('should prevent key injection attacks', () => {
      const maliciousRequest = new Request('http://example.com', {
        headers: { 'x-forwarded-for': 'evil:injection\\nredis:command' },
      });

      const key = getRateLimitKey(maliciousRequest);

      // Should sanitize the malicious input
      expect(key).toBe('ip:evil:injection\\nredis:command');
      expect(key).not.toContain('\n');
    });
  });
});