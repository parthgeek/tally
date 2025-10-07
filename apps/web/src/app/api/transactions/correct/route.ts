import { NextRequest } from "next/server";
import {
  transactionCorrectRequestSchema,
  type TransactionCorrectRequest,
  type TransactionCorrectResponse,
} from "@nexus/types/contracts";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
// Using database function for vendor normalization to ensure consistency
import { captureException } from "@nexus/analytics";
import { getPosthogClientServer } from "@nexus/analytics/server";

export async function POST(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: TransactionCorrectRequest;
    try {
      validatedRequest = transactionCorrectRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    const supabase = await createServerClient();

    // Load the transaction to correct
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("id, org_id, merchant_name, mcc, category_id, confidence")
      .eq("id", validatedRequest.txId)
      .single();

    if (txError || !transaction) {
      return createErrorResponse("Transaction not found", 404);
    }

    // Verify user has access to this transaction's org
    if (transaction.org_id !== orgId) {
      return createErrorResponse("Access denied to transaction", 403);
    }

    // Verify the new category exists and user has access
    // Allow global (allowlist) or org-specific categories, but must be active
    const { data: newCategory, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, type, is_active")
      .eq("id", validatedRequest.newCategoryId)
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

    // Update the transaction
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        category_id: validatedRequest.newCategoryId,
        reviewed: true,
        needs_review: false,
      })
      .eq("id", validatedRequest.txId);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
      return createErrorResponse("Failed to update transaction", 500);
    }

    // Insert correction record
    const { error: correctionError } = await supabase.from("corrections").insert({
      org_id: orgId,
      tx_id: validatedRequest.txId,
      old_category_id: transaction.category_id,
      new_category_id: validatedRequest.newCategoryId,
      user_id: userId,
    });

    if (correctionError) {
      console.error("Failed to create correction record:", correctionError);
      // Don't fail the request if correction audit fails
    }

    // Generate and upsert vendor rule for future categorizations
    if (transaction.merchant_name) {
      // Use database function for consistent vendor normalization
      const { data: normalizedVendor, error: normalizeError } = await supabase.rpc(
        "normalize_vendor",
        { vendor: transaction.merchant_name }
      );

      if (normalizeError) {
        console.error("Failed to normalize vendor:", normalizeError);
        // Continue without creating rule rather than failing the entire request
      } else if (normalizedVendor) {
        const rulePattern = {
          vendor: normalizedVendor,
          ...(transaction.mcc ? { mcc: transaction.mcc } : {}),
        };

        // Upsert rule - increment weight if exists, create if not
        const { data: existingRule } = await supabase
          .from("rules")
          .select("id, weight")
          .eq("org_id", orgId)
          .eq("pattern->vendor", normalizedVendor)
          .eq("category_id", validatedRequest.newCategoryId)
          .single();

        if (existingRule) {
          // Increment weight of existing rule
          const { error: updateRuleError } = await supabase
            .from("rules")
            .update({ weight: existingRule.weight + 1 })
            .eq("id", existingRule.id);

          if (updateRuleError) {
            console.error("Failed to update rule weight:", updateRuleError);
          }
        } else {
          // Create new rule
          const { error: createRuleError } = await supabase.from("rules").insert({
            org_id: orgId,
            pattern: rulePattern,
            category_id: validatedRequest.newCategoryId,
            weight: 1,
          });

          if (createRuleError) {
            console.error("Failed to create new rule:", createRuleError);
          }
        }
      }
    }

    // Emit analytics event
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        posthog.capture({
          distinctId: userId,
          event: "categorization_corrected",
          properties: {
            org_id: orgId,
            user_id: userId,
            transaction_id: validatedRequest.txId,
            old_category_id: transaction.category_id,
            new_category_id: validatedRequest.newCategoryId,
            old_confidence: transaction.confidence,
            merchant_name: transaction.merchant_name,
            had_prior_category: !!transaction.category_id,
          },
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture analytics event:", analyticsError);
      // Don't fail the request if analytics fails
    }

    const response: TransactionCorrectResponse = {
      success: true,
      message: `Transaction categorized as "${newCategory.name}"`,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error in POST /api/transactions/correct:", error);

    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown correction error")
      );
    } catch (analyticsError) {
      console.error("Failed to capture exception:", analyticsError);
    }

    return createErrorResponse("Internal server error", 500);
  }
}
