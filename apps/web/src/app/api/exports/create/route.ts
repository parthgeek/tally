import { NextRequest } from "next/server";
import {
  exportsCreateRequestSchema,
  type ExportsCreateRequest,
  type ExportsCreateResponse,
  type ExportId,
} from "@nexus/types/contracts";
import { withOrg, createValidationErrorResponse, createErrorResponse } from "@/lib/api/with-org";

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: ExportsCreateRequest;

    try {
      validatedRequest = exportsCreateRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // Verify org membership
    await withOrg(validatedRequest.orgId);

    // TODO: Implement actual export creation logic
    // For now, return stubbed response with correct shape
    const stubResponse: ExportsCreateResponse = {
      exportId: `export_${validatedRequest.type}_${Date.now()}` as ExportId,
    };

    return Response.json(stubResponse);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in POST /api/exports/create:", error);
    return createErrorResponse("Internal server error", 500);
  }
}