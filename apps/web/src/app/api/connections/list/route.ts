import { NextRequest } from "next/server";
import {
  connectionsListRequestSchema,
  type ConnectionsListRequest,
  type ConnectionsListResponse,
  type ConnectionId,
} from "@nexus/types/contracts";
import { withOrg, createValidationErrorResponse, createErrorResponse } from "@/lib/api/with-org";

export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    
    if (!orgId) {
      return createErrorResponse("Missing orgId parameter", 400);
    }

    let validatedRequest: ConnectionsListRequest;
    try {
      validatedRequest = connectionsListRequestSchema.parse({ orgId });
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // Verify org membership
    await withOrg(validatedRequest.orgId);

    // TODO: Implement actual connections retrieval logic
    // For now, return stubbed response with correct shape
    const stubResponse: ConnectionsListResponse = {
      connections: [
        {
          id: `conn_${Date.now()}_1` as ConnectionId,
          provider: "plaid",
          status: "active",
          scopes: ["transactions", "accounts"],
          createdAt: new Date().toISOString(),
        },
        {
          id: `conn_${Date.now()}_2` as ConnectionId,
          provider: "square",
          status: "active",
          scopes: ["transactions"],
          createdAt: new Date().toISOString(),
        },
      ],
    };

    return Response.json(stubResponse);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in GET /api/connections/list:", error);
    return createErrorResponse("Internal server error", 500);
  }
}