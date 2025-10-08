/**
 * Weekly Drift Detection Edge Function
 *
 * Scheduled to run weekly (Sundays at midnight) to:
 * 1. Create category distribution snapshots
 * 2. Create confidence drift snapshots
 * 3. Detect drift and generate alerts
 * 4. Send notifications for critical alerts
 *
 * Schedule: cron('0 0 * * 0') - Every Sunday at midnight UTC
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException, captureEvent } from "@nexus/analytics/server";

interface DriftCheckRequest {
  orgIds?: string[]; // Optional: specific orgs to check, otherwise all orgs
  thresholdPercentage?: number; // Default: 10%
  sendNotifications?: boolean; // Default: true
}

interface DriftCheckResult {
  success: boolean;
  orgsProcessed: number;
  totalSnapshots: number;
  totalAlerts: number;
  criticalAlerts: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const requestData: DriftCheckRequest = await req.json().catch(() => ({}));
    const {
      orgIds,
      thresholdPercentage = 10,
      sendNotifications = true,
    } = requestData;

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🔄 Starting weekly drift detection");
    console.log(`   Threshold: ${thresholdPercentage}%`);
    console.log(`   Notifications: ${sendNotifications ? "enabled" : "disabled"}`);

    // Get organizations to process
    let targetOrgIds: string[] = orgIds || [];

    if (!orgIds || orgIds.length === 0) {
      const { data: orgs, error: orgsError } = await supabase
        .from("orgs")
        .select("id")
        .eq("is_active", true);

      if (orgsError) throw orgsError;

      targetOrgIds = orgs?.map((org) => org.id) || [];
      console.log(`   Found ${targetOrgIds.length} active organizations`);
    }

    const result: DriftCheckResult = {
      success: true,
      orgsProcessed: 0,
      totalSnapshots: 0,
      totalAlerts: 0,
      criticalAlerts: 0,
      errors: [],
    };

    const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Process each organization
    for (const orgId of targetOrgIds) {
      try {
        console.log(`\n📊 Processing org: ${orgId}`);

        // Create category distribution snapshot
        const { data: categorySnapshots, error: catError } = await supabase.rpc(
          "create_category_distribution_snapshot",
          {
            p_org_id: orgId,
            p_snapshot_date: currentDate,
          }
        );

        if (catError) {
          console.error(`   ❌ Failed to create category snapshots: ${catError.message}`);
          result.errors.push(`${orgId}: Category snapshot failed - ${catError.message}`);
          continue;
        }

        console.log(`   ✅ Created ${categorySnapshots} category distribution snapshots`);
        result.totalSnapshots += categorySnapshots || 0;

        // Create confidence drift snapshot
        const { data: confidenceSnapshots, error: confError } = await supabase.rpc(
          "create_confidence_drift_snapshot",
          {
            p_org_id: orgId,
            p_snapshot_date: currentDate,
          }
        );

        if (confError) {
          console.error(`   ❌ Failed to create confidence snapshots: ${confError.message}`);
          result.errors.push(`${orgId}: Confidence snapshot failed - ${confError.message}`);
          continue;
        }

        console.log(`   ✅ Created ${confidenceSnapshots} confidence drift snapshots`);
        result.totalSnapshots += confidenceSnapshots || 0;

        // Detect drift and create alerts
        const { data: alertsCreated, error: driftError } = await supabase.rpc(
          "detect_drift_and_alert",
          {
            p_org_id: orgId,
            p_current_date: currentDate,
            p_threshold_percentage: thresholdPercentage,
          }
        );

        if (driftError) {
          console.error(`   ❌ Failed to detect drift: ${driftError.message}`);
          result.errors.push(`${orgId}: Drift detection failed - ${driftError.message}`);
          continue;
        }

        console.log(`   ✅ Created ${alertsCreated} drift alerts`);
        result.totalAlerts += alertsCreated || 0;

        // Check for critical alerts
        if (alertsCreated && alertsCreated > 0) {
          const { data: criticalAlerts } = await supabase
            .from("drift_alerts")
            .select("*")
            .eq("org_id", orgId)
            .eq("detection_date", currentDate)
            .in("severity", ["critical", "high"])
            .eq("is_acknowledged", false);

          const criticalCount = criticalAlerts?.length || 0;
          result.criticalAlerts += criticalCount;

          if (criticalCount > 0) {
            console.log(`   ⚠️  ${criticalCount} critical/high severity alerts detected`);

            // Send notifications for critical alerts
            if (sendNotifications) {
              await sendDriftNotifications(supabase, orgId, criticalAlerts || []);
            }

            // Track in PostHog
            captureEvent("drift_alert_critical", {
              org_id: orgId,
              alert_count: criticalCount,
              detection_date: currentDate,
              threshold_percentage: thresholdPercentage,
            });
          }
        }

        result.orgsProcessed++;
      } catch (orgError) {
        const errorMessage =
          orgError instanceof Error ? orgError.message : "Unknown error";
        console.error(`   ❌ Error processing org ${orgId}:`, errorMessage);
        result.errors.push(`${orgId}: ${errorMessage}`);
        captureException(orgError instanceof Error ? orgError : new Error(errorMessage));
      }
    }

    // Log summary
    console.log("\n" + "=".repeat(60));
    console.log("DRIFT DETECTION SUMMARY");
    console.log("=".repeat(60));
    console.log(`Organizations Processed: ${result.orgsProcessed}/${targetOrgIds.length}`);
    console.log(`Total Snapshots Created: ${result.totalSnapshots}`);
    console.log(`Total Alerts Created: ${result.totalAlerts}`);
    console.log(`Critical/High Alerts: ${result.criticalAlerts}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log("=".repeat(60) + "\n");

    // Track completion in PostHog
    captureEvent("weekly_drift_check_completed", {
      orgs_processed: result.orgsProcessed,
      total_snapshots: result.totalSnapshots,
      total_alerts: result.totalAlerts,
      critical_alerts: result.criticalAlerts,
      error_count: result.errors.length,
      threshold_percentage: thresholdPercentage,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Drift detection failed:", errorMessage);

    captureException(error instanceof Error ? error : new Error(errorMessage));

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Send notifications for drift alerts
 */
