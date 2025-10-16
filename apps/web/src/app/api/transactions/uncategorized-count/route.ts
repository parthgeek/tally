import { NextRequest } from "next/server";
import { withOrgFromRequest, createErrorResponse } from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/transactions/uncategorized-count
 * 
 * Returns the count of uncategorized transactions for the current org.
 * Used by the UI to show categorization progress.
 */
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await withOrgFromRequest(request);
    const supabase = await createServerClient();

    // Use the database function to get uncategorized count
    const { data, error } = await supabase
      .rpc('get_orgs_with_uncategorized_transactions')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      console.error('Failed to get uncategorized count:', error);
      return createErrorResponse('Failed to get uncategorized count', 500);
    }

    return Response.json({
      uncategorizedCount: data?.uncategorized_count || 0,
      oldestUncategorized: data?.oldest_uncategorized || null
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Cache for 5 seconds to reduce load during polling
        'Cache-Control': 's-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error('Error in GET /api/transactions/uncategorized-count:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

