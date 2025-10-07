import { NextRequest } from "next/server";
import { withOrgFromRequest, createErrorResponse } from "@/lib/api/with-org";
import { createLinkToken, PlaidClientError, PlaidError } from "@/lib/plaid/client";
import {
  checkRateLimit,
  getRateLimitKey,
  createRateLimitResponse,
  getRateLimitConfig,
} from "@/lib/rate-limit-redis";

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await withOrgFromRequest(request);

    // Apply rate limiting
    const rateLimitKey = getRateLimitKey(request, userId);
    const rateLimitResult = await checkRateLimit({
      key: rateLimitKey,
      ...getRateLimitConfig("PLAID_LINK_TOKEN"),
    });

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.resetTime);
    }

    const linkToken = await createLinkToken({
      userId,
      orgId,
      webhookUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/plaid-webhook`,
    });

    return Response.json({ linkToken });
  } catch (error) {
    if (error instanceof Response) return error;

    if (error instanceof PlaidClientError) {
      const statusCode = error.code === PlaidError.RATE_LIMIT ? 429 : 400;
      return createErrorResponse(`Plaid error: ${error.message}`, statusCode);
    }

    console.error("Error creating Plaid link token:", error);
    return createErrorResponse("Failed to create link token", 500);
  }
}
