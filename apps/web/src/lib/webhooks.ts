// lib/webhooks.ts
import { Shopify } from "./shopify";

export async function registerAppUninstallWebhook(shop: string, accessToken: string) {
  const client = new Shopify.Clients.Rest(shop, accessToken);
  await client.post({
    path: "webhooks",
    data: {
      webhook: {
        topic: "app/uninstalled",
        address: `${process.env.SHOPIFY_APP_HOST}/api/shopify/webhooks/app_uninstalled`,
        format: "json"
      }
    },
    type: "application/json"
  });
}
