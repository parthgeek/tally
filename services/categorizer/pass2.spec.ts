import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { NormalizedTransaction, CategorizationContext, CategoryId } from '../../packages/types/src/index.js';
import {
  enhancedLLMCategorize,
  DEFAULT_ENHANCED_LLM_CONFIG,
  AMBIGUITY_TEST_CASES,
  type EnhancedLLMConfig
} from './pass2.js';

// Mock the categorizer package
vi.mock('../../packages/categorizer/src/index.js', () => ({
  scoreWithLLM: vi.fn(),
  applyGuardrails: vi.fn(),
  DEFAULT_GUARDRAIL_CONFIG: {}
}));

describe('enhancedLLMCategorize', () => {
  let mockTransaction: NormalizedTransaction;
  let mockContext: CategorizationContext;
  let mockPass1Result: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTransaction = {
      id: 'tx-123' as any,
      orgId: 'org-456' as any,
      accountId: 'acc-789' as any,
      description: 'AMAZON.COM ORDER 123-456',
      merchantName: 'Amazon',
      amount: -29.99,
      currency: 'USD',
      date: '2024-01-15',
      mcc: '5942', // Book stores
      paymentChannel: 'card'
    };

    mockContext = {
      orgId: 'org-456' as any,
      userId: 'user-123' as any,
      logger: {
        info: vi.fn(),
        error: vi.fn()
      },
      analytics: {
        captureEvent: vi.fn(),
        captureException: vi.fn()
      }
    };

    mockPass1Result = {
      categoryId: 'cat-uncertain' as CategoryId,
      confidence: 0.6,
      rationale: ['Weak MCC match'],
      signals: [
        { type: 'mcc', strength: 0.7, category: 'cat-uncertain' as CategoryId, evidence: '5942', confidence: 0.7 },
        { type: 'vendor', strength: 0.5, category: 'cat-uncertain' as CategoryId, evidence: 'amazon', confidence: 0.5 }
      ]
    };
  });

  test('successfully categorizes with Pass-1 context', async () => {
    const { scoreWithLLM, applyGuardrails } = await import('../../packages/categorizer/src/index.js');

    vi.mocked(scoreWithLLM).mockResolvedValue({
      categoryId: 'cat-supplies' as CategoryId,
      confidence: 0.85,
      rationale: 'Amazon purchase appears to be business supplies based on context'
    });

    vi.mocked(applyGuardrails).mockReturnValue({
      allowed: true,
      violations: [],
      finalCategory: 'cat-supplies' as CategoryId,
      finalConfidence: 0.85,
      guardrailsApplied: []
    });

    const result = await enhancedLLMCategorize(
      mockTransaction,
      mockContext,
      mockPass1Result
    );

    expect(result).toEqual({
      categoryId: 'cat-supplies',
      confidence: 0.85,
      rationale: ['Amazon purchase appears to be business supplies based on context'],
      guardrailsApplied: false,
      guardrailViolations: [],
      pass1Context: {
        topSignals: ['mcc:5942 (confidence: 0.70)', 'vendor:amazon (confidence: 0.50)'],
        mccMapping: 'MCC 5942',
        vendorMatch: 'amazon',
        confidence: 0.6
      },
      retryCount: 0
    });

    // Verify Pass-1 context was included in LLM call
    expect(scoreWithLLM).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        pass1Signals: ['mcc:5942 (confidence: 0.70)', 'vendor:amazon (confidence: 0.50)'],
        timeoutMs: DEFAULT_ENHANCED_LLM_CONFIG.timeoutMs
      })
    );
  });

  test('applies post-LLM guardrails when violations detected', async () => {
    const { scoreWithLLM, applyGuardrails } = await import('../../packages/categorizer/src/index.js');

    vi.mocked(scoreWithLLM).mockResolvedValue({
      categoryId: 'cat-food' as CategoryId, // Wrong category for MCC 5942
      confidence: 0.9,
      rationale: 'LLM incorrectly categorized as food'
    });

    vi.mocked(applyGuardrails).mockReturnValue({
      allowed: false,
      violations: [
        { type: 'mcc_incompatible', reason: 'MCC 5942 (book stores) incompatible with food category' }
      ],
      finalCategory: 'cat-supplies' as CategoryId, // Guardrail correction
      finalConfidence: 0.7,
      guardrailsApplied: ['MCC compatibility', 'category validation']
    });

    const result = await enhancedLLMCategorize(
      mockTransaction,
      mockContext,
      mockPass1Result
    );

    expect(result).toEqual({
      categoryId: 'cat-supplies', // Corrected by guardrails
      confidence: 0.7, // Reduced by guardrails
      rationale: [
        'LLM incorrectly categorized as food',
        'Guardrails applied: mcc_incompatible: MCC 5942 (book stores) incompatible with food category'
      ],
      guardrailsApplied: true,
      guardrailViolations: ['mcc_incompatible: MCC 5942 (book stores) incompatible with food category'],
      pass1Context: expect.any(Object),
      retryCount: 0
    });

    expect(mockContext.analytics?.captureEvent).toHaveBeenCalledWith(
      'llm_guardrail_intervention',
      {
        org_id: 'org-456',
        transaction_id: 'tx-123',
        original_category: 'cat-food',
        final_category: 'cat-supplies',
        violations: ['mcc_incompatible: MCC 5942 (book stores) incompatible with food category'],
        original_confidence: 0.9,
        final_confidence: 0.7
      }
    );
  });

  test('handles LLM failures with retries', async () => {
    const { scoreWithLLM } = await import('../../packages/categorizer/src/index.js');

    vi.mocked(scoreWithLLM)
      .mockRejectedValueOnce(new Error('API rate limit'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({
        categoryId: 'cat-supplies' as CategoryId,
        confidence: 0.8,
        rationale: 'Success after retries'
      });

    const result = await enhancedLLMCategorize(
      mockTransaction,
      mockContext,
      mockPass1Result,
      { maxRetries: 2 }
    );

    expect(result.categoryId).toBe('cat-supplies');
    expect(result.retryCount).toBe(2);
    expect(scoreWithLLM).toHaveBeenCalledTimes(3);

    expect(mockContext.logger?.error).toHaveBeenCalledTimes(2); // Two failed attempts
    expect(mockContext.logger?.info).toHaveBeenCalledWith(
      'LLM categorization completed',
      expect.objectContaining({
        attempt: 3
      })
    );
  });

  test('returns failure after all retries exhausted', async () => {
    const { scoreWithLLM } = await import('../../packages/categorizer/src/index.js');

    vi.mocked(scoreWithLLM).mockRejectedValue(new Error('Persistent failure'));

    const result = await enhancedLLMCategorize(
      mockTransaction,
      mockContext,
      mockPass1Result,
      { maxRetries: 1 }
    );

    expect(result).toEqual({
      categoryId: undefined,
      confidence: 0,
      rationale: ['LLM categorization failed: Persistent failure'],
      guardrailsApplied: false,
      guardrailViolations: [],
      pass1Context: expect.any(Object),
      retryCount: 2 // maxRetries + 1
    });

    expect(mockContext.analytics?.captureException).toHaveBeenCalled();
  });

  test('works without Pass-1 context when disabled', async () => {
    const { scoreWithLLM } = await import('../../packages/categorizer/src/index.js');

    vi.mocked(scoreWithLLM).mockResolvedValue({
      categoryId: 'cat-other' as CategoryId,
      confidence: 0.7,
      rationale: 'Categorized without Pass-1 context'
    });

    const result = await enhancedLLMCategorize(
      mockTransaction,
      mockContext,
      mockPass1Result,
      { includePass1Context: false }
    );

    expect(result.pass1Context).toBeUndefined();
    expect(scoreWithLLM).toHaveBeenCalledWith(
      mockTransaction,
      expect.not.objectContaining({
        pass1Signals: expect.anything()
      })
    );
  });

  test('skips guardrails when disabled', async () => {
    const { scoreWithLLM, applyGuardrails } = await import('../../packages/categorizer/src/index.js');

    vi.mocked(scoreWithLLM).mockResolvedValue({
      categoryId: 'cat-food' as CategoryId,
      confidence: 0.9,
      rationale: 'LLM result without guardrail validation'
    });

    const result = await enhancedLLMCategorize(
      mockTransaction,
      mockContext,
      mockPass1Result,
      { enablePostLLMGuardrails: false }
    );

    expect(result.categoryId).toBe('cat-food'); // No guardrail correction
    expect(result.guardrailsApplied).toBe(false);
    expect(applyGuardrails).not.toHaveBeenCalled();
  });

  test('handles guardrail failures gracefully', async () => {
    const { scoreWithLLM, applyGuardrails } = await import('../../packages/categorizer/src/index.js');

    vi.mocked(scoreWithLLM).mockResolvedValue({
      categoryId: 'cat-supplies' as CategoryId,
      confidence: 0.85,
      rationale: 'Good LLM result'
    });

    vi.mocked(applyGuardrails).mockImplementation(() => {
      throw new Error('Guardrail system failure');
    });

    const result = await enhancedLLMCategorize(
      mockTransaction,
      mockContext,
      mockPass1Result
    );

    // Should fall back to original LLM result
    expect(result.categoryId).toBe('cat-supplies');
    expect(result.confidence).toBe(0.85);
    expect(result.guardrailsApplied).toBe(false);

    expect(mockContext.logger?.error).toHaveBeenCalledWith(
      'Post-LLM guardrails failed',
      expect.objectContaining({
        error: 'Guardrail system failure'
      })
    );
  });
});

