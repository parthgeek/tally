import type {
  NormalizedTransaction,
  CategorizationResult,
  CategorizationContext,
  CategoryId
} from '../../packages/types/src/index.js';
import {
  scoreWithLLM,
  applyGuardrails,
  categorizeWithUniversalLLM,
  getOrganizationIndustry,
  GeminiClient,
  type EnhancedCategorizationResult,
  type UniversalCategorizationResult,
  DEFAULT_GUARDRAIL_CONFIG
} from '../../packages/categorizer/src/index.js';

/**
 * Enhanced LLM categorization configuration
 */
export interface EnhancedLLMConfig {
  /** Timeout for LLM calls in milliseconds (default: 5000) */
  timeoutMs: number;
  /** Maximum retries for LLM failures (default: 1) */
  maxRetries: number;
  /** Whether to apply post-LLM guardrails (default: true) */
  enablePostLLMGuardrails: boolean;
  /** Whether to provide Pass-1 context to LLM (default: true) */
  includePass1Context: boolean;
}

export const DEFAULT_ENHANCED_LLM_CONFIG: EnhancedLLMConfig = {
  timeoutMs: 5000,
  maxRetries: 1,
  enablePostLLMGuardrails: true,
  includePass1Context: true,
};

/**
 * Enhanced LLM result with validation information
 */
export interface EnhancedLLMResult extends CategorizationResult {
  /** Whether guardrails were applied post-LLM */
  guardrailsApplied: boolean;
  /** Any guardrail violations found */
  guardrailViolations: string[];
  /** Pass-1 context that was provided to LLM */
  pass1Context?: {
    topSignals: string[];
    mccMapping?: string;
    vendorMatch?: string;
    confidence: number;
  };
  /** Number of retry attempts made */
  retryCount: number;
  /** Extracted attributes from universal LLM */
  attributes?: Record<string, any>;
}

/**
 * Enhanced LLM categorization with Pass-1 context and post-LLM validation
 *
 * Features:
 * 1. Provides Pass-1 signals as context to the LLM
 * 2. Applies guardrails to LLM results to catch obvious errors
 * 3. Handles retries with exponential backoff
 * 4. Returns detailed validation information
 */
