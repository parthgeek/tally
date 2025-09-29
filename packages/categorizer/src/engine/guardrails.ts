import type { CategoryId, NormalizedTransaction } from '@nexus/types';
import { isMCCCompatibleWithCategory, getMCCMapping } from '../rules/mcc.js';
import type { CategoryScore } from './scorer.js';

/**
 * Guardrail violation types
 */
export type GuardrailViolationType = 
  | 'mcc_incompatible'
  | 'amount_unrealistic' 
  | 'confidence_too_low'
  | 'category_blacklisted'
  | 'suspicious_pattern';

/**
 * Guardrail violation details
 */
export interface GuardrailViolation {
  type: GuardrailViolationType;
  reason: string;
  originalCategory: CategoryId;
  suggestedAction: 'reject' | 'flag' | 'override';
  metadata?: Record<string, any>;
}

/**
 * Guardrail enforcement result
 */
export interface GuardrailResult {
  allowed: boolean;
  violations: GuardrailViolation[];
  finalCategory?: CategoryId | undefined;
  finalConfidence?: number | undefined;
  guardrailsApplied: string[];
}

/**
 * Configuration for guardrail enforcement
 */
export interface GuardrailConfig {
  enforceMCCCompatibility: boolean;
  minConfidenceThreshold: number;
  enableAmountChecks: boolean;
  enablePatternChecks: boolean;
  strictMode: boolean; // If true, any violation rejects the categorization
}

/**
 * Default guardrail configuration
 * Raised minConfidenceThreshold from 0.25 to 0.60 to prevent low-quality categorizations
 * Transactions below 0.60 confidence should be manually reviewed rather than auto-applied
 */
export const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  enforceMCCCompatibility: true,
  minConfidenceThreshold: 0.60,
  enableAmountChecks: true,
  enablePatternChecks: true,
  strictMode: false
};

/**
 * Categories that should never be assigned to certain transaction types
 */
const CATEGORY_BLACKLIST: Array<{
  categoryId: CategoryId;
  conditions: {
    amountCentsMin?: number;
    amountCentsMax?: number;
    descriptionPatterns?: RegExp[];
    merchantPatterns?: RegExp[];
  };
  reason: string;
}> = [
  {
    categoryId: '550e8400-e29b-41d4-a716-446655440002' as CategoryId, // Hair Services
    conditions: {
      amountCentsMin: 100000, // $1000+
    },
    reason: 'Hair services transactions above $1000 are likely misclassified'
  },
  {
    categoryId: '550e8400-e29b-41d4-a716-446655440007' as CategoryId, // Business Meals
    conditions: {
      amountCentsMin: 50000, // $500+
    },
    reason: 'Business meals above $500 should be reviewed'
  },
  {
    categoryId: '550e8400-e29b-41d4-a716-446655440019' as CategoryId, // Banking & Fees
    conditions: {
      amountCentsMin: 10000, // $100+
    },
    reason: 'Banking fees above $100 are unusual and should be reviewed'
  }
];

/**
 * Patterns that indicate suspicious or misclassified transactions
 */
const SUSPICIOUS_PATTERNS = [
  {
    pattern: /refund|return|credit|reversal/i,
    reason: 'Refund/return transactions may need special handling',
    action: 'flag' as const
  },
  {
    pattern: /transfer|deposit|withdrawal/i,
    reason: 'Bank transfer transactions should not be categorized as business expenses',
    action: 'reject' as const
  },
  {
    pattern: /test|demo|sample/i,
    reason: 'Test transactions should not be categorized',
    action: 'flag' as const
  }
];

/**
 * Checks MCC compatibility with proposed category
 */
