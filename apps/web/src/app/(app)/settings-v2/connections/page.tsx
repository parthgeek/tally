"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function ConnectionsPage() {
  const [status, setStatus] = useState<any>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const APP_STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL || "https://apps.shopify.com/your-app-handle";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "shopify_connected") {
      setSuccess("Connected!");
      (async () => {
        if (params.get("shop")) {
          const user = await supabase.auth.getUser()
          await supabase.from("shopify_connections").update({
            auth_id: user.data.user.id
          }).match({
            shop_domain: params.get("shop")
          });
        }
      })()
      window.history.replaceState({}, "", window.location.pathname);
    }

     (async () => {
       
          const user = await supabase.auth.getUser()
        console.log({user})
        
      })()


    if (params.get("error")) {
      setError(params.get("error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
    fetchStatus();
  }, []);

  async function fetchStatus() {
    const res = await fetch("/api/shopify/sync");
    if (res.ok) {
      setStatus(await res.json());
    }
  }

  function installFromShopify() {
    window.open(APP_STORE_URL, "_blank", "noopener,noreferrer");
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
              <button onClick={installFromShopify} className="px-4 py-2 bg-blue-600 text-white rounded">
                Install on Shopify
              </button>
              <button onClick={() => window.location.href = "/settings/connections?manual=true"} className="px-4 py-2 border rounded">
                Paste store name (fallback)
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Connected to {status.shop_domain}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => window.location.href = `/api/shopify/oauth/start?shop=${status.shop_domain}`}>Reconnect</button>
              <button onClick={async () => {
                if (!confirm("Disconnect?")) return;
                await fetch("/api/shopify/disconnect", { method: "POST", body: JSON.stringify({ shop: status.shop_domain }), headers: { "Content-Type": "application/json" } });
                fetchStatus();
              }}>Disconnect</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
