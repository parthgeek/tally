import { NextRequest } from "next/server";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import {
  transactionDeleteRequestSchema,
  type TransactionDeleteRequest,
  type TransactionDeleteResponse,
} from "@nexus/types/contracts";
import { captureException } from "@nexus/analytics";
import { getPosthogClientServer } from "@nexus/analytics/server";
import { ANALYTICS_EVENTS, type TransactionsDeletedProps } from "@nexus/types";

/**
 * DELETE /api/transactions/delete
 *
 * Bulk deletion endpoint for removing transactions from the database.
 * Creates audit trail and tracks analytics.
 *
 * Request Body:
 * - txIds: string[] - Array of transaction IDs (1-100 items)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: TransactionDeleteRequest;
    try {
      validatedRequest = transactionDeleteRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    const supabase = await createServerClient();

    // Execute deletion using database function for atomicity
    const { data: deleteResult, error: deleteError } = await supabase.rpc("delete_transactions", {
      p_tx_ids: validatedRequest.txIds,
      p_org_id: orgId,
      p_user_id: userId,
    });

    if (deleteError) {
      console.error("Failed to execute transaction deletion:", deleteError);
      return createErrorResponse("Failed to delete transactions", 500);
    }

    const result = deleteResult?.[0];
    if (!result) {
      return createErrorResponse("Unexpected error in deletion", 500);
    }

    // Parse errors array safely
    const errors = result.errors && Array.isArray(result.errors) ? result.errors : [];
    const successCount = result.deleted_count || 0;

    // Track analytics event
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        const analyticsProps: TransactionsDeletedProps = {
          org_id: orgId,
          user_id: userId,
          transaction_count: validatedRequest.txIds.length,
          deleted_count: successCount,
          error_count: errors.length,
        };

        await posthog.capture({
          distinctId: userId,
          event: ANALYTICS_EVENTS.TRANSACTIONS_DELETED,
          properties: analyticsProps,
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture deletion analytics:", analyticsError);
      // Don't fail the request if analytics fails
    }

    // Prepare response
    const response: TransactionDeleteResponse = {
      success: successCount > 0,
      deleted_count: successCount,
      message:
        errors.length > 0
          ? `Deleted ${successCount} transaction(s) with ${errors.length} error(s)`
          : `Successfully deleted ${successCount} transaction(s)`,
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

    console.error("Error in DELETE /api/transactions/delete:", error);

    try {
      await captureException(error instanceof Error ? error : new Error("Unknown deletion error"));
    } catch (analyticsError) {
      console.error("Failed to capture exception:", analyticsError);
    }

    return createErrorResponse("Internal server error", 500);
  }
}
