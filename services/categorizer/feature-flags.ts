/**
 * Centralized feature flags for categorizer engine
 * These flags control the rollout of the enhanced hybrid categorization system
 */

export enum CategorizerFeatureFlag {
  // Core hybrid engine flags
  HYBRID_ENGINE_ENABLED = 'categorizer_hybrid_engine_enabled',
  ENHANCED_PASS1_RULES = 'categorizer_enhanced_pass1_rules',
  LLM_FALLBACK_ENABLED = 'categorizer_llm_fallback_enabled',

  // Pass-1 enhancement flags
  MCC_CATEGORY_MAPPING = 'categorizer_mcc_category_mapping',
  VENDOR_PATTERN_MATCHING = 'categorizer_vendor_pattern_matching',
  KEYWORD_HEURISTICS = 'categorizer_keyword_heuristics',
  WEIGHTED_SIGNAL_AGGREGATION = 'categorizer_weighted_signal_aggregation',

  // Guardrail flags
  PRE_CATEGORIZATION_GUARDRAILS = 'categorizer_pre_guardrails',
  POST_LLM_GUARDRAILS = 'categorizer_post_llm_guardrails',
  MCC_COMPATIBILITY_VALIDATION = 'categorizer_mcc_compatibility_validation',

  // LLM enhancement flags
  PASS1_CONTEXT_TO_LLM = 'categorizer_pass1_context_to_llm',
  STRUCTURED_LLM_PROMPTS = 'categorizer_structured_llm_prompts',
  LLM_RETRY_WITH_BACKOFF = 'categorizer_llm_retry_with_backoff',

  // Performance and reliability flags
  BATCH_PROCESSING = 'categorizer_batch_processing',
  CONCURRENT_PROCESSING = 'categorizer_concurrent_processing',
  TIMEOUT_HANDLING = 'categorizer_timeout_handling',

  // Monitoring and observability flags
  DETAILED_METRICS_COLLECTION = 'categorizer_detailed_metrics_collection',
  CONFIDENCE_HISTOGRAM_TRACKING = 'categorizer_confidence_histogram_tracking',
  ENGINE_USAGE_ANALYTICS = 'categorizer_engine_usage_analytics',
  RATIONALE_LOGGING = 'categorizer_rationale_logging',

  // Rollout control flags
  CANARY_MODE = 'categorizer_canary_mode',
  SHADOW_MODE = 'categorizer_shadow_mode', // Run new engine alongside old without affecting results
  GRADUAL_ROLLOUT_PERCENTAGE = 'categorizer_gradual_rollout_percentage',
}

/**
 * Default feature flag values for different environments
 */
