import { NextRequest } from "next/server";
import {
  categorizeRunRequestSchema,
  type CategorizeRunRequest,
  type CategorizeRunResponse,
  type CategoryId,
} from "@nexus/types/contracts";
import { withOrg, createValidationErrorResponse, createErrorResponse } from "@/lib/api/with-org";

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: CategorizeRunRequest;

    try {
      validatedRequest = categorizeRunRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // Verify org membership
    await withOrg(validatedRequest.orgId);

    // TODO: Implement actual AI categorization logic
    // For now, return stubbed response with correct shape
    const stubResponse: CategorizeRunResponse = {
      results: validatedRequest.transactionIds.map((id, index) => ({
        id,
        categoryId: `cat_${index % 2 === 0 ? 'office_supplies' : 'meals_entertainment'}` as CategoryId,
        confidence: Math.random() * 0.3 + 0.7, // Random confidence between 0.7-1.0
        rationale: index % 3 === 0 
          ? "Based on merchant name and description pattern, this appears to be a business expense"
          : undefined,
      })),
    };

    return Response.json(stubResponse);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in POST /api/categorize/run:", error);
    return createErrorResponse("Internal server error", 500);
  }
}