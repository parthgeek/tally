import { describe, expect, test, vi } from 'vitest';
import type { CategorizationResult, TransactionId } from '@nexus/types';
import { decideAndApply, batchDecideAndApply } from './apply.js';

describe('decideAndApply', () => {
  const mockTxId = 'tx-123' as TransactionId;
  const mockOrgId = 'org-456';

  const createMockContext = (mockDb: any) => ({
    orgId: mockOrgId as any,
    db: mockDb,
    analytics: {
      captureEvent: vi.fn(),
      captureException: vi.fn()
    },
    logger: {
      info: vi.fn(),
      error: vi.fn()
    }
  });

  test('auto-applies category when confidence >= 0.85', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockTxId, org_id: mockOrgId },
              error: null
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        insert: vi.fn().mockResolvedValue({ error: null })
      })
    };

    const ctx = createMockContext(mockDb);
    
    const result: CategorizationResult = {
      categoryId: 'cat-123' as any,
      confidence: 0.9,
      rationale: ['MCC mapping: 7230 → Hair Services']
    };

    await decideAndApply(mockTxId, result, 'pass1', ctx);

    // Verify transaction update
    expect(mockDb.from).toHaveBeenCalledWith('transactions');
    
    const updateCall = mockDb.from.mock.results[1];
    const updateMock = updateCall.value.update.mock.calls[0][0];
    
    expect(updateMock).toEqual({
      reviewed: false,
      category_id: 'cat-123',
      confidence: 0.9,
      needs_review: false
    });

    // Verify decision audit record
    const insertCall = mockDb.from.mock.results[2];
    const insertMock = insertCall.value.insert.mock.calls[0][0];
    
    expect(insertMock).toEqual({
      tx_id: mockTxId,
      source: 'pass1',
      confidence: 0.9,
      rationale: ['MCC mapping: 7230 → Hair Services'],
      org_id: mockOrgId,
      category_id: mockCategoryId
    });

    // Verify analytics event
    expect(ctx.analytics.captureEvent).toHaveBeenCalledWith(
      'categorization_auto_applied',
      {
        org_id: mockOrgId,
        transaction_id: mockTxId,
        category_id: 'cat-123',
        confidence: 0.9,
        source: 'pass1',
        rationale_count: 1
      }
    );
  });

  test('marks for review when confidence < 0.85', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockTxId, org_id: mockOrgId },
              error: null
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        insert: vi.fn().mockResolvedValue({ error: null })
      })
    };

    const ctx = createMockContext(mockDb);
    
    const result: CategorizationResult = {
      categoryId: 'cat-456' as any,
      confidence: 0.7,
      rationale: ['Pattern match with low confidence']
    };

    await decideAndApply(mockTxId, result, 'llm', ctx);

    // Verify transaction marked for review
    const updateCall = mockDb.from.mock.results[1];
    const updateMock = updateCall.value.update.mock.calls[0][0];
    
    expect(updateMock).toEqual({
      reviewed: false,
      needs_review: true,
      category_id: 'cat-456',
      confidence: 0.7
    });

    // Verify review analytics event
    expect(ctx.analytics.captureEvent).toHaveBeenCalledWith(
      'categorization_marked_for_review',
      {
        org_id: mockOrgId,
        transaction_id: mockTxId,
        confidence: 0.7,
        source: 'llm',
        reason: 'low_confidence'
      }
    );
  });

  test('handles transaction not found error', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Transaction not found' }
            })
          })
        })
      })
    };

    const ctx = createMockContext(mockDb);
    
    const result: CategorizationResult = {
      categoryId: 'cat-123' as any,
      confidence: 0.9,
      rationale: []
    };

    await expect(decideAndApply(mockTxId, result, 'pass1', ctx))
      .rejects.toThrow('Transaction not found: tx-123');
  });

  test('handles unauthorized access to different org', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockTxId, org_id: 'different-org' },
              error: null
            })
          })
        })
      })
    };

    const ctx = createMockContext(mockDb);
    
    const result: CategorizationResult = {
      categoryId: 'cat-123' as any,
      confidence: 0.9,
      rationale: []
    };

    await expect(decideAndApply(mockTxId, result, 'pass1', ctx))
      .rejects.toThrow('Unauthorized access to transaction');
  });
});

describe('batchDecideAndApply', () => {
  test('processes multiple decisions with mixed results', async () => {
    let callCount = 0;
    const mockDb = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 2) {
                // Second call fails
                return Promise.resolve({
                  data: null,
                  error: { message: 'Transaction not found' }
                });
              }
              return Promise.resolve({
                data: { id: `tx-${callCount}`, org_id: 'org-123' },
                error: null
              });
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        insert: vi.fn().mockResolvedValue({ error: null })
      }))
    };

    const ctx = {
      orgId: 'org-123' as any,
      db: mockDb,
      analytics: { captureEvent: vi.fn(), captureException: vi.fn() },
      logger: { info: vi.fn(), error: vi.fn() }
    };

    const decisions = [
      {
        txId: 'tx-1' as TransactionId,
        result: { categoryId: 'cat-1' as any, confidence: 0.9, rationale: [] },
        source: 'pass1' as const
      },
      {
        txId: 'tx-2' as TransactionId,
        result: { categoryId: 'cat-2' as any, confidence: 0.8, rationale: [] },
        source: 'llm' as const
      },
      {
        txId: 'tx-3' as TransactionId,
        result: { categoryId: 'cat-3' as any, confidence: 0.95, rationale: [] },
        source: 'pass1' as const
      }
    ];

    const results = await batchDecideAndApply(decisions, ctx);

    expect(results.successful).toBe(2);
    expect(results.failed).toHaveLength(1);
    expect(results.failed[0].txId).toBe('tx-2');
    expect(results.failed[0].error).toBe('Transaction not found: tx-2');
    
    // Verify summary logging
    expect(ctx.logger.info).toHaveBeenCalledWith(
      'Batch decision processing completed',
      {
        total: 3,
        successful: 2,
        failed: 1,
        org_id: 'org-123'
      }
    );
  });
});