"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useDashboardData, useDashboardCharts } from "@/hooks/use-dashboard";
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { AlertsRow } from "@/components/dashboard/alerts-row";
import { ChartsSection } from "@/components/dashboard/charts-section";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import { DashboardEmpty } from "@/components/dashboard/dashboard-empty";

export default function DashboardPage() {
  const [hasConnections, setHasConnections] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orgName, setOrgName] = useState<string>("Your Organization");
  const [timeRange, setTimeRange] = useState<"30d" | "90d">("30d");

  const supabase = createClient();

  // Custom hooks for data and analytics
  const { data: dashboard, isLoading: isDashboardLoading } = useDashboardData();
  const chartData = useDashboardCharts(dashboard, timeRange);
  const { trackDashboardViewed, trackRangeToggle, trackAlertClicked, trackChartHover } =
    useDashboardAnalytics();

  // Handle time range changes with analytics
  const handleTimeRangeChange = (range: "30d" | "90d") => {
    setTimeRange(range);
    trackRangeToggle(range);
  };

  useEffect(() => {
    const checkConnections = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get current org from cookie
        const cookies = document.cookie.split(";");
        const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
        const currentOrgId = orgCookie ? orgCookie.split("=")[1] : null;

        if (!currentOrgId) return;

        // Get org name
        const { data: orgData } = await supabase
          .from("orgs")
          .select("name")
          .eq("id", currentOrgId)
          .single();

        if (orgData) {
          setOrgName(orgData.name);
        }

        // Check if org has any connections
        const { data: connections, error } = await supabase
          .from("connections")
          .select("id")
          .eq("org_id", currentOrgId)
          .limit(1);

        if (error) {
          console.error("Error checking connections:", error);
          return;
        }

        setHasConnections(connections && connections.length > 0);
      } catch (error) {
        console.error("Error in checkConnections:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkConnections();
  }, [supabase]);

  // Track dashboard viewed when component mounts
  useEffect(() => {
    trackDashboardViewed();
  }, [trackDashboardViewed]);

  // Show initial loading state
  if (isLoading) {
    return <DashboardLoading />;
  }

  // Show empty state if no connections
  if (hasConnections === false) {
    return <DashboardEmpty orgName={orgName} />;
  }

  // Show loading state for dashboard data
  if (isDashboardLoading || !dashboard) {
    return <DashboardLoading message="Loading your financial data..." />;
  }

  // Show full dashboard when data is available
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your financial data and key metrics.</p>
      </div>

      {/* Header cards */}
      <MetricsCards dashboard={dashboard} />

      {/* Alerts row */}
      <AlertsRow alerts={dashboard.alerts} onAlertClick={trackAlertClicked} />

      {/* Charts section */}
      <ChartsSection
        data={chartData}
        timeRange={timeRange}
        trendDeltaPct={dashboard.trend.outflowDeltaPct}
        onTimeRangeChange={handleTimeRangeChange}
        onChartHover={trackChartHover}
      />
    </div>
  );
}