describe('AMBIGUITY_TEST_CASES', () => {
  test('contains expected ambiguous scenarios', () => {
    expect(AMBIGUITY_TEST_CASES).toHaveLength(3);

    const scenarios = AMBIGUITY_TEST_CASES.map(tc => tc.name);
    expect(scenarios).toContain('Amazon - Retail vs Subscription');
    expect(scenarios).toContain('7-Eleven - Fuel vs Convenience');
    expect(scenarios).toContain('Generic BILL Descriptors');
  });

  test('Amazon test case has retail and subscription variants', () => {
    const amazonCase = AMBIGUITY_TEST_CASES.find(tc => tc.name === 'Amazon - Retail vs Subscription');
    expect(amazonCase?.transactions).toHaveLength(2);

    const [retail, subscription] = amazonCase!.transactions;
    expect(retail.description).toContain('ORDER');
    expect(subscription.description).toContain('PRIME MEMBERSHIP');

    // Retail should be ambiguous between supplies/office supplies
    expect(retail.expectedAmbiguity).toContain('supplies');
    expect(retail.expectedAmbiguity).toContain('office_supplies');

    // Subscription should be ambiguous between software/services
    expect(subscription.expectedAmbiguity).toContain('software');
    expect(subscription.expectedAmbiguity).toContain('professional_services');
  });

  test('7-Eleven test case distinguishes fuel vs convenience store', () => {
    const sevenElevenCase = AMBIGUITY_TEST_CASES.find(tc => tc.name === '7-Eleven - Fuel vs Convenience');
    expect(sevenElevenCase?.transactions).toHaveLength(2);

    const [fuel, convenience] = sevenElevenCase!.transactions;
    expect(fuel.description).toContain('FUEL');
    expect(fuel.mcc).toBe('5541'); // Service stations
    expect(fuel.expectedAmbiguity).toContain('travel');

    expect(convenience.mcc).toBe('5499'); // Miscellaneous food stores
    expect(convenience.expectedAmbiguity).toContain('supplies');
  });

  test('Generic BILL test case covers utility and unknown bills', () => {
    const billCase = AMBIGUITY_TEST_CASES.find(tc => tc.name === 'Generic BILL Descriptors');
    expect(billCase?.transactions).toHaveLength(2);

    const [utility, generic] = billCase!.transactions;
    expect(utility.description).toContain('UTILITIES');
    expect(utility.mcc).toBe('4900'); // Utilities MCC
    expect(utility.expectedAmbiguity).toContain('rent_utilities');

    expect(generic.mcc).toBeUndefined(); // No MCC context
    expect(generic.expectedAmbiguity.length).toBeGreaterThan(2); // Multiple possibilities
  });
});