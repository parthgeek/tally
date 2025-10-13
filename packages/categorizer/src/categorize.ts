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
import type { NormalizedTransaction, CategorizationResult } from "@nexus/types";
import { pass1Categorize } from "./pass1.js";
import { scoreWithLLM } from "./pass2_llm.js";

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
}

const DEFAULT_THRESHOLD = 0.95;

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
    merchantName: input.merchantName,
    mcc: input.mcc,
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

  // Run Pass 2 (LLM)
  const pass2Result = await scoreWithLLM(tx, {
    orgId: input.orgId as any,
    db: supabase,
    pass1Signals: pass1Result.rationale,
    config: {
      temperature: options?.temperature,
    },
  } as any);

  return {
    categoryId: pass2Result.categoryId,
    confidence: pass2Result.confidence,
    engine: pass1Result.categoryId ? "hybrid" : "llm",
    rationale: [...(pass1Result.rationale || []), ...(pass2Result.rationale || [])],
  };
}
