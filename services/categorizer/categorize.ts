import type {
  NormalizedTransaction,
  CategorizationResult,
  CategorizationContext,
  CategoryId
} from '../../packages/types/src/index.js';
import {
  enhancedPass1Categorize,
  createDefaultPass1Context,
  scoreWithLLM,
  type EnhancedCategorizationResult
} from '../../packages/categorizer/src/index.js';
import {
  enhancedLLMCategorize,
  type EnhancedLLMResult,
  DEFAULT_ENHANCED_LLM_CONFIG
} from './pass2.js';

/**
 * Extended context interface for services layer
 */
export interface ServiceCategorizationContext extends CategorizationContext {
  db?: any;
  analytics?: {
    captureEvent?: (event: string, properties: any) => void;
    captureException?: (error: Error) => void;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    debug: (message: string, meta?: any) => void;
  };
  caches?: {
    categories?: Map<string, any>;
    vendors?: Map<string, any>;
  };
  config?: {
    geminiApiKey?: string;
    model?: string;
  };
}

/**
 * Hybrid categorization configuration
 */
export interface HybridCategorizationConfig {
  /** Confidence threshold for Pass-1 acceptance (default: 0.75) */
  hybridThreshold: number;
  /** Whether to use LLM fallback when Pass-1 confidence is low */
  enableLLMFallback: boolean;
  /** Timeout for LLM calls in milliseconds (default: 5000) */
  llmTimeoutMs: number;
  /** Maximum retries for LLM failures (default: 1) */
  llmMaxRetries: number;
  /** Whether to use enhanced LLM with Pass-1 context (default: true) */
  useEnhancedLLM: boolean;
  /** Whether to apply post-LLM guardrails (default: true) */
  enablePostLLMGuardrails: boolean;
}

export const DEFAULT_HYBRID_CONFIG: HybridCategorizationConfig = {
  hybridThreshold: 0.75,
  enableLLMFallback: true,
  llmTimeoutMs: 5000,
  llmMaxRetries: 1,
  useEnhancedLLM: true,
  enablePostLLMGuardrails: true,
};

/**
 * Extended result with engine tracking and rationale
 */
export interface HybridCategorizationResult {
  /** Category ID assigned */
  categoryId?: CategoryId;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Structured rationale from Pass-1 signals or LLM reasoning */
  rationale: string[];
  /** Which engine provided the final result */
  engine: 'pass1' | 'llm';
  /** Pass-1 result for debugging (always populated) */
  pass1Result?: EnhancedCategorizationResult;
  /** Whether LLM was attempted */
  llmAttempted: boolean;
  /** Timing information */
  timings: {
    pass1Ms: number;
    pass2Ms?: number;
    totalMs: number;
  };
}

/**
 * Main hybrid categorization function
 *
 * Strategy:
 * 1. Always run Pass-1 with enhanced engine (rules + scoring + guardrails)
 * 2. If Pass-1 confidence >= threshold → accept and return
 * 3. If Pass-1 confidence < threshold and LLM enabled → run Pass-2
 * 4. Return best result with full provenance tracking
 */
