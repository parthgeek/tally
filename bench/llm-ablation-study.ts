/**
 * LLM Prompt Ablation Study
 *
 * Tests different prompt strategies to optimize accuracy and cost:
 * 1. With vs without Pass1 context
 * 2. System vs user prompt variations
 * 3. Different temperature settings
 * 4. Cost vs accuracy trade-offs
 *
 * Usage:
 *   tsx bench/llm-ablation-study.ts --dataset bench/labeled-dataset.json
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { categorize } from "../packages/categorizer/src/index.js";
import type { CategorizeResult } from "../packages/categorizer/src/index.js";

interface LabeledTransaction {
  id: string;
  description: string;
  merchantName: string | null;
  amountCents: number;
  mcc: string | null;
  date: string;
  currency: string;
  groundTruthCategoryId: string;
  groundTruthCategoryName: string;
}

interface AblationVariant {
  name: string;
  description: string;
  config: {
    usePass1Context: boolean;
    promptStrategy: "system-heavy" | "user-heavy" | "balanced";
    temperature: number;
  };
}

interface AblationResult {
  variant: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgConfidence: number;
  totalCost: number;
  avgCostPerTransaction: number;
  avgLatencyMs: number;
  llmInvocations: number;
  correctPredictions: number;
  totalPredictions: number;
  confusionMatrix: Record<string, Record<string, number>>;
}

const ABLATION_VARIANTS: AblationVariant[] = [
  {
    name: "baseline",
    description: "Current production config (with Pass1, balanced prompt, temp=0.2)",
    config: {
      usePass1Context: true,
      promptStrategy: "balanced",
      temperature: 0.2,
    },
  },
  {
    name: "no-pass1",
    description: "LLM only (no Pass1 context)",
    config: {
      usePass1Context: false,
      promptStrategy: "balanced",
      temperature: 0.2,
    },
  },
  {
    name: "system-heavy",
    description: "System prompt with detailed instructions",
    config: {
      usePass1Context: true,
      promptStrategy: "system-heavy",
      temperature: 0.2,
    },
  },
  {
    name: "user-heavy",
    description: "User prompt with context and examples",
    config: {
      usePass1Context: true,
      promptStrategy: "user-heavy",
      temperature: 0.2,
    },
  },
  {
    name: "temp-0",
    description: "Zero temperature (deterministic)",
    config: {
      usePass1Context: true,
      promptStrategy: "balanced",
      temperature: 0.0,
    },
  },
  {
    name: "temp-0.5",
    description: "Higher temperature (more creative)",
    config: {
      usePass1Context: true,
      promptStrategy: "balanced",
      temperature: 0.5,
    },
  },
  {
    name: "temp-1.0",
    description: "Maximum reasonable temperature",
    config: {
      usePass1Context: true,
      promptStrategy: "balanced",
      temperature: 1.0,
    },
  },
];

async function loadDataset(path: string): Promise<LabeledTransaction[]> {
  const fs = await import("fs/promises");
  const content = await fs.readFile(path, "utf-8");
  const data = JSON.parse(content);

  if (!Array.isArray(data.transactions)) {
    throw new Error('Dataset must have "transactions" array');
  }

  return data.transactions;
}

async function runVariant(
  variant: AblationVariant,
  transactions: LabeledTransaction[],
  orgId: string
): Promise<AblationResult> {
  console.log(`\n🧪 Running variant: ${variant.name}`);
  console.log(`   ${variant.description}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let correctPredictions = 0;
  let totalPredictions = 0;
  let totalConfidence = 0;
  let totalLatency = 0;
  let llmInvocations = 0;
  const confusionMatrix: Record<string, Record<string, number>> = {};

  // Track cost (Gemini 2.5 Flash pricing)
  const COST_PER_1K_INPUT_TOKENS = 0.00001; // Gemini Flash is very cheap
  const COST_PER_1K_OUTPUT_TOKENS = 0.00003;
  const AVG_INPUT_TOKENS = 800; // Estimated for our prompts
  const AVG_OUTPUT_TOKENS = 100; // Estimated

  for (const tx of transactions) {
    const startTime = Date.now();

    try {
      const result = await categorize(
        supabase,
        {
          orgId,
          description: tx.description,
          merchantName: tx.merchantName,
          amountCents: tx.amountCents,
          mcc: tx.mcc,
          date: tx.date,
          currency: tx.currency,
        },
        {
          temperature: variant.config.temperature,
          // Note: promptStrategy not yet implemented, will be added in Phase 3
          // Note: usePass1Context not yet implemented, will be added in Phase 2
        }
      );

      const latency = Date.now() - startTime;
      totalLatency += latency;

      if (result.engine === "llm" || result.engine === "hybrid") {
        llmInvocations++;
      }

      totalPredictions++;

      if (result.categoryId === tx.groundTruthCategoryId) {
        correctPredictions++;
      }

      if (result.confidence !== null) {
        totalConfidence += result.confidence;
      }

      // Update confusion matrix
      const predicted = result.categoryId || "unknown";
      const actual = tx.groundTruthCategoryId;

      if (!confusionMatrix[actual]) {
        confusionMatrix[actual] = {};
      }
      confusionMatrix[actual]![predicted] = (confusionMatrix[actual]![predicted] || 0) + 1;

      // Log progress every 10 transactions
      if (totalPredictions % 10 === 0) {
        process.stdout.write(
          `\r   Progress: ${totalPredictions}/${transactions.length} transactions`
        );
      }
    } catch (error) {
      console.error(`\nError categorizing transaction ${tx.id}:`, error);
    }
  }

  console.log(`\r   Progress: ${totalPredictions}/${transactions.length} transactions - Complete!`);

  const accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
  const avgConfidence = totalPredictions > 0 ? totalConfidence / totalPredictions : 0;
  const avgLatencyMs = totalPredictions > 0 ? totalLatency / totalPredictions : 0;

  // Calculate precision, recall, F1 (macro-averaged across categories)
  const categories = new Set([
    ...Object.keys(confusionMatrix),
    ...Object.values(confusionMatrix).flatMap((row) => Object.keys(row)),
  ]);

  let totalPrecision = 0;
  let totalRecall = 0;
  let categoriesWithPredictions = 0;

  for (const category of categories) {
    const truePositives = confusionMatrix[category]?.[category] || 0;

    // Calculate precision for this category
    let predictedAsThisCategory = 0;
    for (const row of Object.values(confusionMatrix)) {
      predictedAsThisCategory += row[category] || 0;
    }
    const precision = predictedAsThisCategory > 0 ? truePositives / predictedAsThisCategory : 0;

    // Calculate recall for this category
    const actualThisCategory = Object.values(confusionMatrix[category] || {}).reduce(
      (a, b) => a + b,
      0
    );
    const recall = actualThisCategory > 0 ? truePositives / actualThisCategory : 0;

    if (predictedAsThisCategory > 0 || actualThisCategory > 0) {
      totalPrecision += precision;
      totalRecall += recall;
      categoriesWithPredictions++;
    }
  }

  const precision = categoriesWithPredictions > 0 ? totalPrecision / categoriesWithPredictions : 0;
  const recall = categoriesWithPredictions > 0 ? totalRecall / categoriesWithPredictions : 0;
  const f1Score = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

  // Estimate cost
  const totalCost =
    llmInvocations *
    ((AVG_INPUT_TOKENS / 1000) * COST_PER_1K_INPUT_TOKENS +
      (AVG_OUTPUT_TOKENS / 1000) * COST_PER_1K_OUTPUT_TOKENS);
  const avgCostPerTransaction = totalPredictions > 0 ? totalCost / totalPredictions : 0;

  return {
    variant: variant.name,
    accuracy,
    precision,
    recall,
    f1Score,
    avgConfidence,
    totalCost,
    avgCostPerTransaction,
    avgLatencyMs,
    llmInvocations,
    correctPredictions,
    totalPredictions,
    confusionMatrix,
  };
}

function printResults(results: AblationResult[]): void {
  console.log("\n\n" + "=".repeat(100));
  console.log("📊 ABLATION STUDY RESULTS");
  console.log("=".repeat(100));

  // Sort by F1 score descending
  const sortedResults = [...results].sort((a, b) => b.f1Score - a.f1Score);

  console.log(
    "\n| Variant | Accuracy | Precision | Recall | F1 Score | Avg Conf | Cost/Tx | Latency | LLM % |"
  );
  console.log(
    "|---------|----------|-----------|--------|----------|----------|---------|---------|-------|"
  );

  for (const result of sortedResults) {
    const llmPercentage =
      result.totalPredictions > 0
        ? ((result.llmInvocations / result.totalPredictions) * 100).toFixed(1)
        : "0.0";

    console.log(
      `| ${result.variant.padEnd(15)} ` +
        `| ${(result.accuracy * 100).toFixed(1)}% ` +
        `| ${(result.precision * 100).toFixed(1)}% ` +
        `| ${(result.recall * 100).toFixed(1)}% ` +
        `| ${(result.f1Score * 100).toFixed(1)}% ` +
        `| ${(result.avgConfidence * 100).toFixed(1)}% ` +
        `| $${result.avgCostPerTransaction.toFixed(4)} ` +
        `| ${result.avgLatencyMs.toFixed(0)}ms ` +
        `| ${llmPercentage}% |`
    );
  }

  console.log("\n" + "=".repeat(100));

  // Find best performers
  const bestAccuracy = sortedResults[0];
  const bestF1 = sortedResults[0];
  const lowestCost = [...results].sort(
    (a, b) => a.avgCostPerTransaction - b.avgCostPerTransaction
  )[0];
  const fastestLatency = [...results].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];

  console.log("\n🏆 BEST PERFORMERS:");
  console.log(
    `   Best Accuracy: ${bestAccuracy?.variant} (${(bestAccuracy?.accuracy * 100).toFixed(1)}%)`
  );
  console.log(`   Best F1 Score: ${bestF1?.variant} (${(bestF1?.f1Score * 100).toFixed(1)}%)`);
  console.log(
    `   Lowest Cost: ${lowestCost?.variant} ($${lowestCost?.avgCostPerTransaction.toFixed(4)}/tx)`
  );
  console.log(
    `   Fastest: ${fastestLatency?.variant} (${fastestLatency?.avgLatencyMs.toFixed(0)}ms)`
  );

  console.log("\n💡 RECOMMENDATIONS:");

  const baseline = results.find((r) => r.variant === "baseline");
  if (baseline) {
    console.log(
      `   Baseline Performance: ${(baseline.accuracy * 100).toFixed(1)}% accuracy, $${baseline.avgCostPerTransaction.toFixed(4)}/tx`
    );

    for (const result of results) {
      if (result.variant === "baseline") continue;

      const accuracyDelta = (result.accuracy - baseline.accuracy) * 100;
      const costDelta =
        ((result.avgCostPerTransaction - baseline.avgCostPerTransaction) /
          baseline.avgCostPerTransaction) *
        100;

      if (accuracyDelta >= 0 && costDelta < -10) {
        console.log(
          `   ✅ ${result.variant}: ${accuracyDelta >= 0 ? "+" : ""}${accuracyDelta.toFixed(1)}% accuracy, ${costDelta.toFixed(1)}% cost savings`
        );
      }
    }
  }

  console.log("\n" + "=".repeat(100));
}

async function main() {
  const args = process.argv.slice(2);
  const datasetIndex = args.indexOf("--dataset");
  const datasetPath = datasetIndex >= 0 ? args[datasetIndex + 1] : "bench/labeled-dataset.json";

  const orgIdIndex = args.indexOf("--org-id");
  const orgId = orgIdIndex >= 0 ? args[orgIdIndex + 1]! : process.env.TEST_ORG_ID!;

  if (!orgId) {
    console.error("❌ Error: --org-id required or set TEST_ORG_ID environment variable");
    process.exit(1);
  }

  console.log("🚀 LLM Prompt Ablation Study");
  console.log(`   Dataset: ${datasetPath}`);
  console.log(`   Organization: ${orgId}`);
  console.log(`   Variants: ${ABLATION_VARIANTS.length}`);

  // Load dataset
  console.log("\n📂 Loading dataset...");
  const transactions = await loadDataset(datasetPath);
  console.log(`   Loaded ${transactions.length} labeled transactions`);

  // Run all temperature variants
  const results: AblationResult[] = [];

  console.log("\n🔥 Running temperature ablation study");
  console.log("Testing temperatures: 0.0, 0.2 (baseline), 0.5, 1.0");
  console.log("Note: Prompt strategy variants will be added in Phase 3\n");

  // Run temperature variants only for now
  const temperatureVariants = ABLATION_VARIANTS.filter(
    (v) => v.name.startsWith("temp-") || v.name === "baseline"
  );

  for (const variant of temperatureVariants) {
    const result = await runVariant(variant, transactions, orgId);
    results.push(result);
  }

  // Print results
  printResults(results);

  // Export detailed results to JSON
  const outputPath = "bench/ablation-results.json";
  const fs = await import("fs/promises");
  await fs.writeFile(
    outputPath,
    JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2)
  );
  console.log(`\n💾 Detailed results exported to: ${outputPath}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runVariant, printResults, ABLATION_VARIANTS };
export type { AblationVariant, AblationResult, LabeledTransaction };
