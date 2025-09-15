import { describe, expect, test } from 'vitest';
import type { CategoryId, NormalizedTransaction } from '@nexus/types';
import {
  applyGuardrails,
  createUncertainResult,
  validateGuardrailConfig,
  getGuardrailTypes,
  getGuardrailStats,
  DEFAULT_GUARDRAIL_CONFIG,
  type GuardrailConfig
} from '../../engine/guardrails.js';
import type { CategoryScore } from '../../engine/scorer.js';

const HAIR_SERVICES_ID = '550e8400-e29b-41d4-a716-446655440002' as CategoryId;
const UTILITIES_ID = '550e8400-e29b-41d4-a716-446655440011' as CategoryId;
const BANKING_ID = '550e8400-e29b-41d4-a716-446655440019' as CategoryId;
const MEALS_ID = '550e8400-e29b-41d4-a716-446655440007' as CategoryId;

function createMockTransaction(overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    id: 'tx-123' as any,
    orgId: 'org-123' as any,
    date: '2024-01-15',
    amountCents: '5000', // $50
    currency: 'USD',
    description: 'Hair salon service',
    merchantName: 'Salon ABC',
    mcc: undefined,
    categoryId: undefined,
    confidence: undefined,
    reviewed: false,
    needsReview: false,
    source: 'manual',
    raw: {},
    ...overrides
  };
}

function createMockCategoryScore(overrides: Partial<CategoryScore> = {}): CategoryScore {
  return {
    categoryId: HAIR_SERVICES_ID,
    categoryName: 'Hair Services',
    totalScore: 0.8,
    confidence: 0.85,
    signals: [],
    dominantSignal: {
      type: 'mcc',
      categoryId: HAIR_SERVICES_ID,
      categoryName: 'Hair Services',
      strength: 'exact',
      confidence: 0.85,
      weight: 4.0,
      metadata: { source: 'MCC:7230', details: 'Hair salon services' }
    },
    ...overrides
  };
}

describe('applyGuardrails', () => {
  test('allows compatible MCC and category', () => {
    const transaction = createMockTransaction({ mcc: '7230' }); // Hair services MCC
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.finalCategory).toBe(HAIR_SERVICES_ID);
    expect(result.finalConfidence).toBe(0.85);
  });

  test('rejects incompatible MCC and category', () => {
    const transaction = createMockTransaction({ mcc: '4900' }); // Utilities MCC
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID }); // Hair services category
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]!.type).toBe('mcc_incompatible');
    expect(result.finalCategory).toBeUndefined();
  });

  test('allows unknown MCC with any category', () => {
    const transaction = createMockTransaction({ mcc: '9999' }); // Unknown MCC
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test('flags unrealistic amounts', () => {
    const transaction = createMockTransaction({ amountCents: '150000' }); // $1500 hair service
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.allowed).toBe(true); // Flagged but allowed
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]!.type).toBe('amount_unrealistic');
    expect(result.violations[0]!.suggestedAction).toBe('flag');
    expect(result.finalConfidence).toBeLessThan(0.85); // Confidence penalty applied
  });

  test('rejects low confidence', () => {
    const transaction = createMockTransaction();
    const categoryScore = createMockCategoryScore({ confidence: 0.15 }); // Below default threshold of 0.25
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]!.type).toBe('confidence_too_low');
  });

  test('flags suspicious patterns', () => {
    const transaction = createMockTransaction({ description: 'Refund for hair service' });
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.allowed).toBe(true); // Flagged but allowed
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]!.type).toBe('suspicious_pattern');
    expect(result.violations[0]!.suggestedAction).toBe('flag');
  });

  test('rejects transfer transactions', () => {
    const transaction = createMockTransaction({ description: 'Bank transfer payment' });
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]!.type).toBe('suspicious_pattern');
    expect(result.violations[0]!.suggestedAction).toBe('reject');
  });

  test('respects configuration flags', () => {
    const config: GuardrailConfig = {
      ...DEFAULT_GUARDRAIL_CONFIG,
      enforceMCCCompatibility: false,
      enableAmountChecks: false,
      enablePatternChecks: false
    };
    
    const transaction = createMockTransaction({ 
      mcc: '4900', // Incompatible MCC
      amountCents: '150000', // High amount
      description: 'Transfer payment' // Suspicious pattern
    });
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, config);
    
    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test('strict mode rejects any violation', () => {
    const config: GuardrailConfig = {
      ...DEFAULT_GUARDRAIL_CONFIG,
      strictMode: true
    };
    
    const transaction = createMockTransaction({ amountCents: '150000' }); // Would normally just be flagged
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, config);
    
    expect(result.allowed).toBe(false);
    expect(result.finalCategory).toBeUndefined();
  });

  test('includes guardrails applied in result', () => {
    const transaction = createMockTransaction({ mcc: '7230' });
    const categoryScore = createMockCategoryScore({ categoryId: HAIR_SERVICES_ID });
    
    const result = applyGuardrails(transaction, categoryScore, DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.guardrailsApplied).toContain('MCC compatibility');
    expect(result.guardrailsApplied).toContain('amount realism');
    expect(result.guardrailsApplied).toContain('suspicious patterns');
    expect(result.guardrailsApplied).toContain('minimum confidence');
  });
});

