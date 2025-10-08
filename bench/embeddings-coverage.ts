#!/usr/bin/env tsx
/**
 * Embeddings Coverage Benchmark
 *
 * Measures the improvement in Pass1 categorization coverage when embeddings are enabled.
 * Compares categorization success rate with and without embeddings on a test set.
 *
 * Usage:
 *   tsx bench/embeddings-coverage.ts --org-id <uuid> [--test-size 100] [--output json|markdown]
 */

import { createClient } from "@supabase/supabase-js";
import { pass1Categorize, type Pass1Context } from "../packages/categorizer/src/engine/pass1.js";
import type { NormalizedTransaction, OrgId } from "../packages/types/src/index.js";

interface BenchmarkConfig {
  orgId: OrgId;
  testSize: number;
  outputFormat: "json" | "markdown";
}

interface BenchmarkResult {
  testSize: number;
  coverageWithoutEmbeddings: number;
  coverageWithEmbeddings: number;
  coverageBoost: number;
  coverageBoostPercentage: number;
  avgConfidenceWithout: number;
  avgConfidenceWith: number;
  confidenceImprovement: number;
  executionTime: {
    withoutEmbeddings: number;
    withEmbeddings: number;
  };
  sampleResults: Array<{
    merchantName: string;
    categorizedWithout: boolean;
    categorizedWith: boolean;
    confidenceWithout: number | undefined;
    confidenceWith: number | undefined;
  }>;
}

async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const db = createClient(supabaseUrl, supabaseKey);

  console.log(`\n📊 Embeddings Coverage Benchmark`);
  console.log(`================================\n`);
  console.log(`Organization ID: ${config.orgId}`);
  console.log(`Test Set Size: ${config.testSize}`);
  console.log(`\nFetching test transactions...\n`);

  // Fetch test transactions (preferably uncategorized or low-confidence ones)
  const { data: transactions, error } = await db
    .from("transactions")
    .select("*")
    .eq("org_id", config.orgId)
    .order("created_at", { ascending: false })
    .limit(config.testSize);

  if (error || !transactions) {
    throw new Error(`Failed to fetch transactions: ${error?.message}`);
  }

  console.log(`✅ Fetched ${transactions.length} test transactions\n`);

  const testTransactions: NormalizedTransaction[] = transactions.map((tx) => ({
    id: tx.id,
    orgId: tx.org_id as OrgId,
    merchantName: tx.merchant_name,
    description: tx.description || "",
    amountCents: tx.amount_cents,
    date: new Date(tx.date),
    mcc: tx.mcc,
    source: tx.source,
    externalId: tx.external_id,
    accountId: tx.account_id,
    createdAt: new Date(tx.created_at),
    updatedAt: new Date(tx.updated_at),
  }));

  // Run benchmark without embeddings
  console.log("🔄 Running categorization WITHOUT embeddings...\n");
  const startWithout = Date.now();
  const resultsWithout = await Promise.all(
    testTransactions.map(async (tx) => {
      const context: Pass1Context = {
        orgId: config.orgId,
        db,
        config: {
          enableEmbeddings: false,
        },
      };

      try {
        const result = await pass1Categorize(tx, context);
        return {
          merchantName: tx.merchantName,
          categorized: !!result.categoryId,
          confidence: result.confidence,
        };
      } catch (error) {
        console.error(`Error categorizing ${tx.merchantName}:`, error);
        return {
          merchantName: tx.merchantName,
          categorized: false,
          confidence: undefined,
        };
      }
    })
  );
  const timeWithout = Date.now() - startWithout;

  const coverageWithout = resultsWithout.filter((r) => r.categorized).length;
  const avgConfidenceWithout =
    resultsWithout.reduce((sum, r) => sum + (r.confidence || 0), 0) /
    resultsWithout.filter((r) => r.confidence).length;

  console.log(`✅ Without embeddings: ${coverageWithout}/${testTransactions.length} categorized`);
  console.log(`   Average confidence: ${avgConfidenceWithout.toFixed(3)}`);
  console.log(`   Time: ${timeWithout}ms\n`);

  // Run benchmark with embeddings
  console.log("🔄 Running categorization WITH embeddings...\n");
  const startWith = Date.now();
  const resultsWith = await Promise.all(
    testTransactions.map(async (tx) => {
      const context: Pass1Context = {
        orgId: config.orgId,
        db,
        config: {
          enableEmbeddings: true,
          debugMode: false,
        },
        caches: {
          vendorRules: new Map(),
          vendorEmbeddings: new Map(),
        },
      };

      try {
        const result = await pass1Categorize(tx, context);
        return {
          merchantName: tx.merchantName,
          categorized: !!result.categoryId,
          confidence: result.confidence,
        };
      } catch (error) {
        console.error(`Error categorizing ${tx.merchantName}:`, error);
        return {
          merchantName: tx.merchantName,
          categorized: false,
          confidence: undefined,
        };
      }
    })
  );
  const timeWith = Date.now() - startWith;

  const coverageWith = resultsWith.filter((r) => r.categorized).length;
  const avgConfidenceWith =
    resultsWith.reduce((sum, r) => sum + (r.confidence || 0), 0) /
    resultsWith.filter((r) => r.confidence).length;

  console.log(`✅ With embeddings: ${coverageWith}/${testTransactions.length} categorized`);
  console.log(`   Average confidence: ${avgConfidenceWith.toFixed(3)}`);
  console.log(`   Time: ${timeWith}ms\n`);

  // Calculate improvements
  const coverageBoost = coverageWith - coverageWithout;
  const coverageBoostPercentage =
    ((coverageWith - coverageWithout) / testTransactions.length) * 100;
  const confidenceImprovement = avgConfidenceWith - avgConfidenceWithout;

  // Create sample results for analysis
  const sampleResults = testTransactions.slice(0, 10).map((tx, i) => ({
    merchantName: tx.merchantName,
    categorizedWithout: resultsWithout[i]?.categorized || false,
    categorizedWith: resultsWith[i]?.categorized || false,
    confidenceWithout: resultsWithout[i]?.confidence,
    confidenceWith: resultsWith[i]?.confidence,
  }));

  return {
    testSize: testTransactions.length,
    coverageWithoutEmbeddings: coverageWithout,
    coverageWithEmbeddings: coverageWith,
    coverageBoost,
    coverageBoostPercentage,
    avgConfidenceWithout,
    avgConfidenceWith,
    confidenceImprovement,
    executionTime: {
      withoutEmbeddings: timeWithout,
      withEmbeddings: timeWith,
    },
    sampleResults,
  };
}

