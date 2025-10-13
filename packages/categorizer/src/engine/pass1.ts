import type {
  NormalizedTransaction,
  CategorizationResult,
  CategorizationContext,
  CategoryId,
} from "@nexus/types";
import { getMCCMapping } from "../rules/mcc.js";
import { findBestVendorMatch } from "../rules/vendors.js";
import { getBestKeywordMatch } from "../rules/keywords.js";
import { mapCategorySlugToId } from "../taxonomy.js";
import {
  createSignal,
  scoreSignals,
  calibrateConfidence,
  applyAmountHeuristics,
  type CategorizationSignal,
} from "./scorer.js";
import {
  applyGuardrails,
  createUncertainResult,
  DEFAULT_GUARDRAIL_CONFIG,
  type GuardrailConfig,
} from "./guardrails.js";

/**
 * Enhanced Pass-1 categorization context with caching and configuration
 */
export interface Pass1Context extends CategorizationContext {
  db: any; // Supabase client
  analytics?:
    | {
        captureEvent?: (event: string, properties: any) => void;
        captureException?: (error: Error) => void;
      }
    | undefined;
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    debug: (message: string, meta?: any) => void;
  };
  caches?: {
    vendorRules?: Map<string, any[]>;
    vendorEmbeddings?: Map<string, any[]>;
  };
  config?: {
    guardrails?: GuardrailConfig;
    enableEmbeddings?: boolean;
    debugMode?: boolean;
  };
}

/**
 * Enhanced categorization result with structured rationale and guardrail information
 */
export interface EnhancedCategorizationResult extends CategorizationResult {
  signals: CategorizationSignal[];
  guardrailsApplied: string[];
  debugInfo?: {
    allCandidates: any[];
    violations: any[];
    processingTime: number;
  };
}

/**
 * Enhanced Pass-1 deterministic categorization using new scoring system
 *
 * Processing pipeline:
 * 1. Extract signals from MCC, vendor patterns, keywords
 * 2. Score and aggregate signals by category
 * 3. Apply guardrails and compatibility checks
 * 4. Return best candidate with structured rationale
 */
