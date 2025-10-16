import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { buildCategorizationPrompt } from '../../../packages/categorizer/src/prompt.ts';
import { mapCategorySlugToId } from '../../../packages/categorizer/src/taxonomy.ts';
import { applyEcommerceGuardrails } from '../../../packages/categorizer/src/guardrails.ts';
import { pass1Categorize } from '../../../packages/categorizer/src/engine/pass1.ts';
import { categorizeWithUniversalLLM, type UniversalCategorizationContext } from '../../../packages/categorizer/src/index.ts';
import { GeminiClient } from '../../../packages/categorizer/src/gemini-client.ts';
import type { NormalizedTransaction } from '../../../packages/types/src/index.ts';
import { CategorizerFeatureFlag, type FeatureFlagConfig } from '../../../packages/categorizer/src/feature-flags.ts';

interface CategorizationResult {
  categoryId?: string;
  confidence?: number;
  rationale: string[];
  attributes?: Record<string, any>;
}

// Rate limiting constants
const RATE_LIMIT = {
  ORG_CONCURRENCY: 2, // Max concurrent transactions per org
  GLOBAL_CONCURRENCY: 5, // Max global concurrent operations
  BATCH_SIZE: 10, // Transactions to process per batch
};

// Simple in-memory rate limiting
const orgProcessing = new Map<string, number>();
let globalProcessing = 0;

// Environment detection - defaults to production for safety
const ENVIRONMENT = (Deno.env.get('ENVIRONMENT') || 'production') as 'development' | 'staging' | 'production';

