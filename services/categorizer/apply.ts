import type { CategorizationResult, CategorizationContext, TransactionId, OrgId } from '../../packages/types/src/index.js';

interface DecisionContext extends CategorizationContext {
  orgId: OrgId; // Ensure orgId is available
  db: any; // Supabase client
  analytics?: {
    captureEvent?: (event: string, properties: any) => void;
    captureException?: (error: Error) => void;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
  };
}

/**
 * Decision policy constants
 */
const AUTO_APPLY_THRESHOLD = 0.85;

/**
 * Applies categorization decision to a transaction based on confidence threshold
 * 
 * Policy:
 * - If confidence >= 0.85 → auto-apply category
 * - If confidence < 0.85 → mark for review (needs_review = true)
 * 
 * Always creates a decision audit record and emits analytics events
 */
export async function decideAndApply(
  txId: TransactionId,
  result: CategorizationResult,
  source: 'pass1' | 'llm',
  ctx: DecisionContext
): Promise<void> {
  try {
    const shouldAutoApply = result.confidence !== undefined && result.confidence >= AUTO_APPLY_THRESHOLD;
    
    // Start transaction for consistency
    const { data: transaction, error: txError } = await ctx.db
      .from('transactions')
      .select('id, org_id')
      .eq('id', txId)
      .single();

    if (txError || !transaction) {
      throw new Error(`Transaction not found: ${txId}`);
    }

    // Verify user has access to this transaction's org
    if (transaction.org_id !== ctx.orgId) {
      throw new Error('Unauthorized access to transaction');
    }

    // Update the transaction based on decision policy
    const updateData: any = {
      reviewed: false, // Always mark as not reviewed when auto-categorizing
    };

    if (shouldAutoApply && result.categoryId) {
      // Auto-apply the category
      updateData.category_id = result.categoryId;
      updateData.confidence = result.confidence;
      updateData.needs_review = false;
      
      ctx.logger?.info('Auto-applying categorization', {
        txId,
        categoryId: result.categoryId,
        confidence: result.confidence,
        source
      });
    } else {
      // Mark for manual review
      updateData.needs_review = true;
      
      // Still update category and confidence for review context
      if (result.categoryId) {
        updateData.category_id = result.categoryId;
      }
      if (result.confidence !== undefined) {
        updateData.confidence = result.confidence;
      }
      
      ctx.logger?.info('Marking transaction for review', {
        txId,
        confidence: result.confidence,
        source
      });
    }

    // Update the transaction
    const { error: updateError } = await ctx.db
      .from('transactions')
      .update(updateData)
      .eq('id', txId);

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    // Create decision audit record
    const { error: decisionError } = await ctx.db
      .from('decisions')
      .insert({
        tx_id: txId,
        source,
        confidence: result.confidence || 0,
        rationale: result.rationale || [],
        decided_by: 'system'
      });

    if (decisionError) {
      ctx.logger?.error('Failed to create decision record', decisionError);
      // Don't throw - decision audit failure shouldn't block the main operation
    }

    // Emit analytics events
    if (shouldAutoApply) {
      ctx.analytics?.captureEvent?.('categorization_auto_applied', {
        org_id: ctx.orgId,
        transaction_id: txId,
        category_id: result.categoryId,
        confidence: result.confidence,
        source,
        rationale_count: result.rationale?.length || 0
      });
    } else {
      ctx.analytics?.captureEvent?.('categorization_marked_for_review', {
        org_id: ctx.orgId,
        transaction_id: txId,
        confidence: result.confidence || 0,
        source,
        reason: result.confidence !== undefined && result.confidence < AUTO_APPLY_THRESHOLD 
          ? 'low_confidence' 
          : 'no_confidence'
      });
    }

  } catch (error) {
    ctx.logger?.error('Decision and apply failed', error);
    ctx.analytics?.captureException?.(error instanceof Error ? error : new Error('Unknown decision error'));
    
    // Re-throw to allow caller to handle
    throw error;
  }
}

/**
 * Batch version of decideAndApply for processing multiple transactions
 * Useful for queue processing where we want to handle errors per transaction
 */
export async function batchDecideAndApply(
  decisions: Array<{
    txId: TransactionId;
    result: CategorizationResult;
    source: 'pass1' | 'llm';
  }>,
  ctx: DecisionContext
): Promise<{
  successful: number;
  failed: Array<{ txId: TransactionId; error: string }>;
}> {
  const results = {
    successful: 0,
    failed: [] as Array<{ txId: TransactionId; error: string }>
  };

  for (const decision of decisions) {
    try {
      await decideAndApply(decision.txId, decision.result, decision.source, ctx);
      results.successful++;
    } catch (error) {
      results.failed.push({
        txId: decision.txId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Log batch summary
  ctx.logger?.info('Batch decision processing completed', {
    total: decisions.length,
    successful: results.successful,
    failed: results.failed.length,
    org_id: ctx.orgId
  });

  return results;
}