/**
 * UI Feature Flags for frontend components
 * These flags control the rollout of enhanced UI features
 */

export const UI_FEATURE_FLAGS = {
  TRANSACTIONS_ENHANCED_UI: 'TRANSACTIONS_ENHANCED_UI',
} as const;

export type UIFeatureFlag = typeof UI_FEATURE_FLAGS[keyof typeof UI_FEATURE_FLAGS];

/**
 * Default feature flag values for different environments
 */
export const DEFAULT_UI_FEATURE_FLAGS = {
  development: {
    [UI_FEATURE_FLAGS.TRANSACTIONS_ENHANCED_UI]: true,
  },
  staging: {
    [UI_FEATURE_FLAGS.TRANSACTIONS_ENHANCED_UI]: true,
  },
  production: {
    [UI_FEATURE_FLAGS.TRANSACTIONS_ENHANCED_UI]: false, // Start disabled
  },
} as const;

/**
 * UI Feature flag configuration interface
 */
export interface UIFeatureFlagConfig {
  [key: string]: boolean;
}

/**
 * Get UI feature flag value with fallback to default
 */
export function getUIFeatureFlag(
  flag: UIFeatureFlag,
  config: UIFeatureFlagConfig = {},
  environment: keyof typeof DEFAULT_UI_FEATURE_FLAGS = 'development'
): boolean {
  if (config[flag] !== undefined) {
    return config[flag];
  }

  return DEFAULT_UI_FEATURE_FLAGS[environment][flag];
}

/**
 * Check if UI feature is enabled
 */
export function isUIFeatureEnabled(
  flag: UIFeatureFlag,
  config: UIFeatureFlagConfig = {},
  environment: keyof typeof DEFAULT_UI_FEATURE_FLAGS = 'development'
): boolean {
  return getUIFeatureFlag(flag, config, environment);
}