// Feature flag configuration (can be extended to fetch from database per org)
const getFeatureFlagConfig = (): FeatureFlagConfig => {
  return {
    // Use environment defaults from the feature-flags module
    // This ensures consistency with the centralized taxonomy logic
  };
};

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse request body to get optional org_id parameter and maxBatches
    let requestOrgId: string | null = null;
    let maxBatches: number = 1; // Default: one batch (backwards compatible)
    try {
      const body = await req.json();
      requestOrgId = body.orgId || null;
      maxBatches = body.maxBatches || 1;
      
      // Validate and cap maxBatches to prevent timeouts
      if (maxBatches < 1 || maxBatches > 20) {
        console.warn(`Invalid maxBatches: ${body.maxBatches}, capping to valid range`);
        maxBatches = Math.max(1, Math.min(20, maxBatches));
      }
      
      console.log(`Processing with maxBatches=${maxBatches}${requestOrgId ? ` for org ${requestOrgId}` : ''}`);
    } catch {
      // No body or invalid JSON - process all orgs with single batch
    }

    // Track overall results across all batches
    const allResults: any[] = [];
    let totalProcessed = 0;
    let batchCount = 0;

    // Loop for multiple batches
    while (batchCount < maxBatches) {
      // Get transactions that need categorization for this batch
      let query = supabase
        .from('transactions')
        .select('id, org_id, merchant_name, mcc, description, amount_cents, date, source, reviewed, raw, category_id, needs_review, created_at')
        .is('category_id', null)  // Only process transactions with no category assigned
        .order('created_at', { ascending: true })
        .limit(RATE_LIMIT.BATCH_SIZE);

      if (requestOrgId) {
        query = query.eq('org_id', requestOrgId);
      }

      const { data: transactions, error } = await query;

      if (error || !transactions) {
        throw new Error(`Failed to fetch transactions: ${error?.message}`);
      }

      // No more transactions - we're done
      if (transactions.length === 0) {
        console.log(`Batch ${batchCount + 1}: No more transactions to process`);
        break;
      }

      console.log(`Batch ${batchCount + 1}/${maxBatches}: Processing ${transactions.length} transactions`);

      // Process this batch (existing logic)
      const results: any[] = [];
      const orgGroups = new Map<string, typeof transactions>();

      // Group transactions by organization for rate limiting
      for (const tx of transactions) {
        if (!orgGroups.has(tx.org_id)) {
          orgGroups.set(tx.org_id, []);
        }
        orgGroups.get(tx.org_id)!.push(tx);
      }

      // Process each organization's transactions
      for (const [orgId, orgTransactions] of orgGroups) {
        // Check rate limits
        const currentOrgProcessing = orgProcessing.get(orgId) || 0;
        if (currentOrgProcessing >= RATE_LIMIT.ORG_CONCURRENCY) {
          console.log(`Rate limit reached for org ${orgId}, skipping`);
          continue;
        }
        
        if (globalProcessing >= RATE_LIMIT.GLOBAL_CONCURRENCY) {
          console.log('Global rate limit reached, stopping processing');
          break;
        }

        // Update rate limiting counters
        orgProcessing.set(orgId, currentOrgProcessing + 1);
        globalProcessing++;

        try {
          const orgResults = await processOrgTransactions(supabase, orgId, orgTransactions);
          results.push(orgResults);
          totalProcessed += orgResults.processed || 0;
        } catch (error) {
          console.error(`Failed to process org ${orgId}:`, error);
          results.push({
            orgId,
            error: error.message,
            processed: 0,
          });
        } finally {
          // Decrement counters
          const newCount = Math.max(0, (orgProcessing.get(orgId) || 1) - 1);
          if (newCount === 0) {
            orgProcessing.delete(orgId);
          } else {
            orgProcessing.set(orgId, newCount);
          }
          globalProcessing = Math.max(0, globalProcessing - 1);
        }
      }

      allResults.push(...results);
      batchCount++;

      // If we processed a full batch, wait 1 second before next batch (rate limiting)
      if (transactions.length === RATE_LIMIT.BATCH_SIZE && batchCount < maxBatches) {
        console.log(`Waiting 1 second before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Completed ${batchCount} batch(es), processed ${totalProcessed} total transactions`);

    return new Response(JSON.stringify({
      processed: totalProcessed,
      batches: batchCount,
      maxBatches: maxBatches,
      organizations: new Set(allResults.map(r => r.orgId)).size,
      results: allResults,
      orgId: requestOrgId
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Categorization queue job error:', error);
    return new Response(JSON.stringify({ 
      error: 'Categorization job failed',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function processOrgTransactions(supabase: any, orgId: string, transactions: any[]) {
  const results = {
    orgId,
    processed: 0,
    autoApplied: 0,
    markedForReview: 0,
    fallbackCount: 0,
    errors: [] as string[],
  };

  for (const tx of transactions) {
    try {
      // Run Pass-1 categorization
      let pass1Result = await runPass1Categorization(supabase, tx, orgId);
      
      // Validate Pass1 result
      if (!pass1Result.categoryId) {
        console.warn(`Pass1 failed to categorize tx ${tx.id}, will try LLM`);
        pass1Result.confidence = 0;  // Force LLM attempt
      }
      
      let finalResult = pass1Result;
      let source: 'pass1' | 'llm' = 'pass1';

      // If Pass-1 confidence < 0.95 OR no category, try LLM scoring
      if (!pass1Result.categoryId || !pass1Result.confidence || pass1Result.confidence < 0.95) {
        try {
          const llmResult = await runLLMCategorization(supabase, tx, orgId);
          
          // Validate LLM result
          if (llmResult.categoryId && llmResult.confidence && 
              llmResult.confidence > (pass1Result.confidence || 0)) {
            finalResult = llmResult;
            source = 'llm';
          } else if (!llmResult.categoryId) {
            console.warn(`LLM also failed to categorize tx ${tx.id}`);
          }
        } catch (llmError) {
          console.error(`LLM categorization failed for tx ${tx.id}:`, llmError);
          // Continue with Pass-1 result
        }
      }

      // Final fallback if BOTH Pass1 and LLM failed
      if (!finalResult.categoryId) {
        console.error(
          `[Critical] Both Pass1 and LLM failed for tx ${tx.id}. ` +
          `Merchant: ${tx.merchant_name || 'N/A'}, Description: ${tx.description || 'N/A'}, ` +
          `MCC: ${tx.mcc || 'N/A'}. Using fallback category.`
        );
        
        finalResult = {
          categoryId: mapCategorySlugToId('miscellaneous'),
          confidence: 0.3,
          rationale: [
            'Automatic categorization failed',
            'Neither rules-based nor AI could categorize this transaction',
            'Manual review required'
          ],
          attributes: {}
        };
        source = 'llm';  // Track as LLM to distinguish from Pass1
        results.fallbackCount++;
      }

      // Apply decision (now guaranteed to have categoryId)
      await decideAndApply(supabase, tx.id, finalResult, source, orgId);
      
      results.processed++;
      if (finalResult.confidence && finalResult.confidence >= 0.95) {
        results.autoApplied++;
      } else {
        results.markedForReview++;
      }

    } catch (error) {
      console.error(`Failed to process transaction ${tx.id}:`, error);
      results.errors.push(`${tx.id}: ${error.message}`);
    }
  }

  return results;
}

async function runPass1Categorization(supabase: any, tx: any, orgId: string): Promise<CategorizationResult> {
  // Convert to NormalizedTransaction format for centralized functions
  const normalizedTx: NormalizedTransaction = {
    id: tx.id,
    orgId: orgId as any,
    date: tx.created_at || new Date().toISOString(),
    amountCents: tx.amount_cents?.toString() || '0',
    currency: 'USD',
    description: tx.description || '',
    merchantName: tx.merchant_name || '',
    mcc: tx.mcc,
    categoryId: tx.category_id as any,
    confidence: tx.confidence,
    reviewed: tx.reviewed || false,
    needsReview: tx.needs_review || false,
    source: tx.source || 'plaid',
    raw: tx.raw || {}
  };

  // Get feature flag configuration for this environment
  const featureFlagConfig = getFeatureFlagConfig();

  // Create Pass-1 context with proper environment and feature flags
  const pass1Context = {
    orgId: orgId as any,
    db: supabase,
    logger: {
      info: (msg: string, meta?: any) => console.log(`[Pass1 Info] ${msg}`, meta || ''),
      error: (msg: string, error?: any) => console.error(`[Pass1 Error] ${msg}`, error || ''),
      debug: (msg: string, meta?: any) => console.log(`[Pass1 Debug] ${msg}`, meta || '')
    },
    caches: {
      vendorRules: new Map(),
      vendorEmbeddings: new Map()
    },
    config: {
      guardrails: {
        enforceMCCCompatibility: true,
        minConfidenceThreshold: 0.60,
        enableAmountChecks: true,
        enablePatternChecks: true,
        strictMode: false
      },
      enableEmbeddings: false,
      debugMode: false
    }
  };

  try {
    // Use centralized Pass-1 categorization engine
    const result = await pass1Categorize(normalizedTx, pass1Context);

    console.log(`[Pass1] Transaction ${tx.id}: category=${result.categoryId}, confidence=${result.confidence}`);

    return {
      categoryId: result.categoryId as string | undefined,
      confidence: result.confidence,
      rationale: result.rationale || []
    };
  } catch (error) {
    console.error(`[Pass1] Failed to categorize transaction ${tx.id}:`, error);
    
    // Return uncertain result on error
    return {
      categoryId: undefined,
      confidence: undefined,
      rationale: [`Pass-1 categorization error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

async function runLLMCategorization(supabase: any, tx: any, orgId: string): Promise<CategorizationResult> {
  // Convert to NormalizedTransaction format for centralized functions
  const normalizedTx = {
    id: tx.id,
    orgId: orgId,
    date: tx.date,
    amountCents: tx.amount_cents.toString(),
    currency: 'USD',
    description: tx.description,
    merchantName: tx.merchant_name,
    mcc: tx.mcc,
    categoryId: tx.category_id,
    confidence: tx.confidence,
    reviewed: tx.reviewed,
    source: tx.source,
    raw: tx.raw || {}
  };

  try {
    // Initialize Gemini client with validated settings
    const geminiClient = new GeminiClient({
      apiKey: Deno.env.get('GEMINI_API_KEY'),
      model: 'gemini-2.5-flash-lite', // 100% accuracy in tests
      temperature: 1.0, // Validated optimal temperature
    });

    // Use universal categorization with attribute extraction
    const result = await categorizeWithUniversalLLM(
      normalizedTx,
      {
        industry: 'ecommerce', // TODO: Get from org settings when multi-vertical
        orgId: orgId,
        config: {
          model: 'gemini-2.5-flash-lite',
          temperature: 1.0,
        },
        logger: {
          debug: (msg: string, meta?: any) => console.log(`[Universal LLM] ${msg}`, meta),
          info: (msg: string, meta?: any) => console.log(`[Universal LLM] ${msg}`, meta),
          error: (msg: string, error?: any) => console.error(`[Universal LLM] ${msg}`, error),
        }
      },
      geminiClient
    );

    console.log(`[LLM] Transaction ${tx.id}: category=${result.categoryId}, confidence=${result.confidence}, attributes=${JSON.stringify(result.attributes || {})}`);

    return {
      categoryId: result.categoryId,
      confidence: result.confidence,
      attributes: result.attributes || {},
      rationale: result.rationale || ['Universal LLM categorization']
    };

  } catch (error) {
    console.error('Universal LLM categorization error:', error);
    return {
      categoryId: mapCategorySlugToId('miscellaneous'),
      confidence: 0.5,
      attributes: {},
      rationale: ['LLM categorization failed, using fallback']
    };
  }
}

async function decideAndApply(
  supabase: any, 
  txId: string, 
  result: CategorizationResult, 
  source: 'pass1' | 'llm', 
  orgId: string
): Promise<void> {
  // Sanity check - should never happen with caller's fallback logic
  if (!result.categoryId) {
    throw new Error(
      `Internal error: decideAndApply called without categoryId for tx ${txId}. ` +
      `This should have been caught by the caller.`
    );
  }

  const shouldAutoApply = result.confidence && result.confidence >= 0.95;

  const updateData: any = {
    reviewed: false,
    category_id: result.categoryId,
    needs_review: !shouldAutoApply,
    confidence: result.confidence || 0,
  };

  // Save attributes if present (from universal LLM)
  if (result.attributes && Object.keys(result.attributes).length > 0) {
    updateData.attributes = result.attributes;
    console.log(`[Attributes] Transaction ${txId}: ${JSON.stringify(result.attributes)}`);
  }

  // Update transaction
  const { error: updateError } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', txId);

  if (updateError) {
    throw new Error(`Failed to update transaction: ${updateError.message}`);
  }

  // Create decision audit record
  const { error: decisionError } = await supabase
    .from('decisions')
    .insert({
      org_id: orgId,
      tx_id: txId,
      category_id: result.categoryId,
      source,
      confidence: result.confidence || 0,
      rationale: result.rationale || []
    });

  if (decisionError) {
    console.error('Failed to create decision record:', decisionError);
    // Don't throw - audit failure shouldn't block processing
  }
}