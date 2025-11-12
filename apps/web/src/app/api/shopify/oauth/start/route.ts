// app/api/shopify/start/route.ts
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_API_KEY!;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || "read_products,read_orders";
const SHOPIFY_CALLBACK = `${process.env.SHOPIFY_APP_HOST?.replace(/\/$/, "")}/api/shopify/oauth/callback`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeShop(raw: string) {
  let s = raw.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!s.endsWith(".myshopify.com")) s = `${s}.myshopify.com`;
  return s;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shopParam = url.searchParams.get("shop");
    if (!shopParam) return NextResponse.json({ error: "Missing shop param" }, { status: 400 });

    const shop = normalizeShop(shopParam);
    const state = randomBytes(16).toString("hex");

    // Persist state -> oauth_states table
    const { error } = await supabase.from("oauth_states").insert({ state, shop });
    if (error) {
      console.error("Failed to persist state:", error);
      return NextResponse.json({ error: "Failed to persist state" }, { status: 500 });
    }

    const redirectUri = encodeURIComponent(SHOPIFY_CALLBACK);
    const scope = encodeURIComponent(SHOPIFY_SCOPES);
    const authorizeUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}&grant_options[]=per-user`;

    return NextResponse.redirect(authorizeUrl);
  } catch (err: any) {
    console.error("Start OAuth error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
