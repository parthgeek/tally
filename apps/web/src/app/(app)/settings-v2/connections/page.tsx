"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {getCurrentOrgId} from '@/lib/lib-get-current-org'
interface ShopifyConnection {
  id: string;
  shop_domain: string;
  is_active: boolean;
  last_synced_at: string | null;
  installed_at: string | null;
  scope: string;
  created_at: string;
  updated_at: string;
}

export default function ConnectionsPage() {
  const [connection, setConnection] = useState<ShopifyConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const APP_STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL || "https://apps.shopify.com/your-app-handle";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get("success") === "shopify_connected") {
      setSuccess("Successfully connected to Shopify!");
      (async () => {
        if (params.get("shop")) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("shopify_connections")
              .update({ auth_id: user.id,org_id:getCurrentOrgId() })
              .eq("shop_domain", params.get("shop"));
          }
        }
      })();
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (params.get("error")) {
      setError(params.get("error") || "An error occurred");
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetchConnection();
  }, []);

  async function fetchConnection() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Not authenticated");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("shopify_connections")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Error fetching connection:", fetchError);
      }

      setConnection(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!connection || !confirm("Are you sure you want to disconnect your Shopify store?")) {
      return;
    }

    try {
      const res = await fetch("/api/shopify/disconnect", {
        method: "POST",
        body: JSON.stringify({ shop: connection.shop_domain }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setSuccess("Successfully disconnected");
        fetchConnection();
      } else {
        setError("Failed to disconnect");
      }
    } catch (err) {
      setError("An error occurred while disconnecting");
    }
  }

  function installFromShopify() {
    window.open(APP_STORE_URL, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-800 rounded w-1/3 mb-6"></div>
          <div className="h-96 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Shopify Connection</h1>
      <p className="text-gray-400 mb-6">Manage your Shopify store integration</p>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="text-red-300">
            <strong className="font-semibold">Error: </strong>
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-800 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="text-green-300">{success}</div>
        </div>
      )}

      {/* Connection Status Card */}
      {connection && connection.is_active ? (
        <div className="rounded-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-white">
                <h2 className="text-xl font-semibold text-white">Connected</h2>
                <p className="text-sm text-gray-300">Your Shopify store is active</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Store Domain</label>
                <p className="text-gray-200 font-mono text-sm px-3 py-2 rounded">
                  {connection.shop_domain}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Status</label>
                <span className="inline-block px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-700">
                  Active
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Connected Since</label>
                <p className="text-gray-200">
                  {connection.installed_at 
                    ? new Date(connection.installed_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'N/A'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Last Synced</label>
                <p className="text-gray-200">
                  {connection.last_synced_at
                    ? new Date(connection.last_synced_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Never'}
                </p>
              </div>
            </div>

            {connection.scope && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-500 mb-2">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {connection.scope.split(',').map((permission) => (
                    <span
                      key={permission}
                      className="inline-block px-3 py-1 rounded-md text-sm font-medium bg-indigo-100 text-indigo-600"
                    >
                      {permission.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
        </div>
      ) : (
        /* Not Connected State */
        <div className="rounded-lg overflow-hidden">
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-6">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-200 mb-3">Connect Your Shopify Store</h2>
            <p className="text-gray-200 mb-8 max-w-md mx-auto">
              Install our app from the Shopify App Store to sync your products, orders, and customers automatically.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={installFromShopify}
                className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                Install on Shopify
              </button>
            
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-300 mb-1">Need Help?</h3>
        <p className="text-sm text-blue-200">
          If you're experiencing issues connecting your store, please contact our support team or check the documentation.
        </p>
      </div>
    </div>
  );
}