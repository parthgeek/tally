/**
 * Per-Category Confidence Threshold Optimizer
 *
 * Uses ROC curve analysis to find optimal confidence thresholds for each category.
 * Goal: Maximize F1 score per category while minimizing false positives.
 *
 * Usage:
 *   tsx bench/threshold-optimizer.ts --dataset bench/labeled-dataset.json --org-id <uuid>
 */

import { createClient } from '@supabase/supabase-js';
import { categorize } from '../packages/categorizer/src/index';

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

interface PredictionResult {
  transactionId: string;
  predictedCategoryId: string | null;
  confidence: number | null;
  groundTruthCategoryId: string;
  isCorrect: boolean;
}

interface ROCPoint {
  threshold: number;
  truePositiveRate: number; // Recall
  falsePositiveRate: number;
  precision: number;
  f1Score: number;
}

interface OptimalThreshold {
  categoryId: string;
  categoryName: string;
  currentThreshold: number;
  optimalThreshold: number;
  currentF1: number;
  optimalF1: number;
  improvement: number;
  rocCurve: ROCPoint[];
  support: number; // Number of transactions in this category
}

async function loadDataset(path: string): Promise<LabeledTransaction[]> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(path, 'utf-8');
  const data = JSON.parse(content);

  if (!Array.isArray(data.transactions)) {
    throw new Error('Dataset must have "transactions" array');
  }

  return data.transactions;
}

async function getCategoryNames(orgId: string): Promise<Map<string, string>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('org_id', orgId);

  const map = new Map<string, string>();
  if (categories) {
    for (const cat of categories) {
      map.set(cat.id, cat.name);
    }
  }

  return map;
}

