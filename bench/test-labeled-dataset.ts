#!/usr/bin/env tsx

/**
 * Labeled Dataset Test
 * 
 * Tests universal categorizer against 100 labeled transactions to validate:
 * - Category accuracy (target: 85%+)
 * - Confidence calibration
 * - Attribute extraction
 * - Performance/latency
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { categorizeWithUniversalLLM } from '../packages/categorizer/src/pass2_llm.js';
import { GeminiClient } from '../packages/categorizer/src/gemini-client.js';
import type { NormalizedTransaction } from '../packages/types/src/index.js';

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

interface LabeledDataset {
  version: string;
  created: string;
  description: string;
  totalTransactions: number;
  transactions: LabeledTransaction[];
}

interface TestResult {
  transactionId: string;
  description: string;
  groundTruthCategory: string;
  predictedCategory: string;
  correct: boolean;
  confidence: number;
  attributes: Record<string, any>;
  latency: number;
  error?: string;
}

async function testLabeledDataset() {
  console.log('🧪 Universal Taxonomy - Labeled Dataset Test\n');
  console.log('═'.repeat(60));
  
  // Load labeled dataset
  const datasetPath = join(process.cwd(), 'bench', 'labeled-dataset.json');
  const dataset: LabeledDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  
  console.log(`\n📊 Dataset Info:`);
  console.log(`   Version: ${dataset.version}`);
  console.log(`   Created: ${dataset.created}`);
  console.log(`   Total Transactions: ${dataset.totalTransactions}`);
  console.log(`   Description: ${dataset.description}`);
  
  // Initialize Gemini client
  const geminiClient = new GeminiClient({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash-lite',
    temperature: 1.0,
  });
  
  console.log(`\n🤖 LLM Configuration:`);
  console.log(`   Model: gemini-2.5-flash-lite`);
  console.log(`   Temperature: 1.0`);
  
  // Run tests
  const results: TestResult[] = [];
  let totalLatency = 0;
  
  console.log(`\n🚀 Running categorization on ${dataset.totalTransactions} transactions...\n`);
  
  for (let i = 0; i < dataset.transactions.length; i++) {
    const tx = dataset.transactions[i];
    const progress = `[${i + 1}/${dataset.totalTransactions}]`;
    
    process.stdout.write(`${progress} Testing ${tx.id}: ${tx.description.substring(0, 40)}...`);
    
    const startTime = Date.now();
    
    try {
      // Convert to NormalizedTransaction format
      const normalizedTx: NormalizedTransaction = {
        id: tx.id,
        orgId: 'test-org' as any,
        date: tx.date,
        amountCents: tx.amountCents.toString(),
        currency: tx.currency,
        description: tx.description,
        merchantName: tx.merchantName,
        mcc: tx.mcc,
        categoryId: null as any,
        confidence: null,
        reviewed: false,
        needsReview: false,
        source: 'test',
        raw: {},
      };
      
      // Categorize with universal LLM
      const result = await categorizeWithUniversalLLM(
        normalizedTx,
        {
          industry: 'ecommerce',
          orgId: 'test-org',
          config: {
            model: 'gemini-2.5-flash-lite',
            temperature: 1.0,
          },
        },
        geminiClient
      );
      
      const latency = Date.now() - startTime;
      totalLatency += latency;
      
      const correct = result.categoryId === tx.groundTruthCategoryId;
      
      results.push({
        transactionId: tx.id,
        description: tx.description,
        groundTruthCategory: tx.groundTruthCategoryName,
        predictedCategory: result.categoryId,
        correct,
        confidence: result.confidence,
        attributes: result.attributes || {},
        latency,
      });
      
      const status = correct ? '✓' : '✗';
      const confidenceStr = (result.confidence * 100).toFixed(0) + '%';
      const attrCount = Object.keys(result.attributes || {}).length;
      
      console.log(` ${status} [${latency}ms, conf: ${confidenceStr}, attrs: ${attrCount}]`);
      
    } catch (error) {
      const latency = Date.now() - startTime;
      totalLatency += latency;
      
      results.push({
        transactionId: tx.id,
        description: tx.description,
        groundTruthCategory: tx.groundTruthCategoryName,
        predictedCategory: 'ERROR',
        correct: false,
        confidence: 0,
        attributes: {},
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      console.log(` ✗ ERROR [${latency}ms]`);
    }
    
    // Add small delay to avoid rate limiting
    if ((i + 1) % 10 === 0 && i + 1 < dataset.totalTransactions) {
      console.log(`\n   💤 Pausing for 2s to avoid rate limiting...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Calculate statistics
  const correctPredictions = results.filter(r => r.correct).length;
  const errorCount = results.filter(r => r.error).length;
  const accuracy = (correctPredictions / results.length) * 100;
  const avgLatency = totalLatency / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const totalAttributes = results.reduce((sum, r) => sum + Object.keys(r.attributes).length, 0);
  const avgAttributes = totalAttributes / results.length;
  const transactionsWithAttributes = results.filter(r => Object.keys(r.attributes).length > 0).length;
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Results Summary\n');
  
  console.log(`✅ Accuracy: ${correctPredictions}/${results.length} (${accuracy.toFixed(2)}%)`);
  
  if (accuracy >= 85) {
    console.log('   🎯 PASSED: Accuracy meets 85% target!');
  } else {
    console.log(`   ⚠️  WARNING: Accuracy below 85% target (gap: ${(85 - accuracy).toFixed(2)}%)`);
  }
  
  console.log(`\n⚡ Performance:`);
  console.log(`   Average Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`   Total Time: ${(totalLatency / 1000).toFixed(1)}s`);
  
  console.log(`\n🎯 Confidence:`);
  console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  
  console.log(`\n🏷️  Attributes:`);
  console.log(`   Total Extracted: ${totalAttributes}`);
  console.log(`   Average per Transaction: ${avgAttributes.toFixed(2)}`);
  console.log(`   Transactions with Attributes: ${transactionsWithAttributes}/${results.length} (${(transactionsWithAttributes / results.length * 100).toFixed(1)}%)`);
  
  if (errorCount > 0) {
    console.log(`\n❌ Errors: ${errorCount}`);
  }
  
  // Show incorrect predictions
  const incorrect = results.filter(r => !r.correct && !r.error);
  if (incorrect.length > 0) {
    console.log(`\n❌ Incorrect Predictions (${incorrect.length}):\n`);
    incorrect.slice(0, 10).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.transactionId}: "${r.description}"`);
      console.log(`      Expected: ${r.groundTruthCategory}`);
      console.log(`      Got: ${r.predictedCategory} (confidence: ${(r.confidence * 100).toFixed(0)}%)`);
    });
    
    if (incorrect.length > 10) {
      console.log(`   ... and ${incorrect.length - 10} more`);
    }
  }
  
  // Show errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):\n`);
    errors.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.transactionId}: ${r.error}`);
    });
    
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  
  // Exit with appropriate code
  if (accuracy >= 85 && errorCount === 0) {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  } else if (accuracy >= 85) {
    console.log('\n⚠️  Tests passed but with errors\n');
    process.exit(1);
  } else {
    console.log('\n❌ Tests failed: Accuracy below target\n');
    process.exit(1);
  }
}

// Run the test
testLabeledDataset().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});

