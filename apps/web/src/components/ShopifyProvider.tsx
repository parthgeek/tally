// components/ShopifyProvider.tsx
"use client";

import React from "react";
import { Provider } from "@shopify/app-bridge-react";

interface Props {
  children: React.ReactNode;
  apiKey: string;
  host?: string | null;
  forceRedirect?: boolean; // true typically for embedded apps
}

/**
 * Wrap your embedded pages with <ShopifyProvider apiKey={...} host={...}>
 * - host should come from the URL query param "host" (Shopify passes it).
 * - If host is missing, App Bridge will not initialize (app is being loaded outside admin).
 */
export default function ShopifyProvider({ children, apiKey, host, forceRedirect = true }: Props) {
  const config: any = {
    apiKey,
    host: host ?? undefined,
    forceRedirect,
  };

  return <Provider config={config}>{children}</Provider>;
}
