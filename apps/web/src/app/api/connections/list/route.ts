import { NextRequest } from "next/server";
import { type ConnectionsListResponse, type ConnectionId } from "@nexus/types/contracts";
import { withOrgFromRequest, createErrorResponse } from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { orgId } = await withOrgFromRequest(request);
    const supabase = await createServerClient();

    // Query connections from database
    const { data: connections, error } = await supabase
      .from("connections")
      .select(
        `
        id,
        provider,
        status,
        scopes,
        created_at
      `
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error fetching connections:", error);
      return createErrorResponse("Failed to fetch connections", 500);
    }

    const response: ConnectionsListResponse = {
      connections: (connections || []).map((conn) => ({
        id: conn.id as ConnectionId,
        provider: conn.provider,
        status: conn.status,
        scopes: conn.scopes || [],
        createdAt: conn.created_at,
      })),
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error in GET /api/connections/list:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
