import { NextRequest } from "next/server";
import {
  type ConnectionDisconnectRequest,
  type ConnectionDisconnectResponse,
  connectionDisconnectRequestSchema,
} from "@nexus/types/contracts";
import {
  withOrgFromRequest,
  createErrorResponse,
  createValidationErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import {
  checkRateLimit,
  getRateLimitKey,
  createRateLimitResponse,
  getRateLimitConfig,
} from "@/lib/rate-limit-redis";
import { validateRequestBody } from "@/lib/validation";

export async function DELETE(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { orgId } = await withOrgFromRequest(request);
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }

    // Apply rate limiting for security
    try {
      const rateLimitKey = getRateLimitKey(request, user.id);
      const rateLimitResult = await checkRateLimit({
        key: rateLimitKey,
        ...getRateLimitConfig("CONNECTION_DISCONNECT"),
      });

      if (!rateLimitResult.allowed) {
        return createRateLimitResponse(rateLimitResult.resetTime);
      }
    } catch (rateLimitError) {
      console.warn("Rate limiting failed, proceeding with request:", rateLimitError);
      // Continue without rate limiting if the rate limiter fails
    }

    // Get session for access token to call Edge Function
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return createErrorResponse("No session token", 401);
    }

    // Validate request body
    const validationResult: any = await validateRequestBody(request, connectionDisconnectRequestSchema);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const body: ConnectionDisconnectRequest = validationResult.data;

    // Verify connection belongs to this org before attempting disconnect
    const { data: connection, error: connectionError } = await supabase
      .from("connections")
      .select("id, provider, status, org_id")
      .eq("id", body.connectionId)
      .eq("org_id", orgId)
      .single();

    if (connectionError || !connection) {
      console.error("Connection verification failed:", {
        error: connectionError,
        connectionId: body.connectionId,
        orgId,
        userId: user.id,
      });
      return createErrorResponse("Connection not found or access denied", 404);
    }

    // Check if already disconnected
    if (connection.status === "disconnected") {
      const response: ConnectionDisconnectResponse = {
        success: true,
        message: "Connection already disconnected",
      };
      return Response.json(response);
    }

    // Only handle Plaid connections for now
    if (connection.provider !== "plaid") {
      return createErrorResponse("Disconnect not supported for this provider", 400);
    }

    // Call the appropriate Edge Function based on provider
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/plaid-disconnect`;

    const response = await fetch(edgeFunctionUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        connectionId: body.connectionId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Edge function disconnect failed:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        connectionId: body.connectionId,
        orgId,
        userId: user.id,
      });

      // Parse error message if possible
      let errorMessage = "Disconnect failed";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.details || errorData.error || errorMessage;
      } catch {
        // Use default error message if parsing fails
      }

      return createErrorResponse(errorMessage, response.status);
    }

    const result = await response.json();

    // Return standardized response
    const disconnectResponse: ConnectionDisconnectResponse = {
      success: result.success || true,
      message: result.message || "Bank account disconnected successfully",
    };

    return Response.json(disconnectResponse);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error in DELETE /api/connections/disconnect:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
