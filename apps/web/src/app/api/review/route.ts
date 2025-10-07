import { NextRequest } from "next/server";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import {
  reviewListRequestSchema,
  type ReviewListRequest,
  type ReviewListResponse,
  type ReviewTransactionItem,
} from "@nexus/types";

/**
 * GET /api/review
 *
 * High-performance review queue API with cursor-based pagination.
 * Supports filtering by review status, confidence levels, and search.
 *
 * Query Parameters:
 * - cursor?: string - Cursor for pagination
 * - limit?: number - Max items per page (1-1000, default 100)
 * - filter.needsReviewOnly?: boolean - Only show transactions needing review (default true)
 * - filter.minConfidence?: number - Minimum confidence threshold (0-1, default 0)
 * - filter.maxConfidence?: number - Maximum confidence threshold (0-1, default 1)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    // Parse and validate query parameters
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    let validatedRequest: ReviewListRequest;
    try {
      validatedRequest = reviewListRequestSchema.parse({
        cursor: searchParams.get("cursor") || undefined,
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
        filter: {
          needsReviewOnly: searchParams.get("needsReviewOnly") !== "false",
          minConfidence: searchParams.get("minConfidence")
            ? parseFloat(searchParams.get("minConfidence")!)
            : undefined,
          maxConfidence: searchParams.get("maxConfidence")
            ? parseFloat(searchParams.get("maxConfidence")!)
            : undefined,
        },
      });
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    const supabase = await createServerClient();

    // Build optimized query using the review_queue view for better performance
    let query = supabase
      .from("review_queue")
      .select(
        `
        id,
        date,
        merchant_name,
        description,
        amount_cents,
        currency,
        category_id,
        category_name,
        confidence,
        needs_review,
        rationale,
        decision_source,
        decision_confidence,
        decision_created_at
      `
      )
      .eq("org_id", orgId);

    // Apply filters
    if (validatedRequest.filter?.needsReviewOnly) {
      query = query.eq("needs_review", true);
    }

    if (
      validatedRequest.filter?.minConfidence !== undefined &&
      validatedRequest.filter.minConfidence > 0
    ) {
      query = query.gte("confidence", validatedRequest.filter.minConfidence);
    }

    if (
      validatedRequest.filter?.maxConfidence !== undefined &&
      validatedRequest.filter.maxConfidence < 1
    ) {
      query = query.lte("confidence", validatedRequest.filter.maxConfidence);
    }

    // Apply cursor-based pagination
    if (validatedRequest.cursor) {
      try {
        const cursorData = JSON.parse(Buffer.from(validatedRequest.cursor, "base64").toString());
        query = query.or(
          `date.lt.${cursorData.date},and(date.eq.${cursorData.date},confidence.gt.${cursorData.confidence || 0})`
        );
      } catch (error) {
        return createErrorResponse("Invalid cursor format", 400);
      }
    }

    // Order for consistent pagination (date DESC, confidence ASC for prioritizing low-confidence items)
    query = query
      .order("date", { ascending: false })
      .order("confidence", { ascending: true, nullsFirst: false })
      .limit(validatedRequest.limit + 1); // Fetch one extra to determine if there are more pages

    const { data: rawTransactions, error } = await query;

    if (error) {
      console.error("Failed to fetch review queue:", error);
      return createErrorResponse("Failed to fetch review queue", 500);
    }

    // Process results for response
    const transactions = rawTransactions || [];
    const hasMore = transactions.length > validatedRequest.limit;
    const items = transactions.slice(0, validatedRequest.limit);

    // Transform database results to API format
    const reviewItems: ReviewTransactionItem[] = items.map((tx: any) => {
      // Extract rationale strings from the JSONB rationale field
      let rationaleStrings: string[] = [];
      if (tx.rationale) {
        try {
          if (Array.isArray(tx.rationale)) {
            rationaleStrings = tx.rationale.slice(0, 3); // Take top 3 reasons
          } else if (typeof tx.rationale === "object" && tx.rationale.reasons) {
            rationaleStrings = tx.rationale.reasons.slice(0, 3);
          } else if (typeof tx.rationale === "string") {
            rationaleStrings = [tx.rationale];
          }
        } catch (e) {
          console.warn("Failed to parse rationale for transaction", tx.id, e);
          rationaleStrings = [];
        }
      }

      return {
        id: tx.id,
        date: tx.date,
        merchant_name: tx.merchant_name,
        description: tx.description,
        amount_cents: tx.amount_cents,
        currency: tx.currency || "USD",
        category_id: tx.category_id,
        category_name: tx.category_name,
        confidence: tx.confidence,
        needs_review: tx.needs_review,
        why: rationaleStrings,
        decision_source: tx.decision_source,
        decision_created_at: tx.decision_created_at,
      };
    });

    // Generate next cursor if there are more items
    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      if (lastItem) {
        const cursorData = {
          date: lastItem.date,
          confidence: lastItem.confidence || 0,
        };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
      }
    }

    const response: ReviewListResponse = {
      items: reviewItems,
      nextCursor,
      hasMore,
      totalCount: undefined, // Expensive to calculate with cursor pagination - omit for performance
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error in GET /api/review:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
