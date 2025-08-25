import { NextRequest } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  orgCreateRequestSchema,
  type OrgCreateRequest,
  type OrgCreateResponse,
  type OrgId,
} from "@nexus/types/contracts";
import { createErrorResponse, createValidationErrorResponse } from "@/lib/api/with-org";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: OrgCreateRequest;

    try {
      validatedRequest = orgCreateRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // TODO: Implement actual organization creation logic
    // Use validatedRequest for future implementation
    console.log('Creating org with request:', validatedRequest);
    
    // For now, return stubbed response with correct shape
    const stubResponse: OrgCreateResponse = {
      orgId: `org_${Date.now()}` as OrgId,
    };

    return Response.json(stubResponse);
  } catch (error) {
    console.error("Error in POST /api/auth/org/create:", error);
    return createErrorResponse("Internal server error", 500);
  }
}