import { NextRequest } from "next/server";
import {
  connectionsCreateRequestSchema,
  type ConnectionsCreateRequest,
  type ConnectionsCreateResponse,
  type ConnectionId,
} from "@nexus/types/contracts";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";

export async function POST(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { orgId } = await withOrgFromRequest(request);

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: ConnectionsCreateRequest;

    try {
      validatedRequest = connectionsCreateRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // Ensure the orgId in the request matches the authenticated org
    if (validatedRequest.orgId !== orgId) {
      return createErrorResponse("Organization ID mismatch", 403);
    }

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
