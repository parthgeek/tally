// lib/shopifySessionStorage.ts
import { Session, SessionStorage } from "@shopify/shopify-api";
import { createClient } from "@supabase/supabase-js";

export class SupabaseSessionStorage implements SessionStorage {
  supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async storeSession(session: Session): Promise<boolean> {
    const record = {
      id: session.id,
      shop: session.shop,
      state: session.state,
      is_online: session.isOnline,
      access_token: session.accessToken ?? null,
      scope: session.scope ?? null,
      expires_at: session.expires ? new Date(session.expires).toISOString() : null,
      data: session,
      updated_at: new Date().toISOString()
    };
    const { error } = await this.supabase
      .from("shopify_sessions")
      .upsert(record, { onConflict: "id" });
    if (error) throw error;
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const { data, error } = await this.supabase
      .from("shopify_sessions")
      .select("data")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data?.data ?? undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    const { error } = await this.supabase.from("shopify_sessions").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  // Optional helpers some versions require:
  async findSessionsByShop(shop: string): Promise<Session[]> {
    const { data, error } = await this.supabase
      .from("shopify_sessions")
      .select("data")
      .eq("shop", shop);
    if (error) throw error;
    return (data || []).map((r: any) => r.data);
  }
}
