import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { NormalizedTransaction, CategorizationContext, CategoryId } from '@nexus/types';
import { categorizeTransaction, batchCategorizeTransactions, DEFAULT_HYBRID_CONFIG } from './categorize.js';

// Mock the categorizer package
vi.mock('@nexus/categorizer', () => ({
  enhancedPass1Categorize: vi.fn(),
  createDefaultPass1Context: vi.fn(() => ({})),
  scoreWithLLM: vi.fn()
}));

describe('categorizeTransaction', () => {
  let mockTransaction: NormalizedTransaction;
  let mockContext: CategorizationContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTransaction = {
      id: 'tx-123' as any,
      orgId: 'org-456' as any,
      accountId: 'acc-789' as any,
      description: 'STARBUCKS STORE',
      merchantName: 'Starbucks',
      amount: -4.25,
      currency: 'USD',
      date: '2024-01-15',
      mcc: '5814',
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
  });

  test('accepts Pass-1 result when confidence >= threshold', async () => {
    const { enhancedPass1Categorize } = await import('@nexus/categorizer');

    vi.mocked(enhancedPass1Categorize).mockResolvedValue({
      categoryId: 'cat-food' as CategoryId,
      confidence: 0.85,
      rationale: ['MCC mapping: 5814 → Food & Beverage', 'Vendor match: STARBUCKS'],
      signals: [
        { type: 'mcc', strength: 0.9, category: 'cat-food' as CategoryId, evidence: '5814' },
        { type: 'vendor', strength: 0.8, category: 'cat-food' as CategoryId, evidence: 'STARBUCKS' }
      ]
    });

    const result = await categorizeTransaction(mockTransaction, mockContext);

    expect(result).toEqual({
      categoryId: 'cat-food',
      confidence: 0.85,
      rationale: ['MCC mapping: 5814 → Food & Beverage', 'Vendor match: STARBUCKS'],
      engine: 'pass1',
      pass1Result: expect.any(Object),
      llmAttempted: false,
      timings: {
        pass1Ms: expect.any(Number),
        totalMs: expect.any(Number)
      }
    });

    expect(mockContext.logger?.info).toHaveBeenCalledWith(
      'Pass-1 categorization completed',
      expect.objectContaining({
        txId: 'tx-123',
        confidence: 0.85,
        categoryId: 'cat-food',
        shouldAccept: true
      })
    );
  });

  test('falls back to LLM when Pass-1 confidence is low', async () => {
    const { enhancedPass1Categorize, scoreWithLLM } = await import('@nexus/categorizer');

    // Mock low-confidence Pass-1 result
    vi.mocked(enhancedPass1Categorize).mockResolvedValue({
      categoryId: 'cat-uncertain' as CategoryId,
      confidence: 0.6,
      rationale: ['Weak keyword match']
    });

    // Mock higher-confidence LLM result
    vi.mocked(scoreWithLLM).mockResolvedValue({
      categoryId: 'cat-food' as CategoryId,
      confidence: 0.9,
      rationale: 'Transaction at Starbucks is clearly a food and beverage expense'
    });

    const result = await categorizeTransaction(mockTransaction, mockContext);

    expect(result).toEqual({
      categoryId: 'cat-food',
      confidence: 0.9,
      rationale: ['Transaction at Starbucks is clearly a food and beverage expense'],
      engine: 'llm',
      pass1Result: expect.any(Object),
      llmAttempted: true,
      timings: {
        pass1Ms: expect.any(Number),
        pass2Ms: expect.any(Number),
        totalMs: expect.any(Number)
      }
    });

    expect(scoreWithLLM).toHaveBeenCalledWith(
      mockTransaction,
      expect.objectContaining({
        timeoutMs: DEFAULT_HYBRID_CONFIG.llmTimeoutMs
      })
    );
  });

  test('uses Pass-1 result when LLM has lower confidence', async () => {
    const { enhancedPass1Categorize, scoreWithLLM } = await import('@nexus/categorizer');

    // Mock Pass-1 result below threshold but decent
    vi.mocked(enhancedPass1Categorize).mockResolvedValue({
      categoryId: 'cat-food' as CategoryId,
      confidence: 0.7,
      rationale: ['MCC mapping with medium confidence']
    });

    // Mock LLM result with even lower confidence
    vi.mocked(scoreWithLLM).mockResolvedValue({
      categoryId: 'cat-other' as CategoryId,
      confidence: 0.5,
      rationale: 'Uncertain categorization'
    });

    const result = await categorizeTransaction(mockTransaction, mockContext);

    expect(result).toEqual({
      categoryId: 'cat-food',
      confidence: 0.7,
      rationale: ['MCC mapping with medium confidence'],
      engine: 'pass1',
      pass1Result: expect.any(Object),
      llmAttempted: true,
      timings: {
        pass1Ms: expect.any(Number),
        pass2Ms: expect.any(Number),
        totalMs: expect.any(Number)
      }
    });

    expect(mockContext.logger?.info).toHaveBeenCalledWith(
      'Using Pass-1 result after LLM attempt',
      expect.objectContaining({
        txId: 'tx-123',
        pass1Confidence: 0.7,
        pass2Confidence: 0.5,
        reason: 'llm_lower_confidence'
      })
    );
  });

  test('disables LLM fallback when configured', async () => {
    const { enhancedPass1Categorize } = await import('@nexus/categorizer');

    vi.mocked(enhancedPass1Categorize).mockResolvedValue({
      categoryId: 'cat-uncertain' as CategoryId,
      confidence: 0.6,
      rationale: ['Low confidence match']
    });

    const result = await categorizeTransaction(mockTransaction, mockContext, {
      enableLLMFallback: false
    });

    expect(result).toEqual({
      categoryId: 'cat-uncertain',
      confidence: 0.6,
      rationale: ['Low confidence match'],
      engine: 'pass1',
      pass1Result: expect.any(Object),
      llmAttempted: false,
      timings: {
        pass1Ms: expect.any(Number),
        totalMs: expect.any(Number)
      }
    });

    expect(mockContext.logger?.info).toHaveBeenCalledWith(
      'LLM fallback disabled, returning Pass-1 result',
      expect.objectContaining({
        txId: 'tx-123',
        confidence: 0.6
      })
    );
  });

  test('handles LLM timeout and retries', async () => {
    const { enhancedPass1Categorize, scoreWithLLM } = await import('@nexus/categorizer');

    vi.mocked(enhancedPass1Categorize).mockResolvedValue({
      categoryId: 'cat-fallback' as CategoryId,
      confidence: 0.6,
      rationale: ['Fallback after LLM failure']
    });

    // Mock LLM to fail twice then succeed
    vi.mocked(scoreWithLLM)
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('Rate limit'))
      .mockResolvedValueOnce({
        categoryId: 'cat-food' as CategoryId,
        confidence: 0.85,
        rationale: 'LLM success on retry'
      });

    const result = await categorizeTransaction(mockTransaction, mockContext, {
      llmMaxRetries: 2
    });

    expect(result).toEqual({
      categoryId: 'cat-food',
      confidence: 0.85,
      rationale: ['LLM success on retry'],
      engine: 'llm',
      pass1Result: expect.any(Object),
      llmAttempted: true,
      timings: {
        pass1Ms: expect.any(Number),
        pass2Ms: expect.any(Number),
        totalMs: expect.any(Number)
      }
    });

    expect(scoreWithLLM).toHaveBeenCalledTimes(3);
    expect(mockContext.logger?.error).toHaveBeenCalledTimes(2);
  });

  test('falls back to Pass-1 when LLM fails completely', async () => {
    const { enhancedPass1Categorize, scoreWithLLM } = await import('@nexus/categorizer');

    vi.mocked(enhancedPass1Categorize).mockResolvedValue({
      categoryId: 'cat-fallback' as CategoryId,
      confidence: 0.65,
      rationale: ['Fallback after LLM failure']
    });

    vi.mocked(scoreWithLLM).mockRejectedValue(new Error('LLM service unavailable'));

    const result = await categorizeTransaction(mockTransaction, mockContext, {
      llmMaxRetries: 0 // No retries for faster test
    });

    expect(result).toEqual({
      categoryId: 'cat-fallback',
      confidence: 0.65,
      rationale: ['Fallback after LLM failure'],
      engine: 'pass1',
      pass1Result: expect.any(Object),
      llmAttempted: true,
      timings: {
        pass1Ms: expect.any(Number),
        pass2Ms: expect.any(Number),
        totalMs: expect.any(Number)
      }
    });

    expect(mockContext.analytics?.captureException).toHaveBeenCalled();
  });

  test('handles complete categorization failure gracefully', async () => {
    const { enhancedPass1Categorize } = await import('@nexus/categorizer');

    vi.mocked(enhancedPass1Categorize).mockRejectedValue(new Error('Pass-1 engine failure'));

    const result = await categorizeTransaction(mockTransaction, mockContext);

    expect(result).toEqual({
      categoryId: undefined,
      confidence: 0,
      rationale: ['Categorization failed - manual review required'],
      engine: 'pass1',
      llmAttempted: true, // Default config enables LLM
      timings: {
        pass1Ms: 0,
        pass2Ms: expect.any(Number),
        totalMs: expect.any(Number)
      }
    });

    expect(mockContext.logger?.error).toHaveBeenCalledWith(
      'Hybrid categorization failed',
      expect.objectContaining({
        txId: 'tx-123',
        error: 'Pass-1 engine failure'
      })
    );

    expect(mockContext.analytics?.captureException).toHaveBeenCalled();
  });
});