async function collectPredictions(
  transactions: LabeledTransaction[],
  orgId: string,
): Promise<PredictionResult[]> {
  console.log(`\n🔮 Collecting predictions for ${transactions.length} transactions...`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const predictions: PredictionResult[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]!;

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r   Progress: ${i + 1}/${transactions.length}`);
    }

    try {
      const result = await categorize(supabase, {
        orgId,
        description: tx.description,
        merchantName: tx.merchantName,
        amountCents: tx.amountCents,
        mcc: tx.mcc,
        date: tx.date,
        currency: tx.currency,
      });

      predictions.push({
        transactionId: tx.id,
        predictedCategoryId: result.categoryId,
        confidence: result.confidence,
        groundTruthCategoryId: tx.groundTruthCategoryId,
        isCorrect: result.categoryId === tx.groundTruthCategoryId,
      });
    } catch (error) {
      console.error(`\n   Error categorizing ${tx.id}:`, error);
    }
  }

  console.log(`\n   ✅ Collected ${predictions.length} predictions`);
  return predictions;
}

function computeROCCurve(
  predictions: PredictionResult[],
  targetCategoryId: string,
): ROCPoint[] {
  // Filter predictions relevant to this category
  const relevantPredictions = predictions.filter(
    p => p.predictedCategoryId === targetCategoryId || p.groundTruthCategoryId === targetCategoryId
  );

  if (relevantPredictions.length === 0) {
    return [];
  }

  // Sort by confidence descending
  const sorted = [...relevantPredictions].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  // Generate thresholds from 0.0 to 1.0 in steps of 0.05
  const thresholds = Array.from({ length: 21 }, (_, i) => i * 0.05);
  const rocPoints: ROCPoint[] = [];

  for (const threshold of thresholds) {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const pred of sorted) {
      const predictedAsTarget = pred.predictedCategoryId === targetCategoryId &&
                                (pred.confidence || 0) >= threshold;
      const actuallyTarget = pred.groundTruthCategoryId === targetCategoryId;

      if (predictedAsTarget && actuallyTarget) {
        truePositives++;
      } else if (predictedAsTarget && !actuallyTarget) {
        falsePositives++;
      } else if (!predictedAsTarget && !actuallyTarget) {
        trueNegatives++;
      } else {
        falseNegatives++;
      }
    }

    const totalPositives = truePositives + falseNegatives;
    const totalNegatives = falsePositives + trueNegatives;

    const truePositiveRate = totalPositives > 0 ? truePositives / totalPositives : 0;
    const falsePositiveRate = totalNegatives > 0 ? falsePositives / totalNegatives : 0;

    const precision = (truePositives + falsePositives) > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;

    const recall = truePositiveRate;
    const f1Score = (precision + recall) > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    rocPoints.push({
      threshold,
      truePositiveRate,
      falsePositiveRate,
      precision,
      f1Score,
    });
  }

  return rocPoints;
}

function findOptimalThreshold(rocCurve: ROCPoint[]): ROCPoint | null {
  if (rocCurve.length === 0) return null;

  // Find threshold that maximizes F1 score
  return rocCurve.reduce((best, current) =>
    current.f1Score > best.f1Score ? current : best
  );
}

async function optimizeThresholds(
  predictions: PredictionResult[],
  orgId: string,
): Promise<OptimalThreshold[]> {
  console.log('\n📈 Computing ROC curves and optimal thresholds...');

  const categoryNames = await getCategoryNames(orgId);

  // Get unique category IDs
  const categoryIds = new Set<string>();
  for (const pred of predictions) {
    if (pred.groundTruthCategoryId) {
      categoryIds.add(pred.groundTruthCategoryId);
    }
    if (pred.predictedCategoryId) {
      categoryIds.add(pred.predictedCategoryId);
    }
  }

  const results: OptimalThreshold[] = [];

  for (const categoryId of categoryIds) {
    const categoryName = categoryNames.get(categoryId) || categoryId;

    // Count support (number of ground truth instances)
    const support = predictions.filter(p => p.groundTruthCategoryId === categoryId).length;

    if (support === 0) {
      continue; // Skip categories with no ground truth examples
    }

    // Compute ROC curve
    const rocCurve = computeROCCurve(predictions, categoryId);

    if (rocCurve.length === 0) {
      continue;
    }

    // Find optimal threshold
    const optimal = findOptimalThreshold(rocCurve);
    if (!optimal) continue;

    // Find current threshold performance (assuming 0.95 is current default)
    const currentThresholdPoint = rocCurve.find(p => Math.abs(p.threshold - 0.95) < 0.01) || rocCurve[rocCurve.length - 1]!;

    const improvement = optimal.f1Score - currentThresholdPoint.f1Score;

    results.push({
      categoryId,
      categoryName,
      currentThreshold: 0.95,
      optimalThreshold: optimal.threshold,
      currentF1: currentThresholdPoint.f1Score,
      optimalF1: optimal.f1Score,
      improvement,
      rocCurve,
      support,
    });
  }

  // Sort by improvement (most improvement first)
  return results.sort((a, b) => b.improvement - a.improvement);
}

function printResults(results: OptimalThreshold[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('🎯 OPTIMAL THRESHOLD RECOMMENDATIONS');
  console.log('='.repeat(120));

  console.log('\n| Category | Support | Current (0.95) | Optimal | Improvement | Current F1 | Optimal F1 |');
  console.log('|----------|---------|----------------|---------|-------------|------------|------------|');

  for (const result of results.filter(r => r.support >= 5)) { // Only show categories with ≥5 examples
    const improvementPct = (result.improvement * 100).toFixed(1);
    const improvementSign = result.improvement > 0 ? '+' : '';

    console.log(
      `| ${result.categoryName.padEnd(30).substring(0, 30)} ` +
      `| ${result.support.toString().padStart(7)} ` +
      `| ${(result.currentThreshold * 100).toFixed(0)}% ` +
      `| ${(result.optimalThreshold * 100).toFixed(0)}% ` +
      `| ${improvementSign}${improvementPct}% ` +
      `| ${(result.currentF1 * 100).toFixed(1)}% ` +
      `| ${(result.optimalF1 * 100).toFixed(1)}% |`
    );
  }

  console.log('\n' + '='.repeat(120));

  // Summary statistics
  const categoriesWithImprovement = results.filter(r => r.improvement > 0.01 && r.support >= 5);
  const avgImprovement = categoriesWithImprovement.length > 0
    ? categoriesWithImprovement.reduce((sum, r) => sum + r.improvement, 0) / categoriesWithImprovement.length
    : 0;

  console.log('\n📊 SUMMARY:');
  console.log(`   Categories analyzed: ${results.length}`);
  console.log(`   Categories with ≥5 examples: ${results.filter(r => r.support >= 5).length}`);
  console.log(`   Categories with improvement potential: ${categoriesWithImprovement.length}`);
  console.log(`   Average F1 improvement: ${(avgImprovement * 100).toFixed(1)}%`);

  if (categoriesWithImprovement.length > 0) {
    console.log('\n💡 TOP RECOMMENDATIONS:');
    for (const result of categoriesWithImprovement.slice(0, 5)) {
      console.log(`   ${result.categoryName}: Lower threshold to ${(result.optimalThreshold * 100).toFixed(0)}% (${(result.improvement * 100).toFixed(1)}% F1 improvement)`);
    }
  }

  console.log('\n' + '='.repeat(120));
}

async function main() {
  const args = process.argv.slice(2);

  const datasetIndex = args.indexOf('--dataset');
  const datasetPath = datasetIndex >= 0 ? args[datasetIndex + 1] : 'bench/labeled-dataset.json';

  const orgIdIndex = args.indexOf('--org-id');
  const orgId = orgIdIndex >= 0 ? args[orgIdIndex + 1]! : process.env.TEST_ORG_ID!;

  if (!orgId) {
    console.error('❌ Error: --org-id required or set TEST_ORG_ID environment variable');
    process.exit(1);
  }

  console.log('🎯 Per-Category Threshold Optimizer');
  console.log(`   Dataset: ${datasetPath}`);
  console.log(`   Organization: ${orgId}`);

  // Load dataset
  console.log('\n📂 Loading dataset...');
  const transactions = await loadDataset(datasetPath);
  console.log(`   Loaded ${transactions.length} labeled transactions`);

  // Collect predictions
  const predictions = await collectPredictions(transactions, orgId);

  // Optimize thresholds
  const results = await optimizeThresholds(predictions, orgId);

  // Print results
  printResults(results);

  // Export results to JSON
  const outputPath = 'bench/threshold-optimization-results.json';
  const fs = await import('fs/promises');
  await fs.writeFile(outputPath, JSON.stringify({
    results,
    timestamp: new Date().toISOString(),
    totalTransactions: transactions.length,
  }, null, 2));
  console.log(`\n💾 Detailed results exported to: ${outputPath}`);

  // Generate configuration file
  const configPath = 'bench/optimal-thresholds.json';
  const config: Record<string, number> = {};
  for (const result of results.filter(r => r.improvement > 0.01 && r.support >= 5)) {
    config[result.categoryId] = result.optimalThreshold;
  }
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  console.log(`💾 Configuration exported to: ${configPath}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { optimizeThresholds, computeROCCurve, findOptimalThreshold };
export type { OptimalThreshold, ROCPoint, PredictionResult };
