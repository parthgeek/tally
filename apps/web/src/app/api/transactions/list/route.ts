import { NextRequest } from "next/server";
import {
  transactionsListRequestSchema,
  type TransactionsListRequest,
  type TransactionsListResponse,
  type TransactionId,
  type CategoryId,
} from "@nexus/types/contracts";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { orgId } = await withOrgFromRequest(request);

    // Parse and validate query parameters
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    let validatedRequest: TransactionsListRequest;
    try {
      validatedRequest = transactionsListRequestSchema.parse({
        orgId,
        cursor,
        limit,
      });
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // Query transactions from database
    const supabase = await createServerClient();

    const queryLimit = validatedRequest.limit || 50;
    let query = supabase
      .from("transactions")
      .select(
        `
        id,
        date,
        amount_cents,
        currency,
        description,
        merchant_name,
        mcc,
        source,
        provider_tx_id,
        reviewed,
        category_id,
        confidence,
        needs_review,
        raw,
        created_at,
        accounts!inner(id, name, type),
        categories(id, name, slug)
      `
      )
      .eq("org_id", validatedRequest.orgId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(queryLimit + 1); // Get one extra to check for next page

    // Handle cursor-based pagination
    if (validatedRequest.cursor) {
      // Simple cursor implementation using created_at timestamp
      const cursorDate = new Date(validatedRequest.cursor);
      query = query.lt("created_at", cursorDate.toISOString());
    }

    const { data: rawTransactions, error } = await query;

    if (error) {
      console.error("Database error fetching transactions:", error);
      return createErrorResponse("Failed to fetch transactions", 500);
    }

    // Check if we have more pages
    const hasMore = rawTransactions.length > queryLimit;
    const transactions = hasMore ? rawTransactions.slice(0, queryLimit) : rawTransactions;

    // Transform to contract format
    const transformedTransactions = transactions.map((tx) => ({
      id: tx.id as TransactionId,
      date: tx.date,
      amountCents: parseInt(tx.amount_cents),
      currency: tx.currency,
      description: tx.description,
      merchantName: tx.merchant_name || undefined,
      mcc: tx.mcc || undefined,
      categoryId: (tx.category_id || undefined) as CategoryId | undefined,
      confidence: tx.confidence !== null && tx.confidence !== undefined ? tx.confidence : undefined,
      reviewed: tx.reviewed || false,
      source: tx.source,
      raw: tx.raw,
    }));

    const nextCursor =
      hasMore && transactions.length > 0
        ? transactions[transactions.length - 1]?.created_at
        : undefined;

    const response: TransactionsListResponse = {
      items: transformedTransactions,
      nextCursor,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in GET /api/transactions/list:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
