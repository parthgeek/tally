// Public API exports for the categorizer package

// Legacy exports (deprecated - use engine/pass1 instead)
export { pass1Categorize, normalizeVendor } from "./pass1.js";
export { GeminiClient } from "./gemini-client.js";

// Universal taxonomy exports
export { 
  categorizeWithUniversalLLM,
  getOrganizationIndustry 
} from "./pass2_llm.js";
export type { 
  UniversalCategorizationContext,
  UniversalCategorizationResult 
} from "./pass2_llm.js";

// New enhanced engine exports
export {
  pass1Categorize as enhancedPass1Categorize,
  validatePass1Context,
  createDefaultPass1Context,
} from "./engine/pass1.js";
export type { Pass1Context, EnhancedCategorizationResult } from "./engine/pass1.js";

// Scoring system exports
export {
  createSignal,
  scoreSignals,
  calibrateConfidence,
  getConfidenceDistribution,
} from "./engine/scorer.js";
export type {
  CategorizationSignal,
  CategoryScore,
  ScoringResult,
  SignalStrength,
} from "./engine/scorer.js";

// Guardrails exports (engine)
export {
  applyGuardrails,
  createUncertainResult,
  validateGuardrailConfig,
  getGuardrailTypes,
  getGuardrailStats,
  DEFAULT_GUARDRAIL_CONFIG,
} from "./engine/guardrails.js";
export type {
  GuardrailViolation,
  GuardrailConfig,
  GuardrailViolationType,
} from "./engine/guardrails.js";
export type { GuardrailResult as EngineGuardrailResult } from "./engine/guardrails.js";

// Rules exports
export {
  getMCCMapping,
  hasMCCMapping,
  getMCCsForCategory,
  isMCCCompatibleWithCategory,
} from "./rules/mcc.js";
export type { MCCMapping, MCCStrength } from "./rules/mcc.js";

export {
  matchVendorPattern,
  findBestVendorMatch,
  UNIVERSAL_VENDOR_PATTERNS,
} from "./rules/vendors.js";
export type { VendorPatternUniversal } from "./rules/vendors.js";

export {
  matchKeywordRules,
  calculateKeywordConfidence,
  getBestKeywordMatch,
  getKeywordRulesForDomain,
  getAvailableDomains,
} from "./rules/keywords.js";
export type { KeywordRule, KeywordPenalty } from "./rules/keywords.js";

// Universal prompt exports
export {
  buildUniversalPrompt,
  parseLLMResponse,
  getAvailableCategorySlugs,
  isValidCategorySlug,
} from "./prompt.js";
export type { PromptContext, LLMResponse } from "./prompt.js";

// Universal taxonomy exports
export {
  getCategoryBySlug,
  getCategoryById,
  getCategoriesForIndustry,
  getPromptCategoriesForIndustry,
  mapCategorySlugToId,
  validateAttributes,
  UNIVERSAL_TAXONOMY,
  UNIVERSAL_CATEGORY_IDS,
} from "./taxonomy.js";
export type { 
  Industry,
  UniversalCategory,
  AttributeSchema,
} from "./taxonomy.js";

export { getIndustryForOrg, getCategorizationConfig, DEFAULT_ECOMMERCE_CONFIG, DEFAULT_CONFIG } from "./config.js";
export type { CategorizationConfig } from "./config.js";

export {
  checkRevenueGuardrails,
  checkSalesTaxGuardrails,
  checkPayoutGuardrails,
  checkShippingDirectionGuardrails,
  applyEcommerceGuardrails,
  getCategoryIdWithGuardrails,
} from "./guardrails.js";
export type { GuardrailResult } from "./guardrails.js";

// Feature flags exports
export {
  CategorizerFeatureFlag,
  DEFAULT_FEATURE_FLAGS,
  getFeatureFlag,
  isFeatureEnabled,
  getRolloutPercentage,
  shouldUseHybridEngine,
} from "./feature-flags.js";
export type { FeatureFlagConfig } from "./feature-flags.js";

// Embeddings exports
export {
  generateVendorEmbedding,
  findNearestVendorEmbeddings,
  trackEmbeddingMatch,
  createStabilitySnapshot,
  getVendorStabilityMetrics,
  upsertVendorEmbedding,
  batchGenerateEmbeddings,
  cosineSimilarity,
} from "./engine/embeddings.js";
export type {
  VendorEmbedding,
  EmbeddingMatch,
  EmbeddingSearchOptions,
  EmbeddingStabilityMetrics,
} from "./engine/embeddings.js";

// Learning loop exports
export {
  createRuleVersion,
  runCanaryTest,
  promoteRuleVersion,
  rollbackRuleVersion,
  getUnresolvedOscillations,
  resolveOscillation,
  getRuleEffectiveness,
  getActiveRuleVersions,
  detectRuleOscillations,
} from "./engine/learning-loop.js";
export type {
  RuleType,
  RuleSource,
  RuleVersion,
  RuleEffectiveness,
  CategoryOscillation,
  CanaryTestResult,
  CanaryTestConfig,
} from "./engine/learning-loop.js";

// Re-export types from shared package
export type {
  NormalizedTransaction,
  CategorizationResult,
  CategorizationContext,
  CategoryId,
} from "@nexus/types";

// Unified categorize function for benchmarking
export { categorize } from "./categorize.js";
export type { CategorizeInput, CategorizeResult } from "./categorize.js";