async function sendDriftNotifications(
  supabase: any,
  orgId: string,
  alerts: any[]
): Promise<void> {
  console.log(`   📧 Sending ${alerts.length} drift notifications...`);

  // Get organization details for notification
  const { data: org } = await supabase.from("orgs").select("name, slug").eq("id", orgId).single();

  if (!org) {
    console.warn(`   ⚠️  Organization ${orgId} not found, skipping notifications`);
    return;
  }

  // Get organization admins/owners
  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, role, users(email, full_name)")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"]);

  if (!members || members.length === 0) {
    console.warn(`   ⚠️  No admin/owner found for org ${orgId}, skipping notifications`);
    return;
  }

  // Format alerts for notification
  const alertSummary = alerts
    .map((alert) => {
      const severity = alert.severity.toUpperCase();
      const change = alert.change_percentage
        ? `${alert.change_percentage.toFixed(1)}%`
        : "N/A";
      return `   • [${severity}] ${alert.metric_name}: ${change} change`;
    })
    .join("\n");

  // In production, this would integrate with email service (e.g., SendGrid, Resend)
  // For now, we'll just log and track the event
  console.log(`   📧 Would send notification to ${members.length} recipients:`);
  console.log(`   Recipients: ${members.map((m: any) => m.users?.email).join(", ")}`);
  console.log(`   Alert Summary:\n${alertSummary}`);

  // Track notification event
  captureEvent("drift_notification_sent", {
    org_id: orgId,
    org_name: org.name,
    recipient_count: members.length,
    alert_count: alerts.length,
    severities: alerts.map((a) => a.severity),
  });

  // TODO: Implement actual email sending
  // Example with Resend:
  // await resend.emails.send({
  //   from: 'alerts@nexus.app',
  //   to: members.map(m => m.users.email),
  //   subject: `[${org.name}] Categorization Drift Alert`,
  //   html: formatDriftAlertEmail(org, alerts)
  // });
}