export async function enhancedLLMCategorize(
  transaction: NormalizedTransaction,
  context: CategorizationContext,
  pass1Result?: EnhancedCategorizationResult,
  config: Partial<EnhancedLLMConfig> = {}
): Promise<EnhancedLLMResult> {
  const finalConfig = { ...DEFAULT_ENHANCED_LLM_CONFIG, ...config };
  let retryCount = 0;
  let lastError: Error | null = null;

  // Prepare Pass-1 context for LLM if available and enabled
  const pass1Context = finalConfig.includePass1Context && pass1Result
    ? extractPass1Context(pass1Result)
    : undefined;

  while (retryCount <= finalConfig.maxRetries) {
    try {
      context.logger?.info('Attempting enhanced LLM categorization', {
        txId: transaction.id,
        attempt: retryCount + 1,
        maxRetries: finalConfig.maxRetries + 1,
        hasPass1Context: !!pass1Context,
        timeoutMs: finalConfig.timeoutMs
      });

      // Create enhanced context with Pass-1 information
      const enhancedContext = pass1Context
        ? createEnhancedLLMContext(context, pass1Context, finalConfig.timeoutMs)
        : { ...context, timeoutMs: finalConfig.timeoutMs };

      // Use universal LLM for categorization with attribute extraction
      const geminiClient = new GeminiClient({
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash-lite',
        temperature: 1.0,
      });

      const industry = getOrganizationIndustry(transaction.orgId);
      const universalResult = await categorizeWithUniversalLLM(
        transaction,
        {
          industry,
          orgId: transaction.orgId,
          config: {
            model: 'gemini-2.5-flash-lite',
            temperature: 1.0,
          },
          pass1Context: pass1Context ? {
            categoryId: pass1Result?.categoryId,
            confidence: pass1Result?.confidence,
            signals: pass1Context.topSignals,
          } : undefined,
          logger: context.logger,
          analytics: context.analytics,
        },
        geminiClient
      );

      // Convert universal result to standard format
      const llmResult = {
        categoryId: universalResult.categoryId,
        confidence: universalResult.confidence,
        rationale: universalResult.rationale,
        attributes: universalResult.attributes,
      };

      context.logger?.info('LLM categorization completed', {
        txId: transaction.id,
        confidence: llmResult.confidence,
        categoryId: llmResult.categoryId,
        attempt: retryCount + 1
      });

      // Apply post-LLM guardrails if enabled
      let finalResult = llmResult;
      let guardrailsApplied = false;
      let guardrailViolations: string[] = [];

      if (finalConfig.enablePostLLMGuardrails && llmResult.categoryId && llmResult.confidence) {
        try {
          const categoryScore = {
            categoryId: llmResult.categoryId,
            confidence: llmResult.confidence,
            strength: 'exact' as const,
            weight: 1.0,
            metadata: { source: 'LLM', details: 'LLM categorization result' }
          };

          const guardrailResult = applyGuardrails(
            transaction,
            categoryScore,
            DEFAULT_GUARDRAIL_CONFIG
          );

          if (!guardrailResult.allowed || guardrailResult.violations.length > 0) {
            guardrailsApplied = true;
            guardrailViolations = guardrailResult.violations.map(v =>
              `${v.type}: ${v.reason}`
            );

            // Log guardrail interventions
            context.logger?.info('Post-LLM guardrails triggered', {
              txId: transaction.id,
              violations: guardrailViolations,
              originalCategory: llmResult.categoryId,
              finalCategory: guardrailResult.finalCategory,
              originalConfidence: llmResult.confidence,
              finalConfidence: guardrailResult.finalConfidence
            });

            // Use guardrail-corrected result
            finalResult = {
              categoryId: guardrailResult.finalCategory,
              confidence: guardrailResult.finalConfidence,
              rationale: [
                ...(Array.isArray(llmResult.rationale)
                  ? llmResult.rationale
                  : llmResult.rationale ? [llmResult.rationale] : []),
                `Guardrails applied: ${guardrailViolations.join(', ')}`
              ]
            };

            // Track guardrail interventions
            context.analytics?.captureEvent?.('llm_guardrail_intervention', {
              org_id: context.orgId,
              transaction_id: transaction.id,
              original_category: llmResult.categoryId,
              final_category: guardrailResult.finalCategory,
              violations: guardrailViolations,
              original_confidence: llmResult.confidence,
              final_confidence: guardrailResult.finalConfidence
            });
          }
        } catch (guardrailError) {
          context.logger?.error('Post-LLM guardrails failed', {
            txId: transaction.id,
            error: guardrailError instanceof Error ? guardrailError.message : 'Unknown error'
          });
          // Continue with original LLM result if guardrails fail
        }
      }

      return {
        categoryId: finalResult.categoryId,
        confidence: finalResult.confidence,
        rationale: Array.isArray(finalResult.rationale)
          ? finalResult.rationale
          : finalResult.rationale ? [finalResult.rationale] : [],
        attributes: llmResult.attributes || {},
        guardrailsApplied,
        guardrailViolations,
        pass1Context,
        retryCount
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown LLM error');
      retryCount++;

      const isLastAttempt = retryCount > finalConfig.maxRetries;

      context.logger?.error('Enhanced LLM categorization failed', {
        txId: transaction.id,
        attempt: retryCount,
        error: lastError.message,
        willRetry: !isLastAttempt
      });

      if (isLastAttempt) {
        context.analytics?.captureException?.(lastError);
        break;
      }

      // Exponential backoff for retries
      if (!isLastAttempt) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
      }
    }
  }

  // Return failure result
  context.logger?.error('Enhanced LLM categorization failed after all retries', {
    txId: transaction.id,
    totalAttempts: retryCount,
    error: lastError?.message || 'Unknown error'
  });

  return {
    categoryId: undefined,
    confidence: 0,
    rationale: [`LLM categorization failed: ${lastError?.message || 'Unknown error'}`],
    guardrailsApplied: false,
    guardrailViolations: [],
    pass1Context,
    retryCount
  };
}