describe('batchCategorizeTransactions', () => {
  let mockTransactions: NormalizedTransaction[];
  let mockContext: CategorizationContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTransactions = [
      {
        id: 'tx-1' as any,
        orgId: 'org-456' as any,
        accountId: 'acc-789' as any,
        description: 'STARBUCKS',
        amount: -4.25,
        currency: 'USD',
        date: '2024-01-15',
        mcc: '5814',
        paymentChannel: 'card'
      },
      {
        id: 'tx-2' as any,
        orgId: 'org-456' as any,
        accountId: 'acc-789' as any,
        description: 'SHELL GAS',
        amount: -45.60,
        currency: 'USD',
        date: '2024-01-16',
        mcc: '5541',
        paymentChannel: 'card'
      }
    ];

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
  });

  test('processes multiple transactions and provides summary', async () => {
    const { enhancedPass1Categorize } = await import('@nexus/categorizer');

    // Mock Pass-1 to return high confidence for first, low for second
    vi.mocked(enhancedPass1Categorize)
      .mockResolvedValueOnce({
        categoryId: 'cat-food' as CategoryId,
        confidence: 0.9,
        rationale: ['Strong MCC match']
      })
      .mockResolvedValueOnce({
        categoryId: 'cat-fuel' as CategoryId,
        confidence: 0.85,
        rationale: ['MCC 5541 → Fuel']
      });

    const { results, summary } = await batchCategorizeTransactions(
      mockTransactions,
      mockContext
    );

    expect(results).toHaveLength(2);
    expect(results[0].result.engine).toBe('pass1');
    expect(results[0].result.confidence).toBe(0.9);
    expect(results[1].result.engine).toBe('pass1');
    expect(results[1].result.confidence).toBe(0.85);

    expect(summary).toEqual({
      total: 2,
      pass1Only: 2,
      llmUsed: 0,
      failed: 0,
      avgConfidence: 0.88,
      totalTimeMs: expect.any(Number)
    });

    expect(mockContext.logger?.info).toHaveBeenCalledWith(
      'Batch categorization completed',
      expect.objectContaining(summary)
    );
  });

  test('handles mixed success and failure in batch', async () => {
    const { enhancedPass1Categorize } = await import('@nexus/categorizer');

    vi.mocked(enhancedPass1Categorize)
      .mockResolvedValueOnce({
        categoryId: 'cat-food' as CategoryId,
        confidence: 0.9,
        rationale: ['Success']
      })
      .mockRejectedValueOnce(new Error('Processing failure'));

    const { results, summary } = await batchCategorizeTransactions(
      mockTransactions,
      mockContext
    );

    expect(results).toHaveLength(2);
    expect(results[0].result.confidence).toBe(0.9);
    expect(results[1].result.confidence).toBe(0);
    expect(results[1].result.rationale).toEqual(['Categorization failed - manual review required']);

    expect(summary).toEqual({
      total: 2,
      pass1Only: 1,
      llmUsed: 1, // Failed transaction shows llmAttempted: true (default config enables LLM fallback)
      failed: 1,
      avgConfidence: 0.45, // (0.9 + 0) / 2
      totalTimeMs: expect.any(Number)
    });

    expect(mockContext.logger?.error).toHaveBeenCalledWith(
      'Hybrid categorization failed',
      expect.objectContaining({
        txId: 'tx-2',
        error: 'Processing failure'
      })
    );
  });

  test('tracks LLM usage correctly in batch summary', async () => {
    const { enhancedPass1Categorize, scoreWithLLM } = await import('@nexus/categorizer');

    // First transaction: Pass-1 high confidence
    vi.mocked(enhancedPass1Categorize)
      .mockResolvedValueOnce({
        categoryId: 'cat-food' as CategoryId,
        confidence: 0.9,
        rationale: ['High confidence']
      })
      // Second transaction: Pass-1 low confidence, trigger LLM
      .mockResolvedValueOnce({
        categoryId: 'cat-uncertain' as CategoryId,
        confidence: 0.6,
        rationale: ['Low confidence']
      });

    vi.mocked(scoreWithLLM).mockResolvedValueOnce({
      categoryId: 'cat-fuel' as CategoryId,
      confidence: 0.85,
      rationale: 'LLM categorization'
    });

    const { summary } = await batchCategorizeTransactions(
      mockTransactions,
      mockContext
    );

    expect(summary).toEqual({
      total: 2,
      pass1Only: 1, // First transaction
      llmUsed: 1,   // Second transaction
      failed: 0,
      avgConfidence: 0.88, // (0.9 + 0.85) / 2
      totalTimeMs: expect.any(Number)
    });
  });
});