function checkMCCCompatibility(
  transaction: NormalizedTransaction, 
  categoryId: CategoryId,
  config: GuardrailConfig
): GuardrailViolation | undefined {
  if (!config.enforceMCCCompatibility || !transaction.mcc) {
    return undefined;
  }

  if (!isMCCCompatibleWithCategory(transaction.mcc, categoryId)) {
    const mccMapping = getMCCMapping(transaction.mcc);
    return {
      type: 'mcc_incompatible',
      reason: `MCC ${transaction.mcc} (${mccMapping?.categoryName || 'unknown'}) is incompatible with ${categoryId}`,
      originalCategory: categoryId,
      suggestedAction: 'reject',
      metadata: { mcc: transaction.mcc, mccCategory: mccMapping?.categoryId }
    };
  }

  return undefined;
}

/**
 * Checks if transaction amount is realistic for the category
 */
function checkAmountRealistic(
  transaction: NormalizedTransaction,
  categoryId: CategoryId,
  config: GuardrailConfig
): GuardrailViolation | undefined {
  if (!config.enableAmountChecks) {
    return undefined;
  }

  const amountCents = parseInt(transaction.amountCents);
  if (isNaN(amountCents)) {
    return undefined;
  }

  // Check against category blacklist
  for (const blacklistEntry of CATEGORY_BLACKLIST) {
    if (blacklistEntry.categoryId === categoryId) {
      const conditions = blacklistEntry.conditions;
      
      if (conditions.amountCentsMin && Math.abs(amountCents) >= conditions.amountCentsMin) {
        return {
          type: 'amount_unrealistic',
          reason: blacklistEntry.reason,
          originalCategory: categoryId,
          suggestedAction: 'flag',
          metadata: { amountCents, threshold: conditions.amountCentsMin }
        };
      }
      
      if (conditions.amountCentsMax && Math.abs(amountCents) <= conditions.amountCentsMax) {
        return {
          type: 'amount_unrealistic', 
          reason: blacklistEntry.reason,
          originalCategory: categoryId,
          suggestedAction: 'flag',
          metadata: { amountCents, threshold: conditions.amountCentsMax }
        };
      }
    }
  }

  return undefined;
}

/**
 * Checks for suspicious patterns in transaction data
 */
function checkSuspiciousPatterns(
  transaction: NormalizedTransaction,
  categoryId: CategoryId,
  config: GuardrailConfig
): GuardrailViolation | undefined {
  if (!config.enablePatternChecks) {
    return undefined;
  }

  const description = transaction.description.toLowerCase();
  const merchantName = transaction.merchantName?.toLowerCase() || '';

  for (const suspiciousPattern of SUSPICIOUS_PATTERNS) {
    if (suspiciousPattern.pattern.test(description) || suspiciousPattern.pattern.test(merchantName)) {
      return {
        type: 'suspicious_pattern',
        reason: suspiciousPattern.reason,
        originalCategory: categoryId,
        suggestedAction: suspiciousPattern.action,
        metadata: { pattern: suspiciousPattern.pattern.source }
      };
    }
  }

  return undefined;
}

/**
 * Checks minimum confidence threshold
 */
function checkMinConfidence(
  confidence: number,
  categoryId: CategoryId,
  config: GuardrailConfig
): GuardrailViolation | undefined {
  if (confidence < config.minConfidenceThreshold) {
    return {
      type: 'confidence_too_low',
      reason: `Confidence ${confidence.toFixed(3)} below threshold ${config.minConfidenceThreshold}`,
      originalCategory: categoryId,
      suggestedAction: 'reject',
      metadata: { confidence, threshold: config.minConfidenceThreshold }
    };
  }

  return undefined;
}

/**
 * Applies guardrails to a categorization result
 */