export async function pass1Categorize(
  transaction: NormalizedTransaction,
  context: Pass1Context
): Promise<EnhancedCategorizationResult> {
  const startTime = Date.now();
  const signals: CategorizationSignal[] = [];
  const config = context.config || {};
  const guardrailConfig = config.guardrails || DEFAULT_GUARDRAIL_CONFIG;

  try {
    context.logger?.debug("Starting Pass-1 categorization", {
      txId: transaction.id,
      merchantName: transaction.merchantName,
      mcc: transaction.mcc,
      amount: transaction.amountCents,
    });

    // === 1. MCC Signal Extraction ===
    if (transaction.mcc) {
      const mccMapping = getMCCMapping(transaction.mcc);
      if (mccMapping) {
        const signal = createSignal(
          "mcc",
          mccMapping.categoryId,
          mccMapping.categoryName,
          mccMapping.strength === "exact" ? "exact" : "strong",
          mccMapping.baseConfidence,
          `MCC:${transaction.mcc}`,
          `${transaction.mcc} maps to ${mccMapping.categoryName} (${mccMapping.strength})`
        );
        signals.push(signal);

        context.logger?.debug("MCC signal found", {
          mcc: transaction.mcc,
          category: mccMapping.categoryName,
          confidence: signal.confidence,
        });
      }
    }

    // === 2. Vendor Pattern Signal Extraction ===
    if (transaction.merchantName) {
      const vendorMatch = findBestVendorMatch(transaction.merchantName, transaction.description);
      if (vendorMatch) {
        // Map category slug to ID
        const categoryId = mapCategorySlugToId(vendorMatch.categorySlug) as CategoryId;
        
        const signal = createSignal(
          "vendor",
          categoryId,
          vendorMatch.categoryName,
          vendorMatch.matchType === "exact" ? "exact" : "strong",
          vendorMatch.confidence,
          `vendor:${vendorMatch.pattern}`,
          `'${transaction.merchantName}' matched vendor pattern '${vendorMatch.pattern}' (${vendorMatch.matchType})`
        );
        signals.push(signal);

        context.logger?.debug("Vendor signal found", {
          merchant: transaction.merchantName,
          pattern: vendorMatch.pattern,
          category: vendorMatch.categoryName,
          confidence: signal.confidence,
        });
      }
    }

    // === 3. Keyword Signal Extraction ===
    const keywordMatch = getBestKeywordMatch(transaction.description);
    if (keywordMatch) {
      // Determine category name from the rationale (not ideal, but matches current structure)
      const categoryName = keywordMatch.rationale[0]?.split(" → ")[1] || "Unknown";

      const signal = createSignal(
        "keyword",
        keywordMatch.categoryId,
        categoryName,
        "medium", // Keywords are generally medium strength
        keywordMatch.confidence,
        "keywords",
        keywordMatch.rationale.join("; "),
        keywordMatch.rationale[0]
          ?.split(" → ")[0]
          ?.replace("keywords: [", "")
          .replace("]", "")
          .split(", ")
      );
      signals.push(signal);

      context.logger?.debug("Keyword signal found", {
        description: transaction.description,
        category: categoryName,
        confidence: signal.confidence,
      });
    }

    // === 4. Embeddings Boost (if enabled) ===
    if (config.enableEmbeddings && transaction.merchantName) {
      const normalizedVendor = transaction.merchantName.toLowerCase().trim();

      try {
        // Check cache first
        const cacheKey = `${context.orgId}:${normalizedVendor}`;
        let embeddingMatches = context.caches?.vendorEmbeddings?.get(cacheKey);

        if (!embeddingMatches) {
          // Import embeddings module dynamically to avoid circular dependencies
          const { generateVendorEmbedding, findNearestVendorEmbeddings } =
            await import("./embeddings.js");

          // Generate embedding for the vendor
          const openaiApiKey = process.env.OPENAI_API_KEY;
          if (!openaiApiKey) {
            context.logger?.debug("OpenAI API key not found, skipping embeddings");
          } else {
            const queryEmbedding = await generateVendorEmbedding(normalizedVendor, openaiApiKey);

            // Find nearest neighbors
            embeddingMatches = await findNearestVendorEmbeddings(
              context.db,
              context.orgId,
              queryEmbedding,
              {
                similarityThreshold: 0.7,
                maxResults: 5,
              }
            );

            // Cache the results
            context.caches?.vendorEmbeddings?.set(cacheKey, embeddingMatches);

            context.logger?.debug("Embedding search completed", {
              vendor: normalizedVendor,
              matchCount: embeddingMatches.length,
            });
          }
        }

        if (embeddingMatches && embeddingMatches.length > 0) {
          // Import trackEmbeddingMatch for recording matches
          const { trackEmbeddingMatch } = await import("./embeddings.js");

          // Create embedding signals for similar vendors
          for (const match of embeddingMatches) {
            if (match.similarityScore >= 0.7) {
              const boostSignal = createSignal(
                "embedding",
                match.categoryId,
                match.categoryName,
                "weak",
                match.similarityScore * match.confidence * 0.4, // Confidence boost weighted by match confidence
                `embedding:${match.vendor}`,
                `Similar to vendor '${match.vendor}' (similarity: ${match.similarityScore.toFixed(3)}, confidence: ${match.confidence.toFixed(3)})`
              );
              signals.push(boostSignal);

              // Track the match for stability monitoring (async, don't await)
              trackEmbeddingMatch(
                context.db,
                context.orgId,
                transaction.id,
                match,
                false // Will be updated later if this contributes to final decision
              ).catch((err) => {
                context.logger?.debug("Failed to track embedding match", { error: err });
              });
            }
          }
        }
      } catch (error) {
        context.logger?.debug("Embeddings lookup failed", { error });
        context.analytics?.captureException?.(
          error instanceof Error ? error : new Error("Embeddings lookup failed")
        );
        // Don't fail the whole categorization for embeddings issues
      }
    }

    // === 5. Score Aggregation ===
    const scoringResult = scoreSignals(signals);

    context.logger?.debug("Scoring completed", {
      signalCount: signals.length,
      candidateCount: scoringResult.allCandidates.length,
      bestCategory: scoringResult.bestCategory?.categoryName,
      bestScore: scoringResult.bestCategory?.totalScore,
    });

    // === 6. Guardrails Application ===
    let finalResult: EnhancedCategorizationResult;

    if (scoringResult.bestCategory) {
      const guardrailResult = applyGuardrails(
        transaction,
        scoringResult.bestCategory,
        guardrailConfig
      );

      if (guardrailResult.allowed && guardrailResult.finalCategory) {
        // Calibrate confidence to avoid uniform distributions
        let calibratedConfidence = calibrateConfidence(
          guardrailResult.finalConfidence || scoringResult.bestCategory.confidence,
          signals.length
        );

        // Apply amount-based heuristics to further refine confidence
        const amountHeuristic = applyAmountHeuristics(
          transaction.amountCents,
          guardrailResult.finalCategory,
          transaction.merchantName
        );

        // Apply the heuristic modifier (capped at reasonable range)
        if (amountHeuristic.modifier !== 0) {
          calibratedConfidence = Math.min(
            0.98,
            Math.max(0.05, calibratedConfidence + amountHeuristic.modifier)
          );
          scoringResult.rationale.push(`amount_heuristic: ${amountHeuristic.reason}`);
        }

        finalResult = {
          categoryId: guardrailResult.finalCategory,
          confidence: calibratedConfidence,
          rationale: [
            ...scoringResult.rationale,
            ...(guardrailResult.guardrailsApplied.length > 0
              ? [`guardrails: ${guardrailResult.guardrailsApplied.join(", ")}`]
              : []),
          ],
          signals,
          guardrailsApplied: guardrailResult.guardrailsApplied,
        };

        context.analytics?.captureEvent?.("pass1_categorization_success", {
          org_id: context.orgId,
          transaction_id: transaction.id,
          category_id: finalResult.categoryId,
          confidence: finalResult.confidence,
          signal_count: signals.length,
          guardrails_applied: guardrailResult.guardrailsApplied.length,
        });
      } else {
        // Guardrails rejected the categorization
        createUncertainResult(transaction, guardrailResult.violations);

        finalResult = {
          categoryId: undefined,
          confidence: undefined,
          rationale: [
            ...scoringResult.rationale,
            `guardrails_rejected: ${guardrailResult.violations.map((v) => v.type).join(", ")}`,
          ],
          signals,
          guardrailsApplied: guardrailResult.guardrailsApplied,
        };

        context.analytics?.captureEvent?.("pass1_categorization_rejected", {
          org_id: context.orgId,
          transaction_id: transaction.id,
          violations: guardrailResult.violations.map((v) => v.type),
          signal_count: signals.length,
        });
      }
    } else {
      // No categorization candidate found
      finalResult = {
        categoryId: undefined,
        confidence: undefined,
        rationale: ["No categorization signals found or signals below threshold"],
        signals,
        guardrailsApplied: [],
      };

      context.analytics?.captureEvent?.("pass1_categorization_no_signals", {
        org_id: context.orgId,
        transaction_id: transaction.id,
        attempted_signals: signals.length,
      });
    }

    // === 7. Debug Information (if enabled) ===
    if (config.debugMode) {
      finalResult.debugInfo = {
        allCandidates: scoringResult.allCandidates,
        violations: scoringResult.bestCategory
          ? applyGuardrails(transaction, scoringResult.bestCategory, guardrailConfig).violations
          : [],
        processingTime: Date.now() - startTime,
      };
    }

    context.logger?.info("Pass-1 categorization completed", {
      txId: transaction.id,
      categoryId: finalResult.categoryId,
      confidence: finalResult.confidence,
      signalCount: signals.length,
      processingTime: Date.now() - startTime,
    });

    return finalResult;
  } catch (error) {
    context.logger?.error("Pass-1 categorization error", error);
    context.analytics?.captureException?.(
      error instanceof Error ? error : new Error("Unknown Pass-1 error")
    );

    return {
      categoryId: undefined,
      confidence: undefined,
      rationale: [
        `Error during Pass-1 categorization: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      signals,
      guardrailsApplied: [],
    };
  }
}

/**
 * Validates Pass-1 context configuration
 */
export function validatePass1Context(context: Pass1Context): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!context.orgId) {
    errors.push("orgId is required");
  }

  if (!context.db) {
    errors.push("db client is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a default Pass-1 context with minimal configuration
 */
export function createDefaultPass1Context(
  orgId: string,
  db: any,
  options: Partial<Pass1Context> = {}
): Pass1Context {
  return {
    orgId: orgId as any, // Cast to branded type
    db,
    analytics: options.analytics,
    logger: options.logger || {
      info: () => {},
      error: () => {},
      debug: () => {},
    },
    caches: options.caches || {
      vendorRules: new Map(),
      vendorEmbeddings: new Map(),
    },
    config: {
      guardrails: DEFAULT_GUARDRAIL_CONFIG,
      enableEmbeddings: false,
      debugMode: false,
      ...options.config,
    },
  };
}