function formatMarkdown(result: BenchmarkResult): string {
  return `
# Embeddings Coverage Benchmark Results

## Summary

- **Test Set Size**: ${result.testSize} transactions
- **Coverage Without Embeddings**: ${result.coverageWithoutEmbeddings}/${result.testSize} (${((result.coverageWithoutEmbeddings / result.testSize) * 100).toFixed(1)}%)
- **Coverage With Embeddings**: ${result.coverageWithEmbeddings}/${result.testSize} (${((result.coverageWithEmbeddings / result.testSize) * 100).toFixed(1)}%)
- **Coverage Boost**: +${result.coverageBoost} transactions (+${result.coverageBoostPercentage.toFixed(1)}%)

## Confidence Metrics

- **Average Confidence Without Embeddings**: ${result.avgConfidenceWithout.toFixed(3)}
- **Average Confidence With Embeddings**: ${result.avgConfidenceWith.toFixed(3)}
- **Confidence Improvement**: ${result.confidenceImprovement >= 0 ? "+" : ""}${result.confidenceImprovement.toFixed(3)}

## Performance

- **Time Without Embeddings**: ${result.executionTime.withoutEmbeddings}ms
- **Time With Embeddings**: ${result.executionTime.withEmbeddings}ms
- **Overhead**: +${result.executionTime.withEmbeddings - result.executionTime.withoutEmbeddings}ms

## Sample Results (First 10 Transactions)

| Merchant Name | Without Embeddings | With Embeddings | Confidence Δ |
|---------------|-------------------|-----------------|--------------|
${result.sampleResults
  .map((s) => {
    const withoutStatus = s.categorizedWithout ? "✅" : "❌";
    const withStatus = s.categorizedWith ? "✅" : "❌";
    const confidenceDelta = s.confidenceWith && s.confidenceWithout
      ? (s.confidenceWith - s.confidenceWithout).toFixed(3)
      : "N/A";
    return `| ${s.merchantName} | ${withoutStatus} ${s.confidenceWithout?.toFixed(3) || "N/A"} | ${withStatus} ${s.confidenceWith?.toFixed(3) || "N/A"} | ${confidenceDelta} |`;
  })
  .join("\n")}

## Exit Criteria Check

**Sprint 2 Target**: Embeddings provide >10% boost to Pass1 coverage

**Result**: ${result.coverageBoostPercentage >= 10 ? "✅ PASSED" : "❌ FAILED"} (${result.coverageBoostPercentage.toFixed(1)}% boost)
`;
}

// CLI argument parsing
function parseArgs(): BenchmarkConfig {
  const args = process.argv.slice(2);
  const config: Partial<BenchmarkConfig> = {
    testSize: 100,
    outputFormat: "markdown",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org-id" && args[i + 1]) {
      config.orgId = args[i + 1] as OrgId;
      i++;
    } else if (args[i] === "--test-size" && args[i + 1]) {
      config.testSize = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      config.outputFormat = args[i + 1] as "json" | "markdown";
      i++;
    }
  }

  if (!config.orgId) {
    console.error("❌ Error: --org-id is required");
    console.log("\nUsage:");
    console.log(
      "  tsx bench/embeddings-coverage.ts --org-id <uuid> [--test-size 100] [--output json|markdown]"
    );
    process.exit(1);
  }

  return config as BenchmarkConfig;
}

// Main execution
async function main() {
  const config = parseArgs();

  try {
    const result = await runBenchmark(config);

    console.log("\n" + "=".repeat(60));
    console.log("BENCHMARK RESULTS");
    console.log("=".repeat(60) + "\n");

    if (config.outputFormat === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatMarkdown(result));
    }

    // Exit with appropriate code
    const passed = result.coverageBoostPercentage >= 10;
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Benchmark failed:", error);
    process.exit(1);
  }
}

main();
