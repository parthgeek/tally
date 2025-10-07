import { describe, expect, test, beforeEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitKey,
  createRateLimitResponse,
  RATE_LIMITS,
} from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Clear any existing buckets between tests
    // Note: In a real implementation, you'd want to clear the internal bucket state
  });

  test("allows requests within limit", async () => {
    const result = await checkRateLimit({
      key: "test-key",
      limit: 5,
      windowMs: 60000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  test("denies requests exceeding limit", async () => {
    const config = {
      key: "test-key-2",
      limit: 2,
      windowMs: 60000,
    };

    // Use up the limit
    await checkRateLimit(config);
    await checkRateLimit(config);

    // This should be denied
    const result = await checkRateLimit(config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test("resets tokens after time window", async () => {
    const config = {
      key: "test-key-3",
      limit: 1,
      windowMs: 100, // Very short window for testing
    };

    // Use up the limit
    const firstResult = await checkRateLimit(config);
    expect(firstResult.allowed).toBe(true);

    // Should be denied immediately
    const secondResult = await checkRateLimit(config);
    expect(secondResult.allowed).toBe(false);

    // Wait for window to reset
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be allowed again
    const thirdResult = await checkRateLimit(config);
    expect(thirdResult.allowed).toBe(true);
  });
});

describe("getRateLimitKey", () => {
  test("uses user ID when provided", () => {
    const request = new Request("http://localhost:3000/api/test");
    const key = getRateLimitKey(request, "user-123");

    expect(key).toBe("user:user-123");
  });

  test("falls back to IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: {
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      },
    });
    const key = getRateLimitKey(request);

    expect(key).toBe("ip:192.168.1.1");
  });

  test("uses x-real-ip header when x-forwarded-for not present", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: {
        "x-real-ip": "192.168.1.2",
      },
    });
    const key = getRateLimitKey(request);

    expect(key).toBe("ip:192.168.1.2");
  });

  test("uses unknown when no IP headers present", () => {
    const request = new Request("http://localhost:3000/api/test");
    const key = getRateLimitKey(request);

    expect(key).toBe("ip:unknown");
  });
});

describe("createRateLimitResponse", () => {
  test("returns 429 response with retry-after header", () => {
    const resetTime = Date.now() + 30000; // 30 seconds from now
    const response = createRateLimitResponse(resetTime);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  test("handles past reset time gracefully", () => {
    const resetTime = Date.now() - 1000; // 1 second ago
    const response = createRateLimitResponse(resetTime);

    expect(response.status).toBe(429);
    // Should be 0 or 1 depending on timing
    const retryAfter = parseInt(response.headers.get("retry-after") || "0");
    expect(retryAfter).toBeGreaterThanOrEqual(0);
    expect(retryAfter).toBeLessThanOrEqual(1);
  });
});

describe("RATE_LIMITS configuration", () => {
  test("has expected rate limit configurations", () => {
    expect(RATE_LIMITS.PLAID_LINK_TOKEN.limit).toBe(20);
    expect(RATE_LIMITS.PLAID_LINK_TOKEN.windowMs).toBe(60000);

    expect(RATE_LIMITS.PLAID_EXCHANGE.limit).toBe(5);
    expect(RATE_LIMITS.PLAID_EXCHANGE.windowMs).toBe(60000);

    expect(RATE_LIMITS.API_DEFAULT.limit).toBe(100);
    expect(RATE_LIMITS.API_DEFAULT.windowMs).toBe(60000);
  });
});