export const DEFAULT_FEATURE_FLAGS = {
  development: {
    [CategorizerFeatureFlag.HYBRID_ENGINE_ENABLED]: true,
    [CategorizerFeatureFlag.ENHANCED_PASS1_RULES]: true,
    [CategorizerFeatureFlag.LLM_FALLBACK_ENABLED]: true,
    [CategorizerFeatureFlag.MCC_CATEGORY_MAPPING]: true,
    [CategorizerFeatureFlag.VENDOR_PATTERN_MATCHING]: true,
    [CategorizerFeatureFlag.KEYWORD_HEURISTICS]: true,
    [CategorizerFeatureFlag.WEIGHTED_SIGNAL_AGGREGATION]: true,
    [CategorizerFeatureFlag.PRE_CATEGORIZATION_GUARDRAILS]: true,
    [CategorizerFeatureFlag.POST_LLM_GUARDRAILS]: true,
    [CategorizerFeatureFlag.MCC_COMPATIBILITY_VALIDATION]: true,
    [CategorizerFeatureFlag.PASS1_CONTEXT_TO_LLM]: true,
    [CategorizerFeatureFlag.STRUCTURED_LLM_PROMPTS]: true,
    [CategorizerFeatureFlag.LLM_RETRY_WITH_BACKOFF]: true,
    [CategorizerFeatureFlag.BATCH_PROCESSING]: true,
    [CategorizerFeatureFlag.CONCURRENT_PROCESSING]: true,
    [CategorizerFeatureFlag.TIMEOUT_HANDLING]: true,
    [CategorizerFeatureFlag.DETAILED_METRICS_COLLECTION]: true,
    [CategorizerFeatureFlag.CONFIDENCE_HISTOGRAM_TRACKING]: true,
    [CategorizerFeatureFlag.ENGINE_USAGE_ANALYTICS]: true,
    [CategorizerFeatureFlag.RATIONALE_LOGGING]: true,
    [CategorizerFeatureFlag.CANARY_MODE]: false,
    [CategorizerFeatureFlag.SHADOW_MODE]: false,
    [CategorizerFeatureFlag.GRADUAL_ROLLOUT_PERCENTAGE]: 100,
  },

  staging: {
    [CategorizerFeatureFlag.HYBRID_ENGINE_ENABLED]: true,
    [CategorizerFeatureFlag.ENHANCED_PASS1_RULES]: true,
    [CategorizerFeatureFlag.LLM_FALLBACK_ENABLED]: true,
    [CategorizerFeatureFlag.MCC_CATEGORY_MAPPING]: true,
    [CategorizerFeatureFlag.VENDOR_PATTERN_MATCHING]: true,
    [CategorizerFeatureFlag.KEYWORD_HEURISTICS]: true,
    [CategorizerFeatureFlag.WEIGHTED_SIGNAL_AGGREGATION]: true,
    [CategorizerFeatureFlag.PRE_CATEGORIZATION_GUARDRAILS]: true,
    [CategorizerFeatureFlag.POST_LLM_GUARDRAILS]: true,
    [CategorizerFeatureFlag.MCC_COMPATIBILITY_VALIDATION]: true,
    [CategorizerFeatureFlag.PASS1_CONTEXT_TO_LLM]: true,
    [CategorizerFeatureFlag.STRUCTURED_LLM_PROMPTS]: true,
    [CategorizerFeatureFlag.LLM_RETRY_WITH_BACKOFF]: true,
    [CategorizerFeatureFlag.BATCH_PROCESSING]: true,
    [CategorizerFeatureFlag.CONCURRENT_PROCESSING]: false, // More conservative in staging
    [CategorizerFeatureFlag.TIMEOUT_HANDLING]: true,
    [CategorizerFeatureFlag.DETAILED_METRICS_COLLECTION]: true,
    [CategorizerFeatureFlag.CONFIDENCE_HISTOGRAM_TRACKING]: true,
    [CategorizerFeatureFlag.ENGINE_USAGE_ANALYTICS]: true,
    [CategorizerFeatureFlag.RATIONALE_LOGGING]: false, // Reduce noise in staging
    [CategorizerFeatureFlag.CANARY_MODE]: true,
    [CategorizerFeatureFlag.SHADOW_MODE]: false,
    [CategorizerFeatureFlag.GRADUAL_ROLLOUT_PERCENTAGE]: 50,
  },

  production: {
    [CategorizerFeatureFlag.HYBRID_ENGINE_ENABLED]: false, // Start disabled
    [CategorizerFeatureFlag.ENHANCED_PASS1_RULES]: false,
    [CategorizerFeatureFlag.LLM_FALLBACK_ENABLED]: false,
    [CategorizerFeatureFlag.MCC_CATEGORY_MAPPING]: true, // Safe enhancements first
    [CategorizerFeatureFlag.VENDOR_PATTERN_MATCHING]: true,
    [CategorizerFeatureFlag.KEYWORD_HEURISTICS]: false,
    [CategorizerFeatureFlag.WEIGHTED_SIGNAL_AGGREGATION]: false,
    [CategorizerFeatureFlag.PRE_CATEGORIZATION_GUARDRAILS]: true,
    [CategorizerFeatureFlag.POST_LLM_GUARDRAILS]: true,
    [CategorizerFeatureFlag.MCC_COMPATIBILITY_VALIDATION]: true,
    [CategorizerFeatureFlag.PASS1_CONTEXT_TO_LLM]: false,
    [CategorizerFeatureFlag.STRUCTURED_LLM_PROMPTS]: false,
    [CategorizerFeatureFlag.LLM_RETRY_WITH_BACKOFF]: true,
    [CategorizerFeatureFlag.BATCH_PROCESSING]: false,
    [CategorizerFeatureFlag.CONCURRENT_PROCESSING]: false,
    [CategorizerFeatureFlag.TIMEOUT_HANDLING]: true,
    [CategorizerFeatureFlag.DETAILED_METRICS_COLLECTION]: true,
    [CategorizerFeatureFlag.CONFIDENCE_HISTOGRAM_TRACKING]: false,
    [CategorizerFeatureFlag.ENGINE_USAGE_ANALYTICS]: true,
    [CategorizerFeatureFlag.RATIONALE_LOGGING]: false,
    [CategorizerFeatureFlag.CANARY_MODE]: false,
    [CategorizerFeatureFlag.SHADOW_MODE]: true, // Start with shadow mode
    [CategorizerFeatureFlag.GRADUAL_ROLLOUT_PERCENTAGE]: 0,
  },
} as const;

