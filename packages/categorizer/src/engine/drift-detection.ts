/**
 * Drift detection for transaction categorization system
 *
 * Monitors category distribution, confidence scores, and model performance
 * to detect degradation and alert on significant changes
 */

import type { CategoryId, OrgId } from "@nexus/types";

export type AlertType =
  | "category_distribution"
  | "confidence_drift"
  | "embeddings_recall"
  | "rule_effectiveness";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface CategoryDistributionSnapshot {
  id: string;
  orgId: OrgId;
  snapshotDate: Date;
  categoryId: CategoryId;
  transactionCount: number;
  totalTransactions: number;
  distributionPercentage: number;
  avgConfidence: number;
  sourceBreakdown: {
    pass1: number;
    llm: number;
    manual: number;
  };
}

export interface ConfidenceDriftSnapshot {
  id: string;
  orgId: OrgId;
  snapshotDate: Date;
  source: "pass1" | "llm" | "overall";
  avgConfidence: number;
  medianConfidence: number;
  p25Confidence: number;
  p75Confidence: number;
  p90Confidence: number;
  transactionCount: number;
  lowConfidenceCount: number;
  mediumConfidenceCount: number;
  highConfidenceCount: number;
}

export interface DriftAlert {
  id: string;
  orgId: OrgId;
  alertType: AlertType;
  severity: AlertSeverity;
  metricName: string;
  currentValue: number;
  previousValue: number | null;
  changePercentage: number | null;
  thresholdExceeded: number | null;
  detectionDate: Date;
  details: Record<string, any>;
  isAcknowledged: boolean;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
}

export interface ModelPerformanceSnapshot {
  id: string;
  orgId: OrgId;
  snapshotDate: Date;
  autoApplyRate: number;
  manualReviewRate: number;
  correctionRate: number;
  avgProcessingTimeMs: number;
  pass1SuccessRate: number;
  llmInvocationRate: number;
  embeddingsGoverage: number;
  totalTransactionsProcessed: number;
}

export interface DriftDetectionConfig {
  thresholdPercentage?: number; // default 10%
  alertOnFirstWeek?: boolean; // default false
}

/**
 * Create weekly category distribution snapshot
 */
export async function createCategoryDistributionSnapshot(
  db: any,
  orgId: OrgId,
  snapshotDate: Date = new Date()
): Promise<number> {
  const { data, error } = await db.rpc("create_category_distribution_snapshot", {
    p_org_id: orgId,
    p_snapshot_date: snapshotDate.toISOString().split("T")[0],
  });

  if (error) {
    throw new Error(`Failed to create category distribution snapshot: ${error.message}`);
  }

  return data;
}

/**
 * Create weekly confidence drift snapshot
 */
export async function createConfidenceDriftSnapshot(
  db: any,
  orgId: OrgId,
  snapshotDate: Date = new Date()
): Promise<number> {
  const { data, error } = await db.rpc("create_confidence_drift_snapshot", {
    p_org_id: orgId,
    p_snapshot_date: snapshotDate.toISOString().split("T")[0],
  });

  if (error) {
    throw new Error(`Failed to create confidence drift snapshot: ${error.message}`);
  }

  return data;
}

/**
 * Detect drift and create alerts
 */
export async function detectDriftAndAlert(
  db: any,
  orgId: OrgId,
  currentDate: Date = new Date(),
  config: DriftDetectionConfig = {}
): Promise<number> {
  const { thresholdPercentage = 10 } = config;

  const { data, error } = await db.rpc("detect_drift_and_alert", {
    p_org_id: orgId,
    p_current_date: currentDate.toISOString().split("T")[0],
    p_threshold_percentage: thresholdPercentage,
  });

  if (error) {
    throw new Error(`Failed to detect drift: ${error.message}`);
  }

  return data;
}

/**
 * Get category distribution snapshots over time
 */
