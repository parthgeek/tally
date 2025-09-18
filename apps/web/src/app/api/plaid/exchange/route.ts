import { NextRequest } from "next/server";
import { withOrgFromRequest, createErrorResponse, createValidationErrorResponse } from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import { checkRateLimit, getRateLimitKey, createRateLimitResponse, getRateLimitConfig } from "@/lib/rate-limit-redis";
import { validateRequestBody, plaidExchangeSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    await withOrgFromRequest(request);
    
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }
    
    // Apply rate limiting with error recovery
    try {
      const rateLimitKey = getRateLimitKey(request, user.id);
      const rateLimitResult = await checkRateLimit({
        key: rateLimitKey,
        ...getRateLimitConfig('PLAID_EXCHANGE'),
      });

      if (!rateLimitResult.allowed) {
        return createRateLimitResponse(rateLimitResult.resetTime);
      }
    } catch (rateLimitError) {
      console.warn('Rate limiting failed, proceeding with request:', rateLimitError);
      // Continue without rate limiting if the rate limiter fails
    }
    
    // Get session for access token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return createErrorResponse("No session token", 401);
    }

    // Validate request body
    const validationResult = await validateRequestBody(request, plaidExchangeSchema);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const body = validationResult.data;
    
    // Proxy to Edge Function with session token
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/plaid-exchange`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge function failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`Edge function call failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return Response.json(result);

  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error in Plaid exchange:", error);
    return createErrorResponse("Exchange failed", 500);
  }
}