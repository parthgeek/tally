import { NextRequest } from "next/server";
import {
  connectionsCreateRequestSchema,
  type ConnectionsCreateRequest,
  type ConnectionsCreateResponse,
  type ConnectionId,
} from "@nexus/types/contracts";
import { withOrg, createValidationErrorResponse, createErrorResponse } from "@/lib/api/with-org";

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: ConnectionsCreateRequest;

    try {
      validatedRequest = connectionsCreateRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // Verify org membership
    await withOrg(validatedRequest.orgId);

    // TODO: Implement actual connection creation logic
    // For now, return stubbed response with correct shape
    const stubResponse: ConnectionsCreateResponse = {
      connectionId: `conn_${Date.now()}_${validatedRequest.provider}` as ConnectionId,
    };

    return Response.json(stubResponse);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in POST /api/connections/create:", error);
    return createErrorResponse("Internal server error", 500);
  }
}