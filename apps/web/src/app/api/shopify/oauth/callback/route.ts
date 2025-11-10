import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const shop = searchParams.get("shop");
    const state = searchParams.get("state");
    const hmac = searchParams.get("hmac");
    const error = searchParams.get("error");

    if (error) {
      console.error("Shopify OAuth error:", error);
      return Response.redirect(
        new URL(`/settings/connections?error=${error}`, request.url)
      );
    }

    if (!code || !shop || !state) {
      console.error("Missing OAuth parameters");
      return Response.redirect(
        new URL("/settings/connections?error=missing_params", request.url)
      );
    }

    const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
    if (!shopifyApiSecret) {
      console.error("Missing SHOPIFY_API_SECRET");
      return Response.redirect(
        new URL("/settings/connections?error=config_missing", request.url)
      );
    }

    // Verify HMAC
    if (hmac) {
      const params = new URLSearchParams(searchParams);
      params.delete("hmac");
      params.delete("signature");
      
      const sortedParams = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

      const calculatedHmac = crypto
        .createHmac("sha256", shopifyApiSecret)
        .update(sortedParams)
        .digest("hex");

      if (calculatedHmac !== hmac) {
        console.error("HMAC verification failed");
        return Response.redirect(
          new URL("/settings/connections?error=invalid_hmac", request.url)
        );
      }
    }

    // Verify state
    let orgId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      orgId = stateData.orgId;

      const age = Date.now() - stateData.timestamp;
      if (age > 10 * 60 * 1000) {
        return Response.redirect(
          new URL("/settings/connections?error=state_expired", request.url)
        );
      }
    } catch {
      return Response.redirect(
        new URL("/settings/connections?error=invalid_state", request.url)
      );
    }

    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    if (!shopifyApiKey) {
      return Response.redirect(
        new URL("/settings/connections?error=config_missing", request.url)
      );
    }

    // Exchange code for token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: shopifyApiKey,
        client_secret: shopifyApiSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed");
      return Response.redirect(
        new URL("/settings/connections?error=token_failed", request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scopes = tokenData.scope;

    if (!accessToken) {
      return Response.redirect(
        new URL("/settings/connections?error=no_token", request.url)
      );
    }

    // Store in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error: insertError } = await supabase
      .from("shopify_connections")
      .upsert(
        {
          org_id: orgId,
          shop_domain: shop,
          access_token: accessToken,
          scope: scopes,
          is_active: true,
          installed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" }
      );

    if (insertError) {
      console.error("Failed to store connection:", insertError);
      return Response.redirect(
        new URL("/settings/connections?error=store_failed", request.url)
      );
    }

    console.log("Shopify connected successfully:", shop);

    // Register webhooks
    try {
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-10";
      const webhookUrl = `${process.env.SHOPIFY_APP_HOST}/api/webhooks/shopify`;
      const topics = ["orders/paid", "refunds/create"];

      for (const topic of topics) {
        await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            webhook: { topic, address: webhookUrl, format: "json" },
          }),
        });
      }
    } catch (error) {
      console.error("Webhook registration error:", error);
    }

    return Response.redirect(
      new URL("/settings/connections?success=shopify_connected", request.url)
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return Response.redirect(
      new URL("/settings/connections?error=callback_failed", request.url)
    );
  }
}