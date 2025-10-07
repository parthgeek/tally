import { getLangfuse } from "@nexus/analytics/server";

/**
 * Track correction outcomes for LLM model evaluation
 * Links user corrections back to original LLM decisions for accuracy scoring
 */
export async function trackCorrectionOutcome(
  txId: string,
  oldCategoryId: string | null,
  newCategoryId: string,
  confidence: number | null,
  source: "pass1" | "llm",
  llmTraceId?: string
) {
  const langfuse = getLangfuse();
  if (!langfuse) {
    console.warn("Langfuse not initialized, skipping correction outcome tracking");
    return;
  }

  try {
    const wasCorrect = oldCategoryId === newCategoryId;
    const accuracyScore = wasCorrect ? 1 : 0;

    // Create or update trace with outcome
    if (llmTraceId && source === "llm") {
      // Link to existing LLM trace for feedback loop
      const trace = langfuse.trace({ id: llmTraceId });
      await trace.score({
        name: "categorization_accuracy",
        value: accuracyScore,
        comment: wasCorrect
          ? "User confirmed AI categorization was correct"
          : "User corrected AI categorization",
        metadata: {
          tx_id: txId,
          confidence,
          source,
          old_category: oldCategoryId,
          new_category: newCategoryId,
          correction_type: wasCorrect ? "confirmation" : "correction",
        },
      });

      // Also add a generation event to the trace for completeness
      await trace.generation({
        name: "categorization_feedback",
        model: "user-correction",
        input: {
          transaction_id: txId,
          original_category: oldCategoryId,
          original_confidence: confidence,
        },
        output: {
          corrected_category: newCategoryId,
          was_correct: wasCorrect,
        },
        metadata: {
          feedback_type: "human_correction",
          correction_timestamp: new Date().toISOString(),
        },
      });
    } else {
      // Create new trace for pass1 (rules-based) corrections
      await langfuse.trace({
        name: "categorization_outcome",
        input: {
          transaction_id: txId,
          source,
          original_category: oldCategoryId,
          corrected_category: newCategoryId,
        },
        output: {
          accuracy_score: accuracyScore,
          confidence,
        },
        metadata: {
          tx_id: txId,
          source,
          accuracy: accuracyScore,
          confidence,
          correction_type: wasCorrect ? "confirmation" : "correction",
          timestamp: new Date().toISOString(),
        },
        tags: ["correction-tracking", source],
      });
    }

    console.log(
      `Tracked correction outcome for tx ${txId}: ${wasCorrect ? "correct" : "corrected"}`
    );
  } catch (error) {
    console.error("Failed to track correction outcome:", error);
  }
}

/**
 * Track bulk correction outcomes for batch analysis
 */
export async function trackBulkCorrectionOutcome(
  corrections: Array<{
    txId: string;
    oldCategoryId: string | null;
    newCategoryId: string;
    confidence: number | null;
    source: "pass1" | "llm";
    llmTraceId?: string;
  }>,
  ruleSignature?: string,
  ruleWeight?: number
) {
  const langfuse = getLangfuse();
  if (!langfuse) {
    console.warn("Langfuse not initialized, skipping bulk correction outcome tracking");
    return;
  }

  try {
    const totalCorrections = corrections.length;
    const accurateCount = corrections.filter((c) => c.oldCategoryId === c.newCategoryId).length;
    const correctionCount = totalCorrections - accurateCount;
    const averageConfidence =
      corrections.reduce((sum, c) => sum + (c.confidence || 0), 0) / totalCorrections;

    // Create a trace for the bulk operation
    const trace = await langfuse.trace({
      name: "bulk_categorization_outcome",
      input: {
        transaction_count: totalCorrections,
        corrections: corrections.map((c) => ({
          tx_id: c.txId,
          old_category: c.oldCategoryId,
          new_category: c.newCategoryId,
          source: c.source,
        })),
      },
      output: {
        total_transactions: totalCorrections,
        accurate_predictions: accurateCount,
        corrections_needed: correctionCount,
        overall_accuracy: accurateCount / totalCorrections,
        average_confidence: averageConfidence,
        rule_created: !!ruleSignature,
      },
      metadata: {
        rule_signature: ruleSignature,
        rule_weight: ruleWeight,
        batch_timestamp: new Date().toISOString(),
      },
      tags: ["bulk-correction", "batch-analysis"],
    });

    // Score the overall batch performance
    await trace.score({
      name: "batch_accuracy",
      value: accurateCount / totalCorrections,
      comment: `Bulk correction: ${accurateCount}/${totalCorrections} accurate, ${correctionCount} corrections needed`,
    });

    // Individual correction tracking for each transaction
    for (const correction of corrections) {
      await trackCorrectionOutcome(
        correction.txId,
        correction.oldCategoryId,
        correction.newCategoryId,
        correction.confidence,
        correction.source,
        correction.llmTraceId
      );
    }

    console.log(`Tracked bulk correction outcome: ${accurateCount}/${totalCorrections} accurate`);
  } catch (error) {
    console.error("Failed to track bulk correction outcome:", error);
  }
}
