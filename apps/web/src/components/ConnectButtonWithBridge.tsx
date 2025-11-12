"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ShopifyProvider from "@/components/ShopifyProvider";
import ConnectButtonWithBridge from "@/components/ConnectButtonWithBridge";

// If your components live elsewhere, adjust imports accordingly.

export default function ConnectionsPageWrapper() {
  // read host param from query so App Bridge can init when embedded
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostParam = params.get("host");
    setHost(hostParam);
  }, []);

  // Pass NEXT_PUBLIC_SHOPIFY_API_KEY from env (client-exposed)
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

  return (
    <ShopifyProvider apiKey={apiKey} host={host ?? undefined}>
      <ConnectionsPage />
    </ShopifyProvider>
  );
}

function ConnectionsPage() {
  const [status, setStatus] = useState<any>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "shopify_connected") {
      setSuccess("Connected!");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("error")) {
      setError(params.get("error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
    fetchStatus();
  }, []);

  async function fetchStatus() {
    const res = await fetch("/api/shopify/sync");
    if (res.ok) setStatus(await res.json());
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Shopify Connection</h1>

      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">{success}</div>}

      <div className="p-4 rounded shadow">
        {!status?.is_active ? (
          <>
            <p>Click the button below to install the app (Shopify will send your store automatically):</p>
            <div className="mt-4 flex gap-2">
              {/* App Bridge connect: removes need for merchant to type domain */}
              <ConnectButtonWithBridge />
              <button onClick={() => window.location.href = "/settings/connections?manual=true"} className="px-4 py-2 border rounded">
                Paste store name (fallback)
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Connected to {status.shop_domain}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => window.location.href = `/api/shopify/start?shop=${status.shop_domain}`}>Reconnect</button>
              <button onClick={async () => {
                if (!confirm("Disconnect?")) return;
                await fetch("/api/shopify/disconnect", { method: "POST", body: JSON.stringify({ shop: status.shop_domain }), headers: { "Content-Type": "application/json" }});
                fetchStatus();
              }}>Disconnect</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
