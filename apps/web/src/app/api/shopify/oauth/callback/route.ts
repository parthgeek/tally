// app/api/shopify/oauth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    // Extract OAuth parameters
    const code = params.get("code");
    const hmac = params.get("hmac");
    const shop = params.get("shop");
    const state = params.get("state");

    // Validate required parameters
    if (!code || !hmac || !shop || !state) {
      throw new Error("Missing required OAuth parameters");
    }

    // 1. Verify HMAC signature
    const queryParams = Object.fromEntries(params.entries());
    delete queryParams.hmac; // Remove hmac from params for verification

    const message = Object.keys(queryParams)
      .sort()
      .map(key => `${key}=${queryParams[key]}`)
      .join("&");

    const generatedHash = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
      .update(message)
      .digest("hex");

    if (generatedHash !== hmac) {
      throw new Error("HMAC validation failed");
    }

    // 2. Verify state parameter (retrieve from session/cookie)
    // You should have stored this state when initiating OAuth
    // For now, we'll skip this check - implement based on your state storage

    // 3. Exchange authorization code for access token
    const accessTokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY!,
          client_secret: process.env.SHOPIFY_API_SECRET!,
          code: code,
        }),
      }
    );

    if (!accessTokenResponse.ok) {
      throw new Error("Failed to exchange code for access token");
    }

    const accessTokenData = await accessTokenResponse.json();
    const accessToken = accessTokenData.access_token;
    const scope = accessTokenData.scope;

    // 4. Persist shop connection in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("shopify_connections")
      .upsert(
        {
          shop_domain: shop,
          access_token: accessToken,
          scope: scope,
          is_online: false, // This is an offline token by default
          installed_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "shop_domain" }
      );

    // 5. Register webhooks (optional - add your webhook registration here)
    // await registerWebhooks(shop, accessToken);

    // 6. Redirect back to your app
    return NextResponse.redirect(
      new URL(
        "/settings/connections?success=shopify_connected",
        process.env.NEXT_PUBLIC_APP_URL || req.url
      )
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(
        "/settings/connections?error=auth_callback",
        process.env.NEXT_PUBLIC_APP_URL || req.url
      )
    );
  }
}