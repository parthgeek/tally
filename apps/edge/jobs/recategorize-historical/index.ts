import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { buildCategorizationPrompt } from '../../../packages/categorizer/src/prompt.ts';
import { mapCategorySlugToId, isValidCategorySlug } from '../../../packages/categorizer/src/taxonomy.ts';
import { applyEcommerceGuardrails } from '../../../packages/categorizer/src/guardrails.ts';
import { pass1Categorize } from '../../../packages/categorizer/src/engine/pass1.ts';
import { categorizeWithUniversalLLM } from '../../../packages/categorizer/src/index.ts';
import { GeminiClient } from '../../../packages/categorizer/src/gemini-client.ts';
import type { NormalizedTransaction } from '../../../packages/types/src/index.ts';
import { type FeatureFlagConfig } from '../../../packages/categorizer/src/feature-flags.ts';

interface RecategorizationRequest {
  orgId: string;
  daysBack?: number; // Default: 180 days
  batchSize?: number; // Default: 50 transactions per batch
}

interface RecategorizationResult {
  orgId: string;
  processed: number;
  recategorized: number;
  markedForReview: number;
  errors: string[];
  duration: number;
}

const DEFAULT_DAYS_BACK = 180;
const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;

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
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json() as RecategorizationRequest;
    const { orgId, daysBack = DEFAULT_DAYS_BACK, batchSize = DEFAULT_BATCH_SIZE } = body;

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'orgId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const startTime = Date.now();
    const result = await recategorizeHistoricalTransactions(
      supabase,
      orgId,
      Math.min(batchSize, MAX_BATCH_SIZE),
      daysBack
    );

    result.duration = Date.now() - startTime;

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Recategorization job error:', error);
    return new Response(JSON.stringify({
      error: 'Recategorization job failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

interface BatchTransaction {
  id: string;
  description: string;
  merchant_name: string;
  mcc: string;
  amount_cents: string;
  category_id: string | null;
  confidence: number | null;
  date: string;
  source: string;
  raw: any;
}

async function processSingleTransaction(
  supabase: any,
  tx: BatchTransaction,
  orgId: string
): Promise<{
  categoryChanged: boolean;
  finalResult: any;
  source: 'pass1' | 'llm';
  originalCategoryId: string | null;
}> {
  // Store original category for comparison
  const originalCategoryId = tx.category_id;

  // Run hybrid categorization on this transaction
  const pass1Result = await runPass1Categorization(supabase, tx, orgId);

  let finalResult = pass1Result;
  let source: 'pass1' | 'llm' = 'pass1';

  // If Pass-1 confidence < 0.95, try LLM scoring
  if (!pass1Result.confidence || pass1Result.confidence < 0.95) {
    try {
      const llmResult = await runLLMCategorization(supabase, tx, orgId);
      if (llmResult.confidence && llmResult.confidence > (pass1Result.confidence || 0)) {
        finalResult = llmResult;
        source = 'llm';
      }
    } catch (llmError) {
      console.error(`LLM categorization failed for tx ${tx.id}:`, llmError);
      // Continue with Pass-1 result
    }
  }

  // Check if category changed
  const categoryChanged = originalCategoryId !== finalResult.categoryId;

  return {
    categoryChanged,
    finalResult,
    source,
    originalCategoryId
  };
}

async function updateTransactionRecord(
  supabase: any,
  tx: BatchTransaction,
  orgId: string,
  finalResult: any,
  source: 'pass1' | 'llm',
  originalCategoryId: string | null
): Promise<void> {
  // Always mark changed categories for review
  const updateData: any = {
    category_id: finalResult.categoryId,
    confidence: finalResult.confidence,
    needs_review: true, // Always mark for review when recategorizing
    reviewed: false
  };

  // Save attributes if present (from universal LLM)
  if (finalResult.attributes && Object.keys(finalResult.attributes).length > 0) {
    updateData.attributes = finalResult.attributes;
    console.log(`[Recategorize Attributes] Transaction ${tx.id}: ${JSON.stringify(finalResult.attributes)}`);
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', tx.id);

  if (updateError) {
    throw new Error(`Failed to update transaction ${tx.id}: ${updateError.message}`);
  }

  // Create decision audit record
  const { error: decisionError } = await supabase
    .from('decisions')
    .insert({
      tx_id: tx.id,
      org_id: orgId,
      category_id: finalResult.categoryId,
      confidence: finalResult.confidence || 0,
      source: `recategorization_${source}`,
      rationale: [
        'Historical recategorization due to industry switch',
        `Previous category: ${originalCategoryId || 'none'}`,
        ...(finalResult.rationale || [])
      ],
      decided_by: 'system'
    });

  if (decisionError) {
    console.error('Failed to create decision record:', decisionError);
    // Don't fail the whole process for audit failures
  }
}

async function processBatch(
  supabase: any,
  batch: BatchTransaction[],
  orgId: string,
  result: RecategorizationResult
): Promise<void> {
  for (const tx of batch) {
    try {
      const { categoryChanged, finalResult, source, originalCategoryId } =
        await processSingleTransaction(supabase, tx, orgId);

      if (categoryChanged) {
        await updateTransactionRecord(supabase, tx, orgId, finalResult, source, originalCategoryId);
        result.recategorized++;
        result.markedForReview++;
      }

      result.processed++;

    } catch (error) {
      result.errors.push(`Transaction ${tx.id}: ${error.message}`);
      console.error(`Failed to recategorize transaction ${tx.id}:`, error);
    }
  }
}

async function recategorizeHistoricalTransactions(
  supabase: any,
  orgId: string,
  batchSize: number,
  daysBack: number
): Promise<RecategorizationResult> {
  const result: RecategorizationResult = {
    orgId,
    processed: 0,
    recategorized: 0,
    markedForReview: 0,
    errors: [],
    duration: 0
  };

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  try {
    // Get all transactions from the last X days for this org
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, description, merchant_name, mcc, amount_cents, category_id, confidence, date, source, raw')
      .eq('org_id', orgId)
      .gte('date', cutoffDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch transactions: ${fetchError.message}`);
    }

    if (!transactions || transactions.length === 0) {
      console.log(`No transactions found for org ${orgId} in the last ${daysBack} days`);
      return result;
    }

    console.log(`Found ${transactions.length} transactions to recategorize for org ${orgId}`);

    // Process transactions in batches
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      await processBatch(supabase, batch, orgId, result);

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Create activity log entry for this recategorization
    const { error: activityError } = await supabase
      .from('activity_logs')
      .insert({
        org_id: orgId,
        activity_type: 'recategorization_completed',
        description: `Historical recategorization completed: ${result.recategorized} transactions recategorized, ${result.markedForReview} marked for review`,
        metadata: {
          processed: result.processed,
          recategorized: result.recategorized,
          markedForReview: result.markedForReview,
          daysBack,
          duration: result.duration
        },
        created_by: 'system'
      });

    if (activityError) {
      console.error('Failed to create activity log:', activityError);
    }

  } catch (error) {
    result.errors.push(`Recategorization failed: ${error.message}`);
    throw error;
  }

  return result;
}

// Simplified Pass-1 categorization for edge function
async function runPass1Categorization(supabase: any, tx: any, orgId: string) {
  // Convert to NormalizedTransaction format for centralized functions
  const normalizedTx: NormalizedTransaction = {
    id: tx.id,
    orgId: orgId as any,
    date: tx.date || new Date().toISOString(),
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

    console.log(`[Recategorize Pass1] Transaction ${tx.id}: category=${result.categoryId}, confidence=${result.confidence}`);

    return {
      categoryId: result.categoryId as string | undefined,
      confidence: result.confidence,
      rationale: result.rationale || []
    };
  } catch (error) {
    console.error(`[Recategorize Pass1] Failed to categorize transaction ${tx.id}:`, error);
    
    // Return uncertain result on error
    return {
      categoryId: undefined,
      confidence: undefined,
      rationale: [`Pass-1 categorization error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

// LLM categorization for recategorization using universal taxonomy
async function runLLMCategorization(supabase: any, tx: any, orgId: string) {
  // Convert to NormalizedTransaction format for centralized functions
  const normalizedTx: NormalizedTransaction = {
    id: tx.id,
    orgId: orgId as any,
    date: tx.date || new Date().toISOString(),
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
          debug: (msg: string, meta?: any) => console.log(`[Recategorize LLM] ${msg}`, meta),
          info: (msg: string, meta?: any) => console.log(`[Recategorize LLM] ${msg}`, meta),
          error: (msg: string, error?: any) => console.error(`[Recategorize LLM] ${msg}`, error),
        }
      },
      geminiClient
    );

    console.log(`[Recategorize] Transaction ${tx.id}: category=${result.categoryId}, confidence=${result.confidence}, attributes=${JSON.stringify(result.attributes || {})}`);

    return {
      categoryId: result.categoryId,
      confidence: result.confidence,
      attributes: result.attributes || {},
      rationale: result.rationale || ['Universal LLM recategorization']
    };

  } catch (error) {
    console.error('Universal LLM recategorization error:', error);
    const featureFlagConfig = getFeatureFlagConfig();
    return {
      categoryId: mapCategorySlugToId('miscellaneous', featureFlagConfig, ENVIRONMENT),
      confidence: 0.5,
      attributes: {},
      rationale: ['LLM categorization failed, using fallback']
    };
  }
}