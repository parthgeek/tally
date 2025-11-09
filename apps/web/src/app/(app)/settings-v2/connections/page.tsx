"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Store, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  shopDomain?: string;
  lastSyncedAt?: string;
  ordersCount?: number;
}

export default function ConnectionsPage() {
  const [shopDomain, setShopDomain] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConnectForm, setShowConnectForm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "shopify_connected") {
      setSuccess("Shopify connected successfully!");
      window.history.replaceState({}, "", "/settings/connections");
    }
    if (params.get("error")) {
      setError(`Connection failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/settings/connections");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/shopify/sync");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Error fetching status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectClick = () => {
    setShowConnectForm(true);
    setError(null);
  };

  const handleConnect = async () => {
    if (!shopDomain.trim()) {
      setError("Please enter your Shopify store name");
      return;
    }

    setIsConnecting(true);
    setError(null);

    let domain = shopDomain.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/\/$/, "");
    domain = domain.replace(/\.myshopify\.com$/, "");

    if (!domain) {
      setError("Please enter a valid store name");
      setIsConnecting(false);
      return;
    }

    // Redirect directly to OAuth with the shop parameter
    window.location.href = `/api/shopify/oauth/start?shop=${encodeURIComponent(domain)}`;
  };

  const handleCancelConnect = () => {
    setShowConnectForm(false);
    setShopDomain("");
    setError(null);
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Shopify store?")) return;

    try {
      const response = await fetch("/api/shopify/disconnect", {
        method: "POST",
      });

      if (response.ok) {
        setSuccess("Disconnected successfully");
        setShowConnectForm(false);
        fetchStatus();
      } else {
        setError("Failed to disconnect");
      }
    } catch (err) {
      setError("Failed to disconnect");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Connections</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Shopify store to sync orders and refunds
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <CardTitle>Shopify</CardTitle>
            </div>
            {status?.connected && (
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Connected
              </Badge>
            )}
          </div>
          <CardDescription>
            Connect your Shopify store to automatically sync data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status?.connected ? (
            showConnectForm ? (
              // Connect Form
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shop">Shopify Store Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="shop"
                      placeholder="your-store-name"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                      disabled={isConnecting}
                      className="flex-1"
                    />
                    <span className="flex items-center px-3 bg-muted text-sm rounded-md border">
                      .myshopify.com
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Just enter your store name, we'll add .myshopify.com automatically
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleConnect}
                    disabled={isConnecting || !shopDomain.trim()}
                    className="flex-1"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Store className="mr-2 h-4 w-4" />
                        Connect Store
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelConnect}
                    disabled={isConnecting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Connect Button
              <div className="text-center py-6">
                <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Connect Your Shopify Store</h3>
                <p className="text-muted-foreground mb-6">
                  One-click setup to sync your orders, refunds, and sales data automatically.
                </p>
                <Button
                  onClick={handleConnectClick}
                  size="lg"
                >
                  <Store className="mr-2 h-4 w-4" />
                  Connect Shopify Store
                </Button>
              </div>
            )
          ) : (
            // Connected State
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Store</p>
                  <p className="font-medium">{status.shopDomain}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Orders</p>
                  <p className="font-medium">{status.ordersCount || 0}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() =>
                    (window.location.href = `/api/shopify/oauth/start?shop=${status.shopDomain}`)
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Reconnect
                </Button>
                <Button variant="destructive" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}