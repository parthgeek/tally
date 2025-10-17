import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { mapCategorySlugToId } from "@nexus/categorizer";

export async function POST(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    const supabase = await createServerClient();

    // Get the user's session token for authenticated edge function call
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return createErrorResponse("Missing authorization header", 401);
    }

    // Get uncategorized transactions for this org
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select(
        "id, org_id, merchant_name, mcc, description, amount_cents, category_id, needs_review"
      )
      .eq("org_id", orgId)
      .is("category_id", null) // Only truly uncategorized transactions
      .limit(50); // Process up to 50 transactions at a time

    if (txError) {
      console.error("Failed to fetch transactions:", txError);
      return createErrorResponse("Failed to fetch transactions", 500);
    }

    if (!transactions || transactions.length === 0) {
      return Response.json({
        success: true,
        message: "No uncategorized transactions found",
        processed: 0,
        results: [],
      });
    }

    // Trigger the categorization edge function by calling it directly
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/jobs-categorize-queue`;

    console.log(`Attempting to call edge function: ${edgeFunctionUrl}`);
    console.log(`Found ${transactions.length} transactions to categorize for org ${orgId}`);

    try {
      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader, // Pass user's JWT token for authentication
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      });

      console.log(`Edge function response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Edge function error response: ${errorText}`);
        throw new Error(
          `Edge function failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Edge function result:", result);

      return Response.json({
        success: true,
        message: `Triggered categorization for ${transactions.length} transactions`,
        processed: result.processed || 0,
        organizations: result.organizations || 0,
        results: result.results || [],
      });
    } catch (edgeError) {
      console.error("Failed to call edge function:", edgeError);

      // Fallback: simple pattern-based categorization with universal taxonomy
      let processed = 0;

      for (const tx of transactions) {
        try {
          let categorySlug = null;
          let confidence = 0.5;

          // Simple pattern matching for common e-commerce expenses
          const description = tx.description?.toLowerCase() || "";
          const merchantName = tx.merchant_name?.toLowerCase() || "";

          if (merchantName.includes("stripe") || description.includes("stripe")) {
            categorySlug = "stripe_fees";
            confidence = 0.85;
          } else if (merchantName.includes("paypal") || description.includes("paypal")) {
            categorySlug = "paypal_fees";
            confidence = 0.85;
          } else if (merchantName.includes("shopify") || description.includes("shopify")) {
            categorySlug = "shopify_platform";
            confidence = 0.85;
          } else if (
            merchantName.includes("google ads") ||
            merchantName.includes("google adwords")
          ) {
            categorySlug = "ads_google";
            confidence = 0.9;
          } else if (merchantName.includes("facebook") || merchantName.includes("meta")) {
            categorySlug = "ads_meta";
            confidence = 0.9;
          } else if (description.includes("rent") || description.includes("lease")) {
            categorySlug = "rent_utilities";
            confidence = 0.75;
          } else {
            // Default to "Other Operating Expenses" or "Miscellaneous" based on active taxonomy
            categorySlug = "other_ops";
            confidence = 0.6;
          }

          // Map slug to ID using universal taxonomy
          const categoryId = categorySlug ? mapCategorySlugToId(categorySlug) : null;

          // Update the transaction
          const { error: updateError } = await supabase
            .from("transactions")
            .update({
              category_id: categoryId,
              confidence: confidence,
              needs_review: confidence < 0.95,
              reviewed: false,
            })
            .eq("id", tx.id);

          if (!updateError) {
            processed++;
          }
        } catch (error) {
          console.error(`Failed to categorize transaction ${tx.id}:`, error);
        }
      }

      return Response.json({
        success: true,
        message: `Fallback categorization completed for ${processed} transactions`,
        processed,
        fallback: true,
        note: "Used pattern-based fallback due to edge function unavailability",
      });
    }
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in POST /api/categorize/run:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