export function applyGuardrails(
  transaction: NormalizedTransaction,
  categoryScore: CategoryScore,
  config: GuardrailConfig = DEFAULT_GUARDRAIL_CONFIG
): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  const guardrailsApplied: string[] = [];

  // Run all guardrail checks
  const checks = [
    { name: 'MCC compatibility', check: checkMCCCompatibility },
    { name: 'amount realism', check: checkAmountRealistic },
    { name: 'suspicious patterns', check: checkSuspiciousPatterns },
    { name: 'minimum confidence', check: checkMinConfidence }
  ];

  for (const { name, check } of checks) {
    let violation: GuardrailViolation | undefined;

    // Always track that this guardrail was applied/checked
    guardrailsApplied.push(name);

    if (check === checkMinConfidence) {
      violation = checkMinConfidence(categoryScore.confidence, categoryScore.categoryId, config);
    } else {
      violation = (check as any)(transaction, categoryScore.categoryId, config);
    }

    if (violation) {
      violations.push(violation);
    }
  }

  // Determine final result based on violations
  let allowed = true;
  let finalCategory: CategoryId | undefined = categoryScore.categoryId;
  let finalConfidence: number | undefined = categoryScore.confidence;

  if (violations.length > 0) {
    const hasRejectViolation = violations.some(v => v.suggestedAction === 'reject');
    
    if (config.strictMode || hasRejectViolation) {
      allowed = false;
      finalCategory = undefined;
      finalConfidence = undefined;
    } else {
      // Flag violations - allow but mark for review
      allowed = true;
      // Reduce confidence for flagged items
      const flagViolations = violations.filter(v => v.suggestedAction === 'flag');
      if (flagViolations.length > 0) {
        finalConfidence = Math.max(0.1, categoryScore.confidence * 0.8);
        guardrailsApplied.push('confidence penalty');
      }
    }
  }

  const result: GuardrailResult = {
    allowed,
    violations,
    finalCategory,
    finalConfidence,
    guardrailsApplied
  };
  return result;
}

/**
 * Creates a fallback "uncertain" categorization when guardrails reject all options
 */
export function createUncertainResult(
  transaction: NormalizedTransaction,
  violations: GuardrailViolation[]
): CategoryScore {
  // Use a generic "uncategorized" category ID
  const uncertainCategoryId = '550e8400-e29b-41d4-a716-446655440999' as CategoryId;
  
  return {
    categoryId: uncertainCategoryId,
    categoryName: 'Uncategorized',
    totalScore: 0.1,
    confidence: 0.05, // Very low confidence
    signals: [],
    dominantSignal: {
      type: 'pattern',
      categoryId: uncertainCategoryId,
      categoryName: 'Uncategorized',
      strength: 'weak',
      confidence: 0.05,
      weight: 0.1,
      metadata: {
        source: 'guardrails',
        details: `Guardrail violations: ${violations.map(v => v.type).join(', ')}`
      }
    }
  };
}

/**
 * Validates guardrail configuration
 */
export function validateGuardrailConfig(config: GuardrailConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.minConfidenceThreshold < 0 || config.minConfidenceThreshold > 1) {
    errors.push('minConfidenceThreshold must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Gets all configured guardrail types
 */
export function getGuardrailTypes(): GuardrailViolationType[] {
  return ['mcc_incompatible', 'amount_unrealistic', 'confidence_too_low', 'category_blacklisted', 'suspicious_pattern'];
}

/**
 * Gets statistics about guardrail violations for monitoring
 */
export function getGuardrailStats(results: GuardrailResult[]): {
  totalChecked: number;
  totalViolations: number;
  violationsByType: Record<GuardrailViolationType, number>;
  rejectionRate: number;
  flagRate: number;
} {
  const stats = {
    totalChecked: results.length,
    totalViolations: 0,
    violationsByType: {} as Record<GuardrailViolationType, number>,
    rejectionRate: 0,
    flagRate: 0
  };

  // Initialize violation counts
  for (const type of getGuardrailTypes()) {
    stats.violationsByType[type] = 0;
  }

  let rejectedCount = 0;
  let flaggedCount = 0;

  for (const result of results) {
    stats.totalViolations += result.violations.length;
    
    if (!result.allowed) {
      rejectedCount++;
    } else if (result.violations.some(v => v.suggestedAction === 'flag')) {
      flaggedCount++;
    }

    for (const violation of result.violations) {
      stats.violationsByType[violation.type]++;
    }
  }

  stats.rejectionRate = results.length > 0 ? rejectedCount / results.length : 0;
  stats.flagRate = results.length > 0 ? flaggedCount / results.length : 0;

  return stats;
}