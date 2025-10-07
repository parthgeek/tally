/**
 * Railway deployment configuration validation
 * Ensures all required environment variables are present
 */

interface RailwayConfig {
  isRailway: boolean;
  environment: string;
  requiredVars: Record<string, boolean>;
  optionalVars: Record<string, boolean>;
  missingRequired: string[];
}

export function validateRailwayConfig(): RailwayConfig {
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
  const environment = process.env.NODE_ENV || "development";

  // Required environment variables for Railway deployment
  const requiredVars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  // Optional but recommended environment variables
  const optionalVars = {
    NEXT_PUBLIC_POSTHOG_KEY: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: !!process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_ORG: !!process.env.SENTRY_ORG,
    SENTRY_PROJECT: !!process.env.SENTRY_PROJECT,
    REDIS_URL: !!process.env.REDIS_URL,
  };

  const missingRequired = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  return {
    isRailway,
    environment,
    requiredVars,
    optionalVars,
    missingRequired,
  };
}

export function logConfigurationStatus() {
  const config = validateRailwayConfig();

  console.log("🚀 Railway Configuration Status:");
  console.log(`  Environment: ${config.environment}`);
  console.log(`  Railway Deployment: ${config.isRailway ? "Yes" : "No"}`);

  if (config.missingRequired.length > 0) {
    console.warn("⚠️  Missing required environment variables:");
    config.missingRequired.forEach((varName) => {
      console.warn(`    - ${varName}`);
    });
  } else {
    console.log("✅ All required environment variables are present");
  }

  const missingOptional = Object.entries(config.optionalVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingOptional.length > 0) {
    console.log("ℹ️  Missing optional environment variables:");
    missingOptional.forEach((varName) => {
      console.log(`    - ${varName}`);
    });
  }

  return config;
}