export async function getCategoryDistributionHistory(
  db: any,
  orgId: OrgId,
  categoryId: CategoryId,
  daysSince: number = 90
): Promise<CategoryDistributionSnapshot[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSince);

  const { data, error } = await db
    .from("category_distribution_snapshots")
    .select("*")
    .eq("org_id", orgId)
    .eq("category_id", categoryId)
    .gte("snapshot_date", cutoffDate.toISOString().split("T")[0])
    .order("snapshot_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch category distribution history: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    orgId: row.org_id as OrgId,
    snapshotDate: new Date(row.snapshot_date),
    categoryId: row.category_id as CategoryId,
    transactionCount: row.transaction_count,
    totalTransactions: row.total_transactions,
    distributionPercentage: parseFloat(row.distribution_percentage),
    avgConfidence: parseFloat(row.avg_confidence || 0),
    sourceBreakdown: row.source_breakdown || { pass1: 0, llm: 0, manual: 0 },
  }));
}

/**
 * Get confidence drift snapshots over time
 */
export async function getConfidenceDriftHistory(
  db: any,
  orgId: OrgId,
  source: "pass1" | "llm" | "overall" = "overall",
  daysSince: number = 90
): Promise<ConfidenceDriftSnapshot[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSince);

  const { data, error } = await db
    .from("confidence_drift_snapshots")
    .select("*")
    .eq("org_id", orgId)
    .eq("source", source)
    .gte("snapshot_date", cutoffDate.toISOString().split("T")[0])
    .order("snapshot_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch confidence drift history: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    orgId: row.org_id as OrgId,
    snapshotDate: new Date(row.snapshot_date),
    source: row.source,
    avgConfidence: parseFloat(row.avg_confidence),
    medianConfidence: parseFloat(row.median_confidence || 0),
    p25Confidence: parseFloat(row.p25_confidence || 0),
    p75Confidence: parseFloat(row.p75_confidence || 0),
    p90Confidence: parseFloat(row.p90_confidence || 0),
    transactionCount: row.transaction_count,
    lowConfidenceCount: row.low_confidence_count,
    mediumConfidenceCount: row.medium_confidence_count,
    highConfidenceCount: row.high_confidence_count,
  }));
}

/**
 * Get unacknowledged drift alerts
 */
