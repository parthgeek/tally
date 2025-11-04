"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertTriangle,
  CreditCard,
  FileText,
  Settings as SettingsIcon,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Workspace {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_email: string | null;
  plan: string | null;
  billing_status: string | null;
  current_period_end: string | null;
}

const sections = [
  { id: "overview", label: "Overview", icon: SettingsIcon },
  { id: "payment", label: "Payment Method", icon: CreditCard },
  { id: "invoices", label: "Invoices", icon: FileText },
];

export default function BillingPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("overview");

  const supabase = createClient();

  useEffect(() => {
    fetchWorkspace();
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
    } catch (err) {
      console.error("Error fetching workspace:", err);
      setError("Failed to load billing information");
    } finally {
      setLoading(false);
    }
  };

  const openStripePortal = async () => {
    // TODO: Implement Stripe Customer Portal session creation
    alert("Stripe Customer Portal integration coming soon!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const planDisplay = workspace?.plan || "free";
  const statusDisplay = workspace?.billing_status || "active";

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
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Overview Section */}
        {activeSection === "overview" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>
                  Manage your subscription and view usage information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="text-2xl font-bold capitalize">{planDisplay}</p>
                  </div>
                  <Badge
                    variant={statusDisplay === "active" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {statusDisplay}
                  </Badge>
                </div>

                {workspace?.current_period_end && (
                  <div>
                    <p className="text-sm text-muted-foreground">Next billing date</p>
                    <p className="font-medium">
                      {new Date(workspace.current_period_end).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  {workspace?.stripe_customer_id ? (
                    <Button onClick={openStripePortal} className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Manage in Stripe Portal
                    </Button>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Stripe billing is not yet configured for this workspace. Contact support to
                        set up billing.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage This Cycle</CardTitle>
                <CardDescription>Track your usage against plan limits.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">API Calls</span>
                      <span className="font-medium">Coming soon</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="font-medium">Coming soon</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Payment Method Section */}
        {activeSection === "payment" && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Manage your payment methods and billing information.</CardDescription>
            </CardHeader>
            <CardContent>
              {workspace?.stripe_customer_id ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Payment method on file</p>
                        <p className="text-sm text-muted-foreground">
                          Manage your payment methods in Stripe
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={openStripePortal}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Update in Stripe
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No payment method configured. Set up billing to add a payment method.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoices Section */}
        {activeSection === "invoices" && (
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>View and download your billing invoices.</CardDescription>
            </CardHeader>
            <CardContent>
              {workspace?.stripe_customer_id ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    View all your invoices in the Stripe Customer Portal.
                  </p>
                  <Button variant="outline" onClick={openStripePortal}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Invoices in Stripe
                  </Button>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No invoices available. Billing has not been configured for this workspace.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

