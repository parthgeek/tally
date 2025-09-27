import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { buildCategorizationPrompt } from '../../../packages/categorizer/src/prompt.ts';
import { mapCategorySlugToId, isValidCategorySlug } from '../../../packages/categorizer/src/taxonomy.ts';
import { applyEcommerceGuardrails } from '../../../packages/categorizer/src/guardrails.ts';

interface CategorizationResult {
  categoryId?: string;
  confidence?: number;
  rationale: string[];
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

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get transactions that need categorization
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, org_id, merchant_name, mcc, description, amount_cents, category_id, needs_review')
      .or('category_id.is.null,needs_review.eq.true')
      .order('created_at', { ascending: true })
      .limit(RATE_LIMIT.BATCH_SIZE);

    if (error || !transactions) {
      throw new Error(`Failed to fetch transactions: ${error?.message}`);
    }

    if (transactions.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No transactions to process',
        processed: 0 
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
        results.push(...orgResults);
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

    return new Response(JSON.stringify({
      processed: results.reduce((sum, r) => sum + (r.processed || 0), 0),
      organizations: results.length,
      results
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
    errors: [] as string[],
  };

  for (const tx of transactions) {
    try {
      // Run Pass-1 categorization
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

      // Apply decision
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
  // Simplified Pass-1 implementation for edge function
  // In a full implementation, we'd import from the categorizer package
  
  const rationale: string[] = [];
  let bestCandidate: { categoryId?: string; confidence: number } = { confidence: 0 };

  // MCC mapping (e-commerce focused)
  const mccMappings: Record<string, { categoryId: string; confidence: number; name: string }> = {
    '5912': { categoryId: '550e8400-e29b-41d4-a716-446655440201', confidence: 0.85, name: 'Inventory Purchases' },
    '5999': { categoryId: '550e8400-e29b-41d4-a716-446655440201', confidence: 0.8, name: 'Inventory Purchases' },
    '7372': { categoryId: '550e8400-e29b-41d4-a716-446655440351', confidence: 0.9, name: 'Software (General)' },
    '4814': { categoryId: '550e8400-e29b-41d4-a716-446655440357', confidence: 0.85, name: 'Travel & Transportation' },
    '5541': { categoryId: '550e8400-e29b-41d4-a716-446655440358', confidence: 0.9, name: 'Bank Fees' },
  };

  if (tx.mcc && mccMappings[tx.mcc]) {
    const mapping = mccMappings[tx.mcc];
    bestCandidate = { categoryId: mapping.categoryId, confidence: mapping.confidence };
    rationale.push(`mcc: ${tx.mcc} → ${mapping.name}`);
  }

  // Pattern matching for e-commerce (simplified)
  const description = tx.description?.toLowerCase() || '';
  const merchantName = tx.merchant_name?.toLowerCase() || '';

  // E-commerce specific patterns
  if (description.includes('rent') || description.includes('lease')) {
    if (0.75 > bestCandidate.confidence) {
      bestCandidate = {
        categoryId: '550e8400-e29b-41d4-a716-446655440353',
        confidence: 0.75
      };
      rationale.push('pattern: rent/lease → Rent & Utilities');
    }
  }

  // Payment processing patterns
  if (merchantName.includes('stripe') || description.includes('stripe')) {
    if (0.85 > bestCandidate.confidence) {
      bestCandidate = {
        categoryId: '550e8400-e29b-41d4-a716-446655440311',
        confidence: 0.85
      };
      rationale.push('pattern: stripe → Stripe Fees');
    }
  }

  if (merchantName.includes('paypal') || description.includes('paypal')) {
    if (0.85 > bestCandidate.confidence) {
      bestCandidate = {
        categoryId: '550e8400-e29b-41d4-a716-446655440312',
        confidence: 0.85
      };
      rationale.push('pattern: paypal → PayPal Fees');
    }
  }

  // Marketing/Ads patterns
  if (merchantName.includes('google ads') || merchantName.includes('google adwords')) {
    if (0.9 > bestCandidate.confidence) {
      bestCandidate = {
        categoryId: '550e8400-e29b-41d4-a716-446655440322',
        confidence: 0.9
      };
      rationale.push('pattern: google ads → Google Ads');
    }
  }

  if (merchantName.includes('facebook') || merchantName.includes('meta')) {
    if (0.9 > bestCandidate.confidence) {
      bestCandidate = {
        categoryId: '550e8400-e29b-41d4-a716-446655440321',
        confidence: 0.9
      };
      rationale.push('pattern: facebook/meta → Meta Ads');
    }
  }

  // Shopify platform
  if (merchantName.includes('shopify') || description.includes('shopify')) {
    if (0.85 > bestCandidate.confidence) {
      bestCandidate = {
        categoryId: '550e8400-e29b-41d4-a716-446655440331',
        confidence: 0.85
      };
      rationale.push('pattern: shopify → Shopify Platform');
    }
  }

  return {
    categoryId: bestCandidate.categoryId,
    confidence: bestCandidate.confidence > 0 ? bestCandidate.confidence : undefined,
    rationale
  };
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

  // Use centralized prompt builder
  const prompt = buildCategorizationPrompt(normalizedTx);

  try {
    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    // Parse and validate LLM response
    let parsed;
    try {
      let cleanText = content.trim();

      // Extract JSON from markdown if wrapped
      const jsonMatch = cleanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        cleanText = jsonMatch[1].trim();
      } else {
        const objectMatch = cleanText.match(/\{[\s\S]*\}/);
        if (objectMatch && objectMatch[0]) {
          cleanText = objectMatch[0].trim();
        }
      }

      parsed = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', content, parseError);
      parsed = {
        category_slug: 'other_ops',
        confidence: 0.5,
        rationale: 'Failed to parse LLM response'
      };
    }

    // Validate category slug
    let categorySlug = parsed.category_slug || 'other_ops';
    if (!isValidCategorySlug(categorySlug)) {
      console.warn(`Invalid category slug from LLM: ${categorySlug}, falling back to other_ops`);
      categorySlug = 'other_ops';
    }

    let confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

    // Apply e-commerce guardrails
    const guardrailResult = applyEcommerceGuardrails(normalizedTx, categorySlug, confidence);

    return {
      categoryId: mapCategorySlugToId(guardrailResult.categorySlug),
      confidence: guardrailResult.confidence,
      rationale: [
        `LLM: ${parsed.rationale || 'AI categorization'}`,
        ...guardrailResult.guardrailsApplied.map(g => `Guardrail: ${g}`)
      ]
    };

  } catch (error) {
    console.error('Gemini categorization error:', error);
    return {
      categoryId: mapCategorySlugToId('other_ops'),
      confidence: 0.5,
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
  const shouldAutoApply = result.confidence && result.confidence >= 0.95;

  const updateData: any = {
    reviewed: false,
  };

  if (shouldAutoApply && result.categoryId) {
    updateData.category_id = result.categoryId;
    updateData.confidence = result.confidence;
    updateData.needs_review = false;
  } else {
    updateData.needs_review = true;
    if (result.categoryId) {
      updateData.category_id = result.categoryId;
    }
    if (result.confidence) {
      updateData.confidence = result.confidence;
    }
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
      tx_id: txId,
      source,
      confidence: result.confidence || 0,
      rationale: result.rationale || [],
      decided_by: 'system'
    });

  if (decisionError) {
    console.error('Failed to create decision record:', decisionError);
    // Don't throw - audit failure shouldn't block processing
  }
}