export async function categorizeTransaction(
  transaction: NormalizedTransaction,
  context: ServiceCategorizationContext,
  config: Partial<HybridCategorizationConfig> = {}
): Promise<HybridCategorizationResult> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_HYBRID_CONFIG, ...config };

  try {
    // Phase 1: Enhanced Pass-1 categorization
    const pass1Start = Date.now();

    const pass1Context = createDefaultPass1Context();
    const pass1Result = await enhancedPass1Categorize(transaction, {
      ...context,
      ...pass1Context
    });

    const pass1Ms = Date.now() - pass1Start;

    // Check if Pass-1 result meets confidence threshold
    const pass1Confidence = pass1Result.confidence || 0;
    const shouldAcceptPass1 = pass1Confidence >= finalConfig.hybridThreshold;

    // Log Pass-1 result for observability
    context.logger?.info('Pass-1 categorization completed', {
      txId: transaction.id,
      confidence: pass1Confidence,
      categoryId: pass1Result.categoryId,
      shouldAccept: shouldAcceptPass1,
      rationale: pass1Result.rationale,
      signals: pass1Result.signals?.length || 0,
      guardrailsTriggered: pass1Result.guardrailViolations?.length || 0
    });

    if (shouldAcceptPass1) {
      // Accept Pass-1 result
      return {
        categoryId: pass1Result.categoryId,
        confidence: pass1Result.confidence,
        rationale: pass1Result.rationale || [],
        engine: 'pass1',
        pass1Result,
        llmAttempted: false,
        timings: {
          pass1Ms,
          totalMs: Date.now() - startTime
        }
      };
    }

    // Phase 2: LLM fallback (if enabled and confidence is low)
    if (!finalConfig.enableLLMFallback) {
      context.logger?.info('LLM fallback disabled, returning Pass-1 result', {
        txId: transaction.id,
        confidence: pass1Confidence
      });

      return {
        categoryId: pass1Result.categoryId,
        confidence: pass1Result.confidence,
        rationale: pass1Result.rationale || [],
        engine: 'pass1',
        pass1Result,
        llmAttempted: false,
        timings: {
          pass1Ms,
          totalMs: Date.now() - startTime
        }
      };
    }

    // Run Pass-2 (LLM) with enhanced or legacy path
    const pass2Start = Date.now();
    let pass2Result: CategorizationResult | EnhancedLLMResult | null = null;

    try {
      if (finalConfig.useEnhancedLLM) {
        // Use enhanced LLM with Pass-1 context and guardrails
        const enhancedResult = await enhancedLLMCategorize(
          transaction,
          context,
          pass1Result,
          {
            timeoutMs: finalConfig.llmTimeoutMs,
            maxRetries: finalConfig.llmMaxRetries,
            enablePostLLMGuardrails: finalConfig.enablePostLLMGuardrails,
            includePass1Context: true
          }
        );

        pass2Result = enhancedResult;

        // Log enhanced LLM details
        context.logger?.info('Enhanced LLM categorization completed', {
          txId: transaction.id,
          confidence: enhancedResult.confidence,
          categoryId: enhancedResult.categoryId,
          guardrailsApplied: enhancedResult.guardrailsApplied,
          violations: enhancedResult.guardrailViolations,
          retryCount: enhancedResult.retryCount
        });

      } else {
        // Legacy LLM path (fallback)
        context.logger?.info('Using legacy LLM path', { txId: transaction.id });

        let retryCount = 0;
        while (retryCount <= finalConfig.llmMaxRetries && !pass2Result) {
          try {
            const llmContext = {
              ...context,
              timeoutMs: finalConfig.llmTimeoutMs
            };

            pass2Result = await scoreWithLLM(transaction, llmContext);
            break;

          } catch (error) {
            retryCount++;
            if (retryCount > finalConfig.llmMaxRetries) {
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
          }
        }
      }

    } catch (error) {
      context.logger?.error('LLM categorization failed', {
        txId: transaction.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        enhanced: finalConfig.useEnhancedLLM
      });

      context.analytics?.captureException?.(
        error instanceof Error ? error : new Error('LLM categorization failed')
      );
    }

    const pass2Ms = Date.now() - pass2Start;

    // Determine final result
    if (pass2Result && (pass2Result.confidence || 0) > pass1Confidence) {
      // Use LLM result if it has higher confidence
      return {
        categoryId: pass2Result.categoryId,
        confidence: pass2Result.confidence,
        rationale: Array.isArray(pass2Result.rationale)
          ? pass2Result.rationale
          : pass2Result.rationale ? [pass2Result.rationale] : [],
        engine: 'llm',
        pass1Result,
        llmAttempted: true,
        timings: {
          pass1Ms,
          pass2Ms,
          totalMs: Date.now() - startTime
        }
      };
    } else {
      // Fall back to Pass-1 result (LLM failed or had lower confidence)
      context.logger?.info('Using Pass-1 result after LLM attempt', {
        txId: transaction.id,
        pass1Confidence,
        pass2Confidence: pass2Result?.confidence || null,
        reason: pass2Result ? 'llm_lower_confidence' : 'llm_failed'
      });

      return {
        categoryId: pass1Result.categoryId,
        confidence: pass1Result.confidence,
        rationale: pass1Result.rationale || [],
        engine: 'pass1',
        pass1Result,
        llmAttempted: true,
        timings: {
          pass1Ms,
          pass2Ms,
          totalMs: Date.now() - startTime
        }
      };
    }

  } catch (error) {
    const totalMs = Date.now() - startTime;

    context.logger?.error('Hybrid categorization failed', {
      txId: transaction.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalMs
    });

    context.analytics?.captureException?.(
      error instanceof Error ? error : new Error('Hybrid categorization failed')
    );

    // Return uncertain result as fallback
    return {
      categoryId: undefined,
      confidence: 0,
      rationale: ['Categorization failed - manual review required'],
      engine: 'pass1',
      llmAttempted: finalConfig.enableLLMFallback,
      timings: {
        pass1Ms: 0,
        pass2Ms: finalConfig.enableLLMFallback ? totalMs : 0,
        totalMs
      }
    };
  }
}

/**
 * Batch categorization for multiple transactions
 * Processes transactions sequentially to manage resource usage
 */
export async function batchCategorizeTransactions(
  transactions: NormalizedTransaction[],
  context: ServiceCategorizationContext,
  config: Partial<HybridCategorizationConfig> = {}
): Promise<{
  results: Array<{
    transaction: NormalizedTransaction;
    result: HybridCategorizationResult;
  }>;
  summary: {
    total: number;
    pass1Only: number;
    llmUsed: number;
    failed: number;
    avgConfidence: number;
    totalTimeMs: number;
  };
}> {
  const startTime = Date.now();
  const results: Array<{
    transaction: NormalizedTransaction;
    result: HybridCategorizationResult;
  }> = [];

  let pass1OnlyCount = 0;
  let llmUsedCount = 0;
  let failedCount = 0;
  let totalConfidence = 0;

  for (const transaction of transactions) {
    try {
      const result = await categorizeTransaction(transaction, context, config);
      results.push({ transaction, result });

      // Update counters
      if (result.engine === 'pass1' && !result.llmAttempted) {
        pass1OnlyCount++;
      } else if (result.llmAttempted) {
        llmUsedCount++;
      }

      if ((result.confidence || 0) === 0) {
        failedCount++;
      }

      totalConfidence += result.confidence || 0;

    } catch (error) {
      failedCount++;
      context.logger?.error('Batch categorization item failed', {
        txId: transaction.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Add failed result to maintain array alignment
      results.push({
        transaction,
        result: {
          categoryId: undefined,
          confidence: 0,
          rationale: ['Batch processing failed'],
          engine: 'pass1',
          llmAttempted: false,
          timings: { pass1Ms: 0, pass2Ms: 0, totalMs: 0 }
        }
      });
    }
  }

  const totalTimeMs = Date.now() - startTime;
  const avgConfidence = transactions.length > 0 ? totalConfidence / transactions.length : 0;

  const summary = {
    total: transactions.length,
    pass1Only: pass1OnlyCount,
    llmUsed: llmUsedCount,
    failed: failedCount,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    totalTimeMs
  };

  context.logger?.info('Batch categorization completed', {
    ...summary,
    orgId: context.orgId
  });

  return { results, summary };
}