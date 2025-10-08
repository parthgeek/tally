// Public API exports for the categorizer package

// Legacy exports (deprecated - use engine/pass1 instead)
export { pass1Categorize, normalizeVendor } from "./pass1.js";
export { scoreWithLLM } from "./pass2_llm.js";
export { GeminiClient } from "./gemini-client.js";

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
  normalizeVendorName,
  getPatternsForCategory,
  getConflictingPatterns,
} from "./rules/vendors.js";
export type { VendorPattern, VendorMatchStrength } from "./rules/vendors.js";

export {
  matchKeywordRules,
  calculateKeywordConfidence,
  getBestKeywordMatch,
  getKeywordRulesForDomain,
  getAvailableDomains,
} from "./rules/keywords.js";
export type { KeywordRule, KeywordPenalty } from "./rules/keywords.js";

// E-commerce categorization exports
export {
  buildCategorizationPrompt,
  getAvailableCategorySlugs,
  isValidCategorySlug,
} from "./prompt.js";

export {
  getActiveTaxonomy,
  getCategoryBySlug,
  getCategoryById,
  isPnLCategory,
  getPromptCategories,
  getCategoriesByType,
  getChildCategories,
  mapCategorySlugToId,
  createSlugToIdMapping,
  ECOMMERCE_TAXONOMY,
} from "./taxonomy.js";

export { getIndustryForOrg, getCategorizationConfig } from "./config.js";
export type { Industry, CategorizationConfig } from "./config.js";

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
