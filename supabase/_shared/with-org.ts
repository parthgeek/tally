import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthenticatedContext {
  userId: string;
  orgId: string;
}

export async function withOrgFromJWT(jwt: string): Promise<AuthenticatedContext> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Get org from user's primary org
  const { data: membership } = await supabase
    .from('user_org_roles')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    throw new Response(JSON.stringify({ error: "No organization access" }), { status: 403 });
  }

  return {
    userId: user.id,
    orgId: membership.org_id,
  };
}