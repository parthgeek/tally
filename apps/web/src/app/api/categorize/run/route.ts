import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withOrgFromRequest, createValidationErrorResponse, createErrorResponse } from "@/lib/api/with-org";

export async function POST(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    const supabase = await createServerClient();

    // Get uncategorized transactions for this org
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, org_id, merchant_name, mcc, description, amount_cents, category_id')
      .eq('org_id', orgId)
      .or('category_id.is.null,needs_review.eq.true')
      .limit(50); // Process up to 50 transactions at a time

    if (txError) {
      console.error('Failed to fetch transactions:', txError);
      return createErrorResponse("Failed to fetch transactions", 500);
    }

    if (!transactions || transactions.length === 0) {
      return Response.json({
        success: true,
        message: "No uncategorized transactions found",
        processed: 0,
        results: []
      });
    }

    // Trigger the categorization edge function by calling it directly
    const edgeFunctionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('/rest/v1', '/functions/v1/jobs-categorize-queue');

    try {
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Edge function failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      return Response.json({
        success: true,
        message: `Triggered categorization for ${transactions.length} transactions`,
        processed: result.processed || 0,
        organizations: result.organizations || 0,
        results: result.results || []
      });

    } catch (edgeError) {
      console.error('Failed to call edge function:', edgeError);

      // Fallback: simple pattern-based categorization
      let processed = 0;

      for (const tx of transactions) {
        try {
          let categoryId = null;
          let confidence = 0.5;

          // Simple pattern matching for common e-commerce expenses
          const description = tx.description?.toLowerCase() || '';
          const merchantName = tx.merchant_name?.toLowerCase() || '';

          if (merchantName.includes('stripe') || description.includes('stripe')) {
            categoryId = '550e8400-e29b-41d4-a716-446655440311'; // Stripe Fees
            confidence = 0.85;
          } else if (merchantName.includes('paypal') || description.includes('paypal')) {
            categoryId = '550e8400-e29b-41d4-a716-446655440312'; // PayPal Fees
            confidence = 0.85;
          } else if (merchantName.includes('shopify') || description.includes('shopify')) {
            categoryId = '550e8400-e29b-41d4-a716-446655440331'; // Shopify Platform
            confidence = 0.85;
          } else if (merchantName.includes('google ads') || merchantName.includes('google adwords')) {
            categoryId = '550e8400-e29b-41d4-a716-446655440322'; // Google Ads
            confidence = 0.9;
          } else if (merchantName.includes('facebook') || merchantName.includes('meta')) {
            categoryId = '550e8400-e29b-41d4-a716-446655440321'; // Meta Ads
            confidence = 0.9;
          } else if (description.includes('rent') || description.includes('lease')) {
            categoryId = '550e8400-e29b-41d4-a716-446655440353'; // Rent & Utilities
            confidence = 0.75;
          } else {
            // Default to "Other Operating Expenses"
            categoryId = '550e8400-e29b-41d4-a716-446655440359'; // Other Operating Expenses
            confidence = 0.6;
          }

          // Update the transaction
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              category_id: categoryId,
              confidence: confidence,
              needs_review: confidence < 0.95,
              reviewed: false,
            })
            .eq('id', tx.id);

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
        note: "Used pattern-based fallback due to edge function unavailability"
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