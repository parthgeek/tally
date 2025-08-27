import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { OrgId } from "@nexus/types/contracts";
import { createServerClient } from "@/lib/supabase";

export interface AuthenticatedContext {
  userId: string;
  orgId: OrgId;
}

export async function withOrg(orgId: OrgId): Promise<AuthenticatedContext> {
  const supabase = await createServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check user belongs to organization
  const { data: membership, error: membershipError } = await supabase
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (membershipError || !membership) {
    throw new Response(
      JSON.stringify({ error: "Access denied to organization" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return {
    userId: user.id,
    orgId,
  };
}

export async function withOrgFromRequest(request: NextRequest): Promise<AuthenticatedContext> {
  const supabase = await createServerClient();
  const cookieStore = await cookies();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve orgId from precedence: x-org-id header → orgId cookie → query param
  let orgId: string | null = null;

  // Try x-org-id header first
  const headerOrgId = request.headers.get("x-org-id");
  if (headerOrgId) {
    orgId = headerOrgId;
  }

  // Fall back to orgId cookie
  if (!orgId) {
    const cookieOrgId = cookieStore.get("orgId")?.value;
    if (cookieOrgId) {
      orgId = cookieOrgId;
    }
  }

  // Fall back to query parameter
  if (!orgId) {
    const url = new URL(request.url);
    const queryOrgId = url.searchParams.get("orgId");
    if (queryOrgId) {
      orgId = queryOrgId;
    }
  }

  if (!orgId) {
    throw new Response(
      JSON.stringify({ error: "Organization ID is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Verify membership in the resolved organization
  const { data: membership, error: membershipError } = await supabase
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (membershipError || !membership) {
    throw new Response(
      JSON.stringify({ error: "Access denied to organization" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return {
    userId: user.id,
    orgId: orgId as OrgId,
  };
}

export function createErrorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function createValidationErrorResponse(error: unknown) {
  return Response.json(
    {
      error: "Validation failed",
      details: error,
    },
    { status: 400 },
  );
}