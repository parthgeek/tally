import { NextRequest } from "next/server";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import {
  ruleUpsertRequestSchema,
  type RuleUpsertRequest,
  type RuleUpsertResponse,
} from "@nexus/types";
import { captureException } from "@nexus/analytics";
import { getPosthogClientServer } from "@nexus/analytics/server";

/**
 * POST /api/rules/upsert-signature
 *
 * Create or update vendor-based categorization rules.
 * Used for "Always categorize like this" functionality.
 *
 * Request Body:
 * - vendor: string - Vendor name to match (will be normalized)
 * - mcc?: string - MCC code for additional specificity
 * - category_id: string - Category to assign to matching transactions
 * - description?: string - Human-readable rule description
 * - weight?: number - Rule priority (default 1)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: RuleUpsertRequest;
    try {
      validatedRequest = ruleUpsertRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    const supabase = await createServerClient();

    // Verify the category exists and user has access
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", validatedRequest.category_id)
      .or(`org_id.eq.${orgId},org_id.is.null`) // Allow global or org-specific categories
      .single();

    if (categoryError || !category) {
      return createErrorResponse("Invalid category", 400);
    }

    // Normalize the vendor name for consistent matching
    const { data: normalizedResult, error: normalizeError } = await supabase.rpc(
      "normalize_vendor",
      { vendor: validatedRequest.vendor }
    );

    if (normalizeError) {
      console.error("Failed to normalize vendor:", normalizeError);
      return createErrorResponse("Failed to process vendor name", 500);
    }

    const normalizedVendor = normalizedResult;
    if (!normalizedVendor) {
      return createErrorResponse("Invalid vendor name", 400);
    }

    // Build rule pattern
    const rulePattern = {
      vendor: normalizedVendor,
      ...(validatedRequest.mcc ? { mcc: validatedRequest.mcc } : {}),
    };

    // Check if rule already exists
    const { data: existingRule, error: fetchError } = await supabase
      .from("rules")
      .select("id, weight, category_id, categories(name)")
      .eq("org_id", orgId)
      .eq("pattern->vendor", normalizedVendor)
      .eq("pattern->mcc", validatedRequest.mcc || null)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Failed to check existing rule:", fetchError);
      return createErrorResponse("Failed to check existing rules", 500);
    }

    let ruleId: string;
    let isNew: boolean;

    if (existingRule) {
      // Update existing rule
      isNew = false;
      ruleId = existingRule.id;

      const { error: updateError } = await supabase
        .from("rules")
        .update({
          category_id: validatedRequest.category_id,
          weight: existingRule.weight + (validatedRequest.weight || 1),
          description: validatedRequest.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRule.id);

      if (updateError) {
        console.error("Failed to update rule:", updateError);
        return createErrorResponse("Failed to update rule", 500);
      }
    } else {
      // Create new rule
      isNew = true;

      const { data: newRule, error: createError } = await supabase
        .from("rules")
        .insert({
          org_id: orgId,
          pattern: rulePattern,
          category_id: validatedRequest.category_id,
          weight: validatedRequest.weight || 1,
          description: validatedRequest.description,
        })
        .select("id")
        .single();

      if (createError || !newRule) {
        console.error("Failed to create rule:", createError);
        return createErrorResponse("Failed to create rule", 500);
      }

      ruleId = newRule.id;
    }

    // Track analytics event
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        await posthog.capture({
          distinctId: userId,
          event: isNew ? "rule_created" : "rule_updated",
          properties: {
            org_id: orgId,
            user_id: userId,
            rule_id: ruleId,
            vendor: validatedRequest.vendor,
            normalized_vendor: normalizedVendor,
            mcc: validatedRequest.mcc,
            category_id: validatedRequest.category_id,
            category_name: category.name,
            weight: validatedRequest.weight || 1,
            has_description: !!validatedRequest.description,
            rule_signature: `${normalizedVendor}${validatedRequest.mcc ? "|" + validatedRequest.mcc : ""}`,
            previous_category: existingRule?.category_id,
            previous_category_name: Array.isArray(existingRule?.categories)
              ? existingRule.categories.length > 0
                ? existingRule.categories[0]?.name
                : undefined
              : (existingRule?.categories as any)?.name,
          },
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture rule analytics:", analyticsError);
      // Don't fail the request if analytics fails
    }

    const response: RuleUpsertResponse = {
      success: true,
      rule_id: ruleId,
      message: isNew
        ? `Created new rule: "${validatedRequest.vendor}" → "${category.name}"`
        : `Updated existing rule: "${validatedRequest.vendor}" → "${category.name}"`,
      is_new: isNew,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error in POST /api/rules/upsert-signature:", error);

    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown rule upsert error")
      );
    } catch (analyticsError) {
      console.error("Failed to capture exception:", analyticsError);
    }

    return createErrorResponse("Internal server error", 500);
  }
}
