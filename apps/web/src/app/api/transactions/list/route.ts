import { NextRequest } from "next/server";
import {
  transactionsListRequestSchema,
  type TransactionsListRequest,
  type TransactionsListResponse,
  type TransactionId,
  type CategoryId,
} from "@nexus/types/contracts";
import { withOrg, createValidationErrorResponse, createErrorResponse } from "@/lib/api/with-org";

export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    const cursor = url.searchParams.get("cursor") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    if (!orgId) {
      return createErrorResponse("Missing orgId parameter", 400);
    }

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

    // Verify org membership
    await withOrg(validatedRequest.orgId);

    // TODO: Implement actual transactions retrieval logic
    // For now, return stubbed response with correct shape
    const stubResponse: TransactionsListResponse = {
      items: [
        {
          id: `txn_${Date.now()}_1` as TransactionId,
          date: "2024-01-15",
          amountCents: -2500, // $25.00 expense
          currency: "USD",
          description: "Coffee shop purchase",
          merchantName: "Local Coffee Co",
          mcc: "5814",
          categoryId: `cat_food_beverage` as CategoryId,
          confidence: 0.95,
          reviewed: false,
          source: "plaid",
          raw: {
            originalDescription: "LOCAL COFFEE CO    SAN FRANCISCO CA",
            accountId: "acc_123",
          },
        },
        {
          id: `txn_${Date.now()}_2` as TransactionId,
          date: "2024-01-14",
          amountCents: 10000, // $100.00 income
          currency: "USD",
          description: "Service payment",
          merchantName: "Client A",
          categoryId: `cat_income` as CategoryId,
          confidence: 0.88,
          reviewed: true,
          source: "square",
          raw: {
            transactionType: "PAYMENT",
            paymentId: "pay_456",
          },
        },
      ],
      nextCursor: validatedRequest.cursor ? undefined : "cursor_next_page",
    };

    return Response.json(stubResponse);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in GET /api/transactions/list:", error);
    return createErrorResponse("Internal server error", 500);
  }
}