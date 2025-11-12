// app/api/shopify/oauth/callback/route.ts
import { NextResponse } from "next/server";
import { Shopify } from "@/lib/shopify";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const res = NextResponse.next();
    // Shopify will call with code/hmac/state/shop/...; validateAuthCallback validates HMAC/state.
    const session = await Shopify.Auth.validateAuthCallback(req as any, res as any, new URL(req.url).searchParams); // returns Session

    // Persist shop-level connection for your app (simplified)
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await supabase.from("shopify_connections").upsert({
      shop_domain: session.shop,
      access_token: session.accessToken,
      is_online: session.isOnline,
      installed_at: new Date().toISOString(),
      is_active: true
    }, { onConflict: "shop_domain" });

    // register webhooks or initial sync here (see next section)
    // e.g. await registerWebhooks(session.shop, session.accessToken);

    // redirect back to your app UI
    return NextResponse.redirect(new URL("/settings/connections?success=shopify_connected", process.env.SHOPIFY_APP_HOST!));
  } catch (err) {
    console.error("callback error", err);
    return NextResponse.redirect(new URL("/settings/connections?error=auth_callback", process.env.SHOPIFY_APP_HOST!));
  }
}