describe('createUncertainResult', () => {
  test('creates uncertain category with low confidence', () => {
    const transaction = createMockTransaction();
    const violations = [
      {
        type: 'mcc_incompatible' as const,
        reason: 'MCC incompatible',
        originalCategory: HAIR_SERVICES_ID,
        suggestedAction: 'reject' as const
      }
    ];
    
    const result = createUncertainResult(transaction, violations);
    
    expect(result.categoryId).toBe('550e8400-e29b-41d4-a716-446655440999');
    expect(result.categoryName).toBe('Uncategorized');
    expect(result.confidence).toBe(0.05);
    expect(result.totalScore).toBe(0.1);
    expect(result.dominantSignal.metadata.details).toContain('mcc_incompatible');
  });

  test('includes all violation types in rationale', () => {
    const transaction = createMockTransaction();
    const violations = [
      {
        type: 'mcc_incompatible' as const,
        reason: 'MCC incompatible',
        originalCategory: HAIR_SERVICES_ID,
        suggestedAction: 'reject' as const
      },
      {
        type: 'amount_unrealistic' as const,
        reason: 'Amount too high',
        originalCategory: HAIR_SERVICES_ID,
        suggestedAction: 'flag' as const
      }
    ];
    
    const result = createUncertainResult(transaction, violations);
    
    expect(result.dominantSignal.metadata.details).toContain('mcc_incompatible');
    expect(result.dominantSignal.metadata.details).toContain('amount_unrealistic');
  });
});

describe('validateGuardrailConfig', () => {
  test('validates correct configuration', () => {
    const result = validateGuardrailConfig(DEFAULT_GUARDRAIL_CONFIG);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects invalid confidence threshold', () => {
    const config = {
      ...DEFAULT_GUARDRAIL_CONFIG,
      minConfidenceThreshold: 1.5 // Invalid
    };
    
    const result = validateGuardrailConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('minConfidenceThreshold');
  });

  test('rejects negative confidence threshold', () => {
    const config = {
      ...DEFAULT_GUARDRAIL_CONFIG,
      minConfidenceThreshold: -0.1 // Invalid
    };
    
    const result = validateGuardrailConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('getGuardrailTypes', () => {
  test('returns all guardrail violation types', () => {
    const types = getGuardrailTypes();
    
    expect(types).toContain('mcc_incompatible');
    expect(types).toContain('amount_unrealistic');
    expect(types).toContain('confidence_too_low');
    expect(types).toContain('category_blacklisted');
    expect(types).toContain('suspicious_pattern');
    expect(types.length).toBe(5);
  });
});

describe('getGuardrailStats', () => {
  test('calculates stats for empty results', () => {
    const stats = getGuardrailStats([]);
    
    expect(stats.totalChecked).toBe(0);
    expect(stats.totalViolations).toBe(0);
    expect(stats.rejectionRate).toBe(0);
    expect(stats.flagRate).toBe(0);
  });

  test('calculates stats for mixed results', () => {
    const results = [
      {
        allowed: true,
        violations: [],
        guardrailsApplied: []
      },
      {
        allowed: false,
        violations: [
          {
            type: 'mcc_incompatible' as const,
            reason: 'test',
            originalCategory: HAIR_SERVICES_ID,
            suggestedAction: 'reject' as const
          }
        ],
        guardrailsApplied: []
      },
      {
        allowed: true,
        violations: [
          {
            type: 'amount_unrealistic' as const,
            reason: 'test',
            originalCategory: HAIR_SERVICES_ID,
            suggestedAction: 'flag' as const
          }
        ],
        guardrailsApplied: []
      }
    ];
    
    const stats = getGuardrailStats(results);
    
    expect(stats.totalChecked).toBe(3);
    expect(stats.totalViolations).toBe(2);
    expect(stats.rejectionRate).toBeCloseTo(0.333, 2); // 1/3
    expect(stats.flagRate).toBeCloseTo(0.333, 2); // 1/3
    expect(stats.violationsByType.mcc_incompatible).toBe(1);
    expect(stats.violationsByType.amount_unrealistic).toBe(1);
  });

  test('handles multiple violations per result', () => {
    const results = [
      {
        allowed: false,
        violations: [
          {
            type: 'mcc_incompatible' as const,
            reason: 'test',
            originalCategory: HAIR_SERVICES_ID,
            suggestedAction: 'reject' as const
          },
          {
            type: 'confidence_too_low' as const,
            reason: 'test',
            originalCategory: HAIR_SERVICES_ID,
            suggestedAction: 'reject' as const
          }
        ],
        guardrailsApplied: []
      }
    ];
    
    const stats = getGuardrailStats(results);
    
    expect(stats.totalViolations).toBe(2);
    expect(stats.violationsByType.mcc_incompatible).toBe(1);
    expect(stats.violationsByType.confidence_too_low).toBe(1);
  });
});