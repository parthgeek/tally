import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { OrgId } from "@nexus/types/contracts";

export interface AuthenticatedContext {
  userId: string;
  orgId: OrgId;
}

export async function withOrg(orgId: OrgId): Promise<AuthenticatedContext> {
  const supabase = createServerComponentClient({ cookies });

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