"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Building,
  Link as LinkIcon,
  Database,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { ConnectShopifyButton } from "@/components/connect-shopify-button";

interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  default_timezone: string | null;
  region: string | null;
  updated_at: string | null;
}

interface Connection {
  id: string;
  provider: string;
  status: string;
}

const sections = [
  { id: "basics", label: "Basics", icon: Building },
  { id: "integrations", label: "Integrations", icon: LinkIcon },
  { id: "data-policy", label: "Data Policy", icon: Database },
];

export default function WorkspacePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState("basics");

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [defaultTimezone, setDefaultTimezone] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchWorkspace();
    fetchConnections();
  }, []);

  const fetchWorkspace = async () => {
    try {
      // Get current org from cookie
      const cookies = document.cookie.split(";");
      const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
      const currentOrgId = orgCookie ? orgCookie.split("=")[1] : null;

      if (!currentOrgId) {
        setError("No workspace selected");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from("orgs").select("*").eq("id", currentOrgId).single();

      if (error) throw error;

      setWorkspace(data);
      setName(data.name || "");
      setSlug(data.slug || "");
      setDefaultTimezone(data.default_timezone || "");
    } catch (err) {
      console.error("Error fetching workspace:", err);
      setError("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const cookies = document.cookie.split(";");
      const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
      const currentOrgId = orgCookie ? orgCookie.split("=")[1] : null;

      if (!currentOrgId) return;

      const { data, error } = await supabase
        .from("connections")
        .select("id, provider, status")
        .eq("org_id", currentOrgId);

      if (error) throw error;

      setConnections(data || []);
    } catch (err) {
      console.error("Error fetching connections:", err);
    }
  };

  const handleSaveBasics = async () => {
    if (!workspace) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from("orgs")
        .update({
          name,
          slug: slug || null,
          default_timezone: defaultTimezone || null,
        })
        .eq("id", workspace.id);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchWorkspace();
    } catch (err: any) {
      console.error("Error saving workspace:", err);
      setError(err.message || "Failed to save workspace");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plaidConnection = connections.find((c) => c.provider === "plaid");
  const shopifyConnection = connections.find((c) => c.provider === "shopify");

  return (
    <div className="flex gap-6">
      {/* Left sidebar navigation */}
      <aside className="w-64 shrink-0">
        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 space-y-6">
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              Workspace settings saved successfully!
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Basics Section */}
        {activeSection === "basics" && (
          <Card>
            <CardHeader>
              <CardTitle>Workspace Basics</CardTitle>
              <CardDescription>
                Manage your workspace name, URL, and default settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Finance Lab"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Subdomain (URL)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="acme"
                  />
                  <span className="text-sm text-muted-foreground">.example.com</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your workspace URL identifier (letters, numbers, hyphens only)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-timezone">Default Timezone</Label>
                <Input
                  id="default-timezone"
                  value={defaultTimezone}
                  onChange={(e) => setDefaultTimezone(e.target.value)}
                  placeholder="America/New_York"
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Last updated:{" "}
                  {workspace?.updated_at ? new Date(workspace.updated_at).toLocaleString() : "Never"}
                </p>
                <Button onClick={handleSaveBasics} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Integrations Section */}
        {activeSection === "integrations" && (
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Manage your connected bank accounts, payment processors, and e-commerce platforms.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <LinkIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Plaid (Banking)</p>
                    <p className="text-sm text-muted-foreground">
                      {plaidConnection
                        ? `${plaidConnection.status === "active" ? "Connected" : "Disconnected"}`
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {plaidConnection && plaidConnection.status === "active" ? (
                    <>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Active
                      </Badge>
                      <Button variant="outline" size="sm" asChild>
                        <a href="/settings/connections">Configure</a>
                      </Button>
                    </>
                  ) : (
                    <ConnectBankButton onSuccess={fetchConnections} />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <LinkIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Shopify (E-commerce)</p>
                    <p className="text-sm text-muted-foreground">
                      {shopifyConnection
                        ? `${shopifyConnection.status === "active" ? "Connected" : "Disconnected"}`
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {shopifyConnection && shopifyConnection.status === "active" ? (
                    <>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Active
                      </Badge>
                      <Button variant="outline" size="sm" disabled>
                        Configure
                      </Button>
                    </>
                  ) : (
                    <ConnectShopifyButton onSuccess={fetchConnections} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Policy Section */}
        {activeSection === "data-policy" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Export Workspace Data</CardTitle>
                <CardDescription>Download a complete export of your workspace data.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled>
                  Export Data (Coming soon)
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions that affect your entire workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" disabled>
                  Delete Workspace (Coming soon)
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