/**
 * Extracts relevant context from Pass-1 result for LLM prompting
 */
function extractPass1Context(pass1Result: EnhancedCategorizationResult): {
  topSignals: string[];
  mccMapping?: string;
  vendorMatch?: string;
  confidence: number;
} {
  const topSignals: string[] = [];
  let mccMapping: string | undefined;
  let vendorMatch: string | undefined;

  // Extract top signals from Pass-1 result
  if (pass1Result.signals) {
    // Sort signals by confidence and take top 3
    const sortedSignals = pass1Result.signals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    for (const signal of sortedSignals) {
      const signalDesc = `${signal.type}:${signal.evidence} (confidence: ${signal.confidence.toFixed(2)})`;
      topSignals.push(signalDesc);

      // Extract specific signal types for structured context
      if (signal.type === 'mcc' && !mccMapping) {
        mccMapping = `MCC ${signal.evidence}`;
      }
      if (signal.type === 'vendor' && !vendorMatch) {
        vendorMatch = signal.evidence;
      }
    }
  }

  return {
    topSignals,
    mccMapping,
    vendorMatch,
    confidence: pass1Result.confidence || 0
  };
}

/**
 * Creates enhanced LLM context with Pass-1 information
 */
function createEnhancedLLMContext(
  baseContext: CategorizationContext,
  pass1Context: { topSignals: string[]; mccMapping?: string; vendorMatch?: string; confidence: number },
  timeoutMs: number
): CategorizationContext & { pass1Signals?: string[]; timeoutMs: number } {
  return {
    ...baseContext,
    timeoutMs,
    pass1Signals: pass1Context.topSignals,
    // Additional context could be added here for LLM prompting
  };
}

/**
 * Test cases for ambiguous merchants that require enhanced LLM categorization
 */
export const AMBIGUITY_TEST_CASES = [
  {
    name: 'Amazon - Retail vs Subscription',
    transactions: [
      {
        description: 'AMAZON.COM ORDER 123-456',
        merchantName: 'Amazon',
        amountCents: '2999', // $29.99
        mcc: '5942', // Book stores
        expectedAmbiguity: ['supplies', 'other_expenses', 'office_supplies']
      },
      {
        description: 'AMAZON PRIME MEMBERSHIP',
        merchantName: 'Amazon',
        amountCents: '1299', // $12.99
        mcc: '5942',
        expectedAmbiguity: ['software', 'professional_services']
      }
    ]
  },
  {
    name: '7-Eleven - Fuel vs Convenience',
    transactions: [
      {
        description: '7-ELEVEN #12345 FUEL',
        merchantName: '7-Eleven',
        amountCents: '4567', // $45.67
        mcc: '5541', // Service stations
        expectedAmbiguity: ['travel', 'other_expenses']
      },
      {
        description: '7-ELEVEN #12345',
        merchantName: '7-Eleven',
        amountCents: '892', // $8.92
        mcc: '5499', // Miscellaneous food stores
        expectedAmbiguity: ['supplies', 'other_expenses']
      }
    ]
  },
  {
    name: 'Generic BILL Descriptors',
    transactions: [
      {
        description: 'BILL PAYMENT UTILITIES',
        merchantName: 'AUTOPAY',
        amountCents: '15678', // $156.78
        mcc: '4900', // Utilities
        expectedAmbiguity: ['rent_utilities']
      },
      {
        description: 'MONTHLY BILL PAYMENT',
        merchantName: 'GENERIC BILLING',
        amountCents: '8900', // $89.00
        mcc: undefined,
        expectedAmbiguity: ['rent_utilities', 'professional_services', 'software', 'other_expenses']
      }
    ]
  }
];