export async function getUnacknowledgedAlerts(
  db: any,
  orgId: OrgId,
  alertType?: AlertType,
  minSeverity: AlertSeverity = "low"
): Promise<DriftAlert[]> {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const minSeverityValue = severityOrder[minSeverity];

  let query = db
    .from("drift_alerts")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_acknowledged", false)
    .order("detection_date", { ascending: false })
    .order("severity", { ascending: false });

  if (alertType) {
    query = query.eq("alert_type", alertType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch drift alerts: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  // Filter by severity (since we can't do this easily in the query)
  return data
    .filter((row: any) => severityOrder[row.severity as AlertSeverity] >= minSeverityValue)
    .map((row: any) => ({
      id: row.id,
      orgId: row.org_id as OrgId,
      alertType: row.alert_type as AlertType,
      severity: row.severity as AlertSeverity,
      metricName: row.metric_name,
      currentValue: parseFloat(row.current_value),
      previousValue: row.previous_value ? parseFloat(row.previous_value) : null,
      changePercentage: row.change_percentage ? parseFloat(row.change_percentage) : null,
      thresholdExceeded: row.threshold_exceeded ? parseFloat(row.threshold_exceeded) : null,
      detectionDate: new Date(row.detection_date),
      details: row.details || {},
      isAcknowledged: row.is_acknowledged,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : null,
      acknowledgedBy: row.acknowledged_by,
      resolutionNotes: row.resolution_notes,
      createdAt: new Date(row.created_at),
    }));
}

/**
 * Acknowledge a drift alert
 */
export async function acknowledgeDriftAlert(
  db: any,
  alertId: string,
  userId: string,
  resolutionNotes?: string
): Promise<void> {
  const { error } = await db
    .from("drift_alerts")
    .update({
      is_acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
      resolution_notes: resolutionNotes || null,
    })
    .eq("id", alertId);

  if (error) {
    throw new Error(`Failed to acknowledge drift alert: ${error.message}`);
  }
}

/**
 * Calculate drift metrics for a specific period
 */
export async function calculateDriftMetrics(
  db: any,
  orgId: OrgId,
  startDate: Date,
  endDate: Date
): Promise<{
  categoryDrift: number;
  confidenceDrift: number;
  volumeDrift: number;
}> {
  // Get snapshots for both periods
  const { data: currentSnapshots } = await db
    .from("category_distribution_snapshots")
    .select("category_id, distribution_percentage, total_transactions")
    .eq("org_id", orgId)
    .eq("snapshot_date", endDate.toISOString().split("T")[0]);

  const { data: previousSnapshots } = await db
    .from("category_distribution_snapshots")
    .select("category_id, distribution_percentage, total_transactions")
    .eq("org_id", orgId)
    .eq("snapshot_date", startDate.toISOString().split("T")[0]);

  if (!currentSnapshots || !previousSnapshots) {
    return { categoryDrift: 0, confidenceDrift: 0, volumeDrift: 0 };
  }

  // Calculate category distribution drift (average absolute change)
  const categoryMap = new Map(
    previousSnapshots.map((s: any) => [s.category_id, s.distribution_percentage])
  );

  let totalDrift = 0;
  let categoryCount = 0;

  for (const current of currentSnapshots) {
    const previous = categoryMap.get(current.category_id);
    if (previous !== undefined && previous !== null && current.distribution_percentage !== null && typeof previous === 'number') {
      totalDrift += Math.abs(current.distribution_percentage - previous);
      categoryCount++;
    }
  }

  const categoryDrift = categoryCount > 0 ? totalDrift / categoryCount : 0;

  // Calculate volume drift
  const currentVolume = currentSnapshots[0]?.total_transactions || 0;
  const previousVolume = previousSnapshots[0]?.total_transactions || 0;
  const volumeDrift =
    previousVolume > 0
      ? Math.abs((currentVolume - previousVolume) / previousVolume) * 100
      : 0;

  // Get confidence drift
  const { data: currentConfidence } = await db
    .from("confidence_drift_snapshots")
    .select("avg_confidence")
    .eq("org_id", orgId)
    .eq("source", "overall")
    .eq("snapshot_date", endDate.toISOString().split("T")[0])
    .maybeSingle();

  const { data: previousConfidence } = await db
    .from("confidence_drift_snapshots")
    .select("avg_confidence")
    .eq("org_id", orgId)
    .eq("source", "overall")
    .eq("snapshot_date", startDate.toISOString().split("T")[0])
    .maybeSingle();

  const confidenceDrift =
    currentConfidence && previousConfidence
      ? Math.abs(
          ((currentConfidence.avg_confidence - previousConfidence.avg_confidence) /
            previousConfidence.avg_confidence) *
            100
        )
      : 0;

  return {
    categoryDrift: Math.round(categoryDrift * 100) / 100,
    confidenceDrift: Math.round(confidenceDrift * 100) / 100,
    volumeDrift: Math.round(volumeDrift * 100) / 100,
  };
}

/**
 * Run complete drift detection workflow (snapshots + alert detection)
 */
export async function runDriftDetectionWorkflow(
  db: any,
  orgId: OrgId,
  snapshotDate: Date = new Date(),
  config: DriftDetectionConfig = {}
): Promise<{
  categorySnapshotsCreated: number;
  confidenceSnapshotsCreated: number;
  alertsCreated: number;
}> {
  // Create snapshots
  const categorySnapshotsCreated = await createCategoryDistributionSnapshot(
    db,
    orgId,
    snapshotDate
  );
  const confidenceSnapshotsCreated = await createConfidenceDriftSnapshot(db, orgId, snapshotDate);

  // Detect drift and create alerts
  const alertsCreated = await detectDriftAndAlert(db, orgId, snapshotDate, config);

  return {
    categorySnapshotsCreated,
    confidenceSnapshotsCreated,
    alertsCreated,
  };
}
