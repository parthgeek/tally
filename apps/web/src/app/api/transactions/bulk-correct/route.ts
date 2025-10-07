import { NextRequest } from "next/server";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import {
  transactionBulkCorrectRequestSchema,
  type TransactionBulkCorrectRequest,
  type TransactionBulkCorrectResponse,
} from "@nexus/types";
import { captureException } from "@nexus/analytics";
import { getPosthogClientServer } from "@nexus/analytics/server";

/**
 * POST /api/transactions/bulk-correct
 *
 * Bulk correction endpoint for correcting multiple transactions atomically.
 * Creates audit records, generates vendor rules, and tracks analytics.
 *
 * Request Body:
 * - tx_ids: string[] - Array of transaction IDs (1-100 items)
 * - new_category_id: string - Target category ID
 * - create_rule?: boolean - Whether to create/update vendor rule (default true)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: TransactionBulkCorrectRequest;
    try {
      validatedRequest = transactionBulkCorrectRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    const supabase = await createServerClient();

    // Verify the new category exists and user has access
    // Allow global (allowlist) or org-specific categories, but must be active
    const { data: newCategory, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, type, is_active")
      .eq("id", validatedRequest.new_category_id)
      .or(`org_id.eq.${orgId},org_id.is.null`) // Allow global or org-specific categories
      .eq("is_active", true) // Only allow active categories
      .single();

    if (categoryError || !newCategory) {
      return createErrorResponse("Invalid category or category is not active", 400);
    }

    // Additional validation: ensure category has a type (prevents UI rendering issues)
    if (!newCategory.type) {
      return createErrorResponse("Category missing type - contact support", 400);
    }

    // Get sample of old categories for analytics
    const { data: oldTransactions, error: fetchError } = await supabase
      .from("transactions")
      .select("id, category_id, merchant_name, mcc, confidence, categories(name)")
      .in("id", validatedRequest.tx_ids)
      .eq("org_id", orgId);

    if (fetchError) {
      console.error("Failed to fetch transactions for bulk correction:", fetchError);
      return createErrorResponse("Failed to load transactions", 500);
    }

    if (!oldTransactions || oldTransactions.length === 0) {
      return createErrorResponse("No transactions found", 404);
    }

    // Verify user has access to all transactions
    if (oldTransactions.length !== validatedRequest.tx_ids.length) {
      return createErrorResponse("Some transactions not found or access denied", 403);
    }

    // Execute bulk correction using database function for atomicity
    const { data: bulkResult, error: bulkError } = await supabase.rpc("bulk_correct_transactions", {
      p_tx_ids: validatedRequest.tx_ids,
      p_new_category_id: validatedRequest.new_category_id,
      p_org_id: orgId,
      p_user_id: userId,
      p_create_rule: validatedRequest.create_rule ?? true,
    });

    if (bulkError) {
      console.error("Failed to execute bulk correction:", bulkError);
      return createErrorResponse("Failed to correct transactions", 500);
    }

    const result = bulkResult?.[0];
    if (!result) {
      return createErrorResponse("Unexpected error in bulk correction", 500);
    }

    // Handle partial failures
    const errors = result.errors && Array.isArray(result.errors) ? result.errors : [];
    const successCount = result.corrected_count || 0;

    // Track analytics event
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        // Aggregate old categories for analytics
        const oldCategoryStats = oldTransactions.reduce((acc: Record<string, number>, tx: any) => {
          const categoryName = tx.categories?.name || "Uncategorized";
          acc[categoryName] = (acc[categoryName] || 0) + 1;
          return acc;
        }, {});

        const avgConfidence =
          oldTransactions.reduce((sum, tx) => sum + (tx.confidence || 0), 0) /
          oldTransactions.length;
        const commonVendor = oldTransactions.reduce((acc: Record<string, number>, tx: any) => {
          if (tx.merchant_name) {
            acc[tx.merchant_name] = (acc[tx.merchant_name] || 0) + 1;
          }
          return acc;
        }, {});
        const vendorKeys = Object.keys(commonVendor);
        const mostCommonVendor =
          vendorKeys.length > 0
            ? vendorKeys.reduce((a, b) => (commonVendor[a]! > commonVendor[b]! ? a : b))
            : "";

        await posthog.capture({
          distinctId: userId,
          event: "bulk_correction_completed",
          properties: {
            org_id: orgId,
            user_id: userId,
            transaction_count: validatedRequest.tx_ids.length,
            corrected_count: successCount,
            error_count: errors.length,
            new_category_id: validatedRequest.new_category_id,
            new_category_name: newCategory.name,
            old_category_distribution: oldCategoryStats,
            avg_confidence: Math.round(avgConfidence * 100) / 100,
            rule_created: !!result.rule_signature,
            rule_signature: result.rule_signature,
            rule_weight: result.rule_weight,
            most_common_vendor: mostCommonVendor,
            create_rule_requested: validatedRequest.create_rule ?? true,
          },
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture bulk correction analytics:", analyticsError);
      // Don't fail the request if analytics fails
    }

    // Prepare response
    const response: TransactionBulkCorrectResponse = {
      success: successCount > 0,
      corrected_count: successCount,
      rule_signature: result.rule_signature || undefined,
      message:
        errors.length > 0
          ? `Corrected ${successCount} transactions with ${errors.length} errors`
          : `Successfully corrected ${successCount} transactions as "${newCategory.name}"`,
      errors:
        errors.length > 0
          ? errors.map((err: any) => ({
              tx_id: err.tx_id,
              error: err.error,
            }))
          : undefined,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error in POST /api/transactions/bulk-correct:", error);

    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown bulk correction error")
      );
    } catch (analyticsError) {
      console.error("Failed to capture exception:", analyticsError);
    }

    return createErrorResponse("Internal server error", 500);
  }
}
