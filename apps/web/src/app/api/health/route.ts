import { NextResponse } from "next/server";

export async function GET() {
  try {
    const health = {
      status: "healthy",
      message: "Tally API is healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || "unknown",
      uptime: process.uptime(),
      checks: {
        posthog: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
        supabase:
          !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        sentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      },
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        message: "Health check failed",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
