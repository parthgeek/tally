import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.redirect(
        new URL("/login?error=unauthorized", request.url)
      );
    }

    const { data: userOrgRole } = await supabase
      .from("user_org_roles")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("User ID:", user.id);
    console.log("User Org Role:", userOrgRole);

    if (!userOrgRole) {
      return Response.redirect(
        new URL("/onboarding?error=no_org", request.url)
      );
    }

    const orgId = userOrgRole.org_id;
    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    const shopifyAppHost = process.env.SHOPIFY_APP_HOST;

    if (!shopifyApiKey || !shopifyAppHost) {
      console.error("Missing Shopify configuration");
      return Response.redirect(
        new URL("/settings/connections?error=config_missing", request.url)
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const shop = searchParams.get("shop");

    // FIX: Redirect to connect page if no shop parameter
    if (!shop) {
      return Response.redirect(
        new URL("/shopify/connect", request.url)
      );
    }

    let shopDomain = shop.trim().toLowerCase();
    
    if (!shopDomain.includes(".myshopify.com")) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }

    const shopDomainRegex = /^[a-z0-9-]+\.myshopify\.com$/;
    if (!shopDomainRegex.test(shopDomain)) {
      return Response.redirect(
        new URL("/settings/connections?error=invalid_shop_domain", request.url)
      );
    }

   const scopes = process.env.SHOPIFY_SCOPES || "read_customers,read_orders,read_products";

    const redirectUri = `${shopifyAppHost}/api/shopify/oauth/callback`;

    const state = Buffer.from(
      JSON.stringify({
        orgId,
        userId: user.id,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(7),
      })
    ).toString("base64");

    const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", shopifyApiKey);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("grant_options[]", "per-user");

    console.log("Starting Shopify OAuth:", { shop: shopDomain, orgId });

    return Response.redirect(authUrl.toString());
  } catch (error) {
    console.error("OAuth start error:", error);
    return Response.redirect(
      new URL("/settings/connections?error=oauth_failed", request.url)
    );
  }
}