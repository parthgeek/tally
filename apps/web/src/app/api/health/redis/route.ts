import { NextRequest } from "next/server";
import { createErrorResponse } from "@/lib/api/with-org";

// Dynamic import to avoid Redis dependency issues
async function testRedisConnection(): Promise<{ status: 'connected' | 'disconnected' | 'error'; error?: string }> {
  try {
    const { getGlobalRateLimiter } = await import("@/lib/rate-limit-redis");

    // Test Redis connection by attempting a health check
    const testConfig = {
      key: 'health-check',
      limit: 1,
      windowMs: 1000,
    };

    const limiter = getGlobalRateLimiter();
    await limiter.checkRateLimit(testConfig);

    return { status: 'connected' };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET(_request: NextRequest) {
  try {
    const redisHealth = await testRedisConnection();

    const healthStatus = {
      redis: redisHealth,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };

    const isHealthy = redisHealth.status === 'connected' || redisHealth.status === 'disconnected';

    return Response.json(healthStatus, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    return createErrorResponse("Health check failed", 500);
  }
}