/**
 * Feature flag configuration interface
 */
export interface FeatureFlagConfig {
  [key: string]: boolean | number;
}

/**
 * Get feature flag value with fallback to default
 */
export function getFeatureFlag(
  flag: CategorizerFeatureFlag,
  config: FeatureFlagConfig = {},
  environment: keyof typeof DEFAULT_FEATURE_FLAGS = 'development'
): boolean | number {
  if (config[flag] !== undefined) {
    return config[flag];
  }

  return DEFAULT_FEATURE_FLAGS[environment][flag];
}

/**
 * Check if feature is enabled (handles both boolean and percentage flags)
 */
export function isFeatureEnabled(
  flag: CategorizerFeatureFlag,
  config: FeatureFlagConfig = {},
  environment: keyof typeof DEFAULT_FEATURE_FLAGS = 'development',
  randomValue?: number // For percentage-based rollouts
): boolean {
  const value = getFeatureFlag(flag, config, environment);

  if (typeof value === 'boolean') {
    return value;
  }

  // Handle percentage-based rollouts
  if (typeof value === 'number' && randomValue !== undefined) {
    return randomValue < value;
  }

  return false;
}

/**
 * Get rollout percentage for gradual rollout flags
 */
export function getRolloutPercentage(
  config: FeatureFlagConfig = {},
  environment: keyof typeof DEFAULT_FEATURE_FLAGS = 'development'
): number {
  const value = getFeatureFlag(CategorizerFeatureFlag.GRADUAL_ROLLOUT_PERCENTAGE, config, environment);
  return typeof value === 'number' ? value : 0;
}

/**
 * Check if categorizer should use hybrid engine for this transaction
 */
export function shouldUseHybridEngine(
  transactionId: string,
  config: FeatureFlagConfig = {},
  environment: keyof typeof DEFAULT_FEATURE_FLAGS = 'development'
): boolean {
  // First check if hybrid engine is globally enabled
  if (!isFeatureEnabled(CategorizerFeatureFlag.HYBRID_ENGINE_ENABLED, config, environment)) {
    return false;
  }

  // Check gradual rollout percentage
  const rolloutPercentage = getRolloutPercentage(config, environment);
  if (rolloutPercentage < 100) {
    // Use transaction ID for consistent but pseudo-random rollout
    const hash = simpleHash(transactionId);
    const randomValue = (hash % 100);
    return randomValue < rolloutPercentage;
  }

  return true;
}

/**
 * Simple hash function for consistent rollout decisions
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}