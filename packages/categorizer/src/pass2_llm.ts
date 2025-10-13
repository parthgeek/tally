import type { NormalizedTransaction, CategorizationContext } from "@nexus/types";
import { GeminiClient } from "./gemini-client.js";
import { buildCategorizationPrompt, isValidCategorySlug, type Pass1Context } from "./prompt.js";
import { mapCategorySlugToId } from "./taxonomy.js";
import { calibrateLLMConfidence } from "./engine/scorer.js";

interface LLMResponse {
  category_slug: string;
  confidence: number;
  rationale: string;
}

/**
 * Parses and validates LLM response using centralized taxonomy
 */
function parseLLMResponse(responseText: string): LLMResponse {
  try {
    // First, try to parse as direct JSON
    let cleanText = responseText.trim();

    // If the response is wrapped in markdown code blocks, extract the JSON
    const jsonMatch = cleanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      cleanText = jsonMatch[1].trim();
    } else {
      // Try to extract JSON object from the text
      const objectMatch = cleanText.match(/\{[\s\S]*\}/);
      if (objectMatch && objectMatch[0]) {
        cleanText = objectMatch[0].trim();
      }
    }

    const response = JSON.parse(cleanText);

    // Validate the category slug against our taxonomy
    let categorySlug = response.category_slug || "other_ops";
    if (!isValidCategorySlug(categorySlug)) {
      console.warn(`Invalid category slug from LLM: ${categorySlug}, falling back to other_ops`);
      categorySlug = "other_ops";
    }

    return {
      category_slug: categorySlug,
      confidence: Math.max(0, Math.min(1, response.confidence || 0.5)),
      rationale: response.rationale || "LLM categorization",
    };
  } catch (error) {
    // Fallback for malformed responses
    console.error("Failed to parse LLM response:", responseText, error);
    return {
      category_slug: "other_ops",
      confidence: 0.5,
      rationale: "Failed to parse LLM response",
    };
  }
}

/**
 * Pass-2 LLM scoring for transactions that need additional analysis
 * Only runs if Pass-1 confidence < 0.95
 */
export async function scoreWithLLM(
  tx: NormalizedTransaction,
  ctx: CategorizationContext & {
    db: any;
    analytics?: any;
    logger?: any;
    config?: {
      geminiApiKey?: string;
      model?: string;
      temperature?: number;
    };
  }
): Promise<{ categoryId: string; confidence: number; rationale: string[] }> {
  const rationale: string[] = [];

  try {
    // Initialize Gemini client
    const apiKey = ctx.config?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for LLM categorization");
    }

    const geminiClient = new GeminiClient({
      apiKey,
      model: ctx.config?.model || "gemini-2.5-flash-lite",
      temperature: ctx.config?.temperature,
    });

    // Import Langfuse for tracing (server-side only)
    // Note: This is simplified for initial implementation
    const createGeneration = (options: any) => ({
      end: (result: any) => console.log("Langfuse trace:", options, result),
    });

    // Get prior category name if it exists and database is available
    let priorCategoryName: string | undefined;
    if (tx.categoryId && ctx.db) {
      try {
        const { data: category } = await ctx.db
          .from("categories")
          .select("name")
          .eq("id", tx.categoryId)
          .single();

        priorCategoryName = category?.name;
      } catch (error) {
        // Ignore database errors in lab environment
        console.warn("Could not fetch prior category name:", error);
      }
    }

    // Extract Pass-1 context if provided through the context object
    let pass1Context: Pass1Context | undefined;
    if ("pass1Signals" in ctx && Array.isArray(ctx.pass1Signals)) {
      // Pass-1 signals are provided as formatted strings, parse them
      pass1Context = {
        topSignals: ctx.pass1Signals
          .map((s) => {
            // Format: "type:evidence (confidence: 0.XX)"
            const match = s.match(/^(\w+):(.+?)\s+\(confidence:\s+([\d.]+)\)/);
            if (match) {
              return {
                type: match[1] || "",
                evidence: match[2]?.trim() || "",
                confidence: parseFloat(match[3] || "0"),
              };
            }
            return null;
          })
          .filter((s): s is NonNullable<typeof s> => s !== null),
      };
    }

    // Build the prompt using centralized function with Pass-1 context
    const prompt = buildCategorizationPrompt(
      tx,
      priorCategoryName,
      {},
      "development",
      pass1Context
    );

    // Start Langfuse trace
    const generation = createGeneration({
      name: "transaction-categorization",
      model: geminiClient.getModelName(),
      input: { prompt, transaction_id: tx.id },
      metadata: {
        org_id: ctx.orgId,
        merchant: tx.merchantName,
        amount: tx.amountCents,
        mcc: tx.mcc,
      },
    });

    const startTime = Date.now();

    // Make Gemini API call
    const response = await geminiClient.generateContent(prompt);
    const latency = Date.now() - startTime;

    // Parse the response and map to category ID using centralized functions
    const parsed = parseLLMResponse(response.text);
    const categoryId = mapCategorySlugToId(parsed.category_slug);

    // Calibrate LLM confidence to match observed accuracy
    // Check if Pass1 provided strong supporting signal (confidence >= 0.80)
    const hasStrongPass1Signal =
      pass1Context?.confidence !== undefined && pass1Context.confidence >= 0.8;
    const rawConfidence = parsed.confidence;
    const calibratedConfidence = calibrateLLMConfidence(rawConfidence, hasStrongPass1Signal);

    // Update Langfuse trace
    generation.end({
      output: { ...parsed, calibrated_confidence: calibratedConfidence },
      usage: response.usage,
    });

    rationale.push(`LLM: ${parsed.rationale}`);
    rationale.push(`Model: ${geminiClient.getModelName()} (${latency}ms)`);
    rationale.push(
      `Confidence: raw=${rawConfidence.toFixed(3)}, calibrated=${calibratedConfidence.toFixed(3)}`
    );

    // Log success metrics
    ctx.analytics?.captureEvent?.("categorization_llm_success", {
      org_id: ctx.orgId,
      transaction_id: tx.id,
      model: geminiClient.getModelName(),
      raw_confidence: rawConfidence,
      calibrated_confidence: calibratedConfidence,
      latency,
      tokens: response.usage?.totalTokens,
    });

    return {
      categoryId,
      confidence: calibratedConfidence,
      rationale,
    };
  } catch (error) {
    // Log error to Sentry and analytics
    ctx.logger?.error("LLM scoring error", error);
    ctx.analytics?.captureException?.(error);
    ctx.analytics?.captureEvent?.("categorization_llm_error", {
      org_id: ctx.orgId,
      transaction_id: tx.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Fallback to a default category
    rationale.push("LLM categorization failed, using fallback");

    return {
      categoryId: "550e8400-e29b-41d4-a716-446655440359", // other_ops
      confidence: 0.5,
      rationale,
    };
  }
}
