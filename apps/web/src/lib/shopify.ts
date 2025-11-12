// lib/shopify.ts
import { Shopify, LATEST_API_VERSION } from "@shopify/shopify-api";
import { SupabaseSessionStorage } from "./shopifySessionStorage";

if (!Shopify.Context.IS_INITIALIZED) {
  Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY!,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET!,
    SCOPES: (process.env.SHOPIFY_SCOPES || "").split(","),
    HOST_NAME: (process.env.SHOPIFY_APP_HOST || "localhost").replace(/^https?:\/\//, ""),
    API_VERSION: process.env.SHOPIFY_API_VERSION || LATEST_API_VERSION,
    IS_EMBEDDED_APP: false, // set true if your app is embedded in Shopify admin
    SESSION_STORAGE: new SupabaseSessionStorage(),
  });
}

export { Shopify };
