/**
 * Unified categorize function for benchmark tools
 *
 * Provides a simple API for running the full hybrid categorization pipeline:
 * 1. Pass 1 (rules-based)
 * 2. Pass 2 (LLM) if Pass 1 confidence < threshold
 *
 * This is primarily for testing and benchmarking purposes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedTransaction } from "@nexus/types";
import { pass1Categorize } from "./pass1.js";
import { categorizeWithUniversalLLM } from "./pass2_llm.js";
import { getCategoryBySlug } from "./taxonomy.js";

export interface CategorizeInput {
  orgId: string;
  description: string;
  merchantName: string | null;
  amountCents: number;
  mcc: string | null;
  date: string;
  currency: string;
}

export interface CategorizeResult {
  categoryId: string | null;
  confidence: number | null;
  engine: "pass1" | "llm" | "hybrid";
  rationale?: string[];
  needsReview?: boolean;
}

const DEFAULT_THRESHOLD = 0.95;

/**
 * Compute dynamic acceptance threshold based on transaction characteristics
 * Higher thresholds for risky revenue/expense classifications
 */
function computeDynamicThreshold(
  tx: NormalizedTransaction,
  categoryId: string | null,
  description: string,
  merchantName: string | null
): number {
  if (!categoryId) return DEFAULT_THRESHOLD;

  const category = getCategoryBySlug(categoryId as any); // categoryId might be a slug here
  if (!category) return DEFAULT_THRESHOLD;

  const isPositive = parseInt(tx.amountCents) > 0;
  const descLower = description.toLowerCase();
  const merchantLower = (merchantName || '').toLowerCase();

  // Payment processors list
  const processors = ['shopify', 'shop pay', 'stripe', 'paypal', 'square', 'adyen', 'braintree'];
  const isProcessor = processors.some(p => merchantLower.includes(p) || descLower.includes(p));

  // Revenue cues
  const revenueCues = /invoice|inv[\s#-]|po[\s#-]|customer payment|client payment/i;
  const hasRevenueCue = revenueCues.test(descLower);

  // Risky: Positive → OpEx/COGS (require very high confidence)
  if (isPositive && (category.type === 'opex' || category.type === 'cogs')) {
    return 0.99; // Only allow if extremely confident (e.g., clear refund)
  }

  // Risky: Processor merchant proposing revenue (likely should be clearing)
  if (isProcessor && category.type === 'revenue') {
    return 0.99; // Bias toward clearing, require near-certainty for revenue
  }

  // Safe: Strong revenue cues + not a processor + MONEY IN
  if (isPositive && hasRevenueCue && !isProcessor && category.type === 'revenue') {
    return 0.90; // Lower threshold, this is likely correct
  }

  return DEFAULT_THRESHOLD;
}

/**
 * Categorize a transaction using the hybrid Pass1 + Pass2 pipeline
 */
export async function categorize(
  supabase: SupabaseClient,
  input: CategorizeInput,
  options?: {
    threshold?: number;
    skipLLM?: boolean;
    temperature?: number;
  }
): Promise<CategorizeResult> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;

  // Create normalized transaction for pass1
  const tx: NormalizedTransaction = {
    id: "bench-tx" as any,
    orgId: input.orgId as any,
    date: input.date,
    amountCents: input.amountCents.toString(),
    currency: input.currency,
    description: input.description,
    merchantName: input.merchantName ?? undefined,
    mcc: input.mcc ?? undefined,
    categoryId: undefined,
    confidence: undefined,
    reviewed: false,
    needsReview: false,
    source: "bench" as const,
    raw: {},
  };

  // Run Pass 1
  const pass1Result = await pass1Categorize(tx, {
    orgId: input.orgId as any,
    db: supabase,
  });

  // If Pass 1 is confident enough, return it
  if (pass1Result.categoryId && pass1Result.confidence && pass1Result.confidence >= threshold) {
    return {
      categoryId: pass1Result.categoryId,
      confidence: pass1Result.confidence,
      engine: "pass1",
      rationale: pass1Result.rationale,
    };
  }

  // If LLM is disabled, return Pass 1 result as-is
  if (options?.skipLLM) {
    return {
      categoryId: pass1Result.categoryId ?? null,
      confidence: pass1Result.confidence ?? null,
      engine: "pass1",
      rationale: pass1Result.rationale,
    };
  }

  // Run Pass 2 (LLM with Universal Taxonomy)
  const context: any = {
    industry: 'ecommerce', // Default to ecommerce for now
    orgId: input.orgId as any,
  };

  if (pass1Result.categoryId) {
    context.pass1Context = {
      categoryId: pass1Result.categoryId,
      confidence: pass1Result.confidence ?? 0,
      signals: pass1Result.rationale,
    };
  }

  if (options?.temperature !== undefined) {
    context.config = {
      temperature: options.temperature,
    };
  }

  const pass2Result = await categorizeWithUniversalLLM(tx, context);

  // Compute dynamic threshold and check if needs review
  const effectiveThreshold = computeDynamicThreshold(
    tx,
    pass2Result.categoryId,
    input.description,
    input.merchantName
  );

  const needsReview = pass2Result.confidence !== null && pass2Result.confidence < effectiveThreshold;

  return {
    categoryId: pass2Result.categoryId,
    confidence: pass2Result.confidence,
    engine: pass1Result.categoryId ? "hybrid" : "llm",
    rationale: [
      ...(pass1Result.rationale || []),
      ...pass2Result.rationale,
      ...(needsReview ? [`Needs review: confidence ${pass2Result.confidence?.toFixed(3)} < threshold ${effectiveThreshold.toFixed(3)}`] : [])
    ],
    needsReview,
  };
}
