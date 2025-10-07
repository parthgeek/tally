/**
 * Feature flags for development and testing features
 */
export const FEATURE_FLAGS = {
  CATEGORIZER_LAB_ENABLED: "CATEGORIZER_LAB_ENABLED",
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Check if a feature flag is enabled
 */
export function isFeatureFlagEnabled(flag: FeatureFlag): boolean {
  if (typeof window !== "undefined") {
    // Client-side: check localStorage for dev overrides
    const override = localStorage.getItem(flag);
    if (override !== null) {
      return override === "true";
    }
  }

  // Server-side or no override: check environment variable
  return process.env[flag] === "true";
}

/**
 * Check if we're in a development environment where lab features should be available
 */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Check if categorizer lab should be enabled
 */
export function isCategorizerLabEnabled(): boolean {
  // If explicitly set to false, respect that even in development
  if (process.env.CATEGORIZER_LAB_ENABLED === "false") {
    return false;
  }

  return isDevelopmentEnvironment() || isFeatureFlagEnabled(FEATURE_FLAGS.CATEGORIZER_LAB_ENABLED);
}
