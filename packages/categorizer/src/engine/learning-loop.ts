/**
 * Learning loop validation system for transaction categorization
 *
 * Provides canary testing, oscillation detection, rule versioning, and effectiveness tracking
 * to ensure learned rules don't degrade system performance
 */

import type { CategoryId, OrgId } from "@nexus/types";

export type RuleType = "mcc" | "vendor" | "keyword" | "embedding";
export type RuleSource = "manual" | "learned" | "import";

export interface RuleVersion {
  id: string;
  orgId: OrgId;
  ruleType: RuleType;
  ruleIdentifier: string;
  categoryId: CategoryId;
  confidence: number;
  version: number;
  source: RuleSource;
  parentVersionId: string | null;
  metadata: Record<string, any>;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  deactivatedBy: string | null;
  deactivationReason: string | null;
}

export interface RuleEffectiveness {
  ruleVersionId: string;
  measurementDate: Date;
  applicationsCount: number;
  correctCount: number;
  incorrectCount: number;
  avgConfidence: number;
  precision: number;
}

export interface CategoryOscillation {
  id: string;
  orgId: OrgId;
  txId: string;
  oscillationSequence: Array<{
    categoryId: CategoryId;
    changedAt: Date;
    changedBy: string;
  }>;
  oscillationCount: number;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  isResolved: boolean;
  resolutionCategoryId: CategoryId | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export interface CanaryTestResult {
  id: string;
  orgId: OrgId;
  ruleVersionId: string;
  testDate: Date;
  testSetSize: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  passedThreshold: boolean;
  promotedToProduction: boolean;
  testMetadata: Record<string, any>;
}

export interface CanaryTestConfig {
  testSetSize?: number; // default 100
  accuracyThreshold?: number; // default 0.80
  precisionThreshold?: number; // default 0.75
  minSampleSize?: number; // default 20
}

/**
 * Create a new rule version
 */
export async function createRuleVersion(
  db: any,
  orgId: OrgId,
  ruleType: RuleType,
  ruleIdentifier: string,
  categoryId: CategoryId,
  confidence: number,
  source: RuleSource,
  metadata: Record<string, any> = {},
  userId: string | null = null,
  parentVersionId: string | null = null
): Promise<string> {
  // Get current version number for this rule
  const { data: existing } = await db
    .from("rule_versions")
    .select("version")
    .eq("org_id", orgId)
    .eq("rule_type", ruleType)
    .eq("rule_identifier", ruleIdentifier)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = existing ? existing.version + 1 : 1;

  const { data, error } = await db
    .from("rule_versions")
    .insert({
      org_id: orgId,
      rule_type: ruleType,
      rule_identifier: ruleIdentifier,
      category_id: categoryId,
      confidence,
      version: nextVersion,
      source,
      parent_version_id: parentVersionId,
      metadata,
      is_active: source === "manual", // Manual rules are active by default, learned rules need canary testing
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create rule version: ${error.message}`);
  }

  return data.id;
}

/**
 * Run canary test on a rule version before promotion
 */
export async function runCanaryTest(
  db: any,
  orgId: OrgId,
  ruleVersionId: string,
  config: CanaryTestConfig = {}
): Promise<CanaryTestResult> {
  const { testSetSize = 100, accuracyThreshold = 0.8 } = config;

  const { data, error } = await db.rpc("run_canary_test", {
    p_org_id: orgId,
    p_rule_version_id: ruleVersionId,
    p_test_set_size: testSetSize,
    p_accuracy_threshold: accuracyThreshold,
  });

  if (error) {
    throw new Error(`Canary test failed: ${error.message}`);
  }

  // Fetch the created test result
  const { data: testResult, error: fetchError } = await db
    .from("canary_test_results")
    .select("*")
    .eq("rule_version_id", ruleVersionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch canary test result: ${fetchError.message}`);
  }

  return {
    id: testResult.id,
    orgId: testResult.org_id as OrgId,
    ruleVersionId: testResult.rule_version_id,
    testDate: new Date(testResult.test_date),
    testSetSize: testResult.test_set_size,
    correctCount: testResult.correct_count,
    incorrectCount: testResult.incorrect_count,
    accuracy: parseFloat(testResult.accuracy),
    precision: parseFloat(testResult.precision || 0),
    recall: parseFloat(testResult.recall || 0),
    f1Score: parseFloat(testResult.f1_score || 0),
    passedThreshold: testResult.passed_threshold,
    promotedToProduction: testResult.promoted_to_production,
    testMetadata: testResult.test_metadata || {},
  };
}

/**
 * Promote rule version to production after successful canary test
 */
export async function promoteRuleVersion(
  db: any,
  ruleVersionId: string,
  userId: string
): Promise<void> {
  // Check if canary test passed
  const { data: canaryResult } = await db
    .from("canary_test_results")
    .select("passed_threshold")
    .eq("rule_version_id", ruleVersionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!canaryResult || !canaryResult.passed_threshold) {
    throw new Error(
      "Cannot promote rule: canary test not passed. Run canary test first and ensure it passes."
    );
  }

  // Get rule info to deactivate previous version
  const { data: ruleInfo, error: ruleError } = await db
    .from("rule_versions")
    .select("org_id, rule_type, rule_identifier")
    .eq("id", ruleVersionId)
    .single();

  if (ruleError) {
    throw new Error(`Failed to fetch rule info: ${ruleError.message}`);
  }

  // Deactivate all previous active versions of this rule
  const { error: deactivateError } = await db
    .from("rule_versions")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: userId,
      deactivation_reason: "Replaced by newer version",
    })
    .eq("org_id", ruleInfo.org_id)
    .eq("rule_type", ruleInfo.rule_type)
    .eq("rule_identifier", ruleInfo.rule_identifier)
    .eq("is_active", true)
    .neq("id", ruleVersionId);

  if (deactivateError) {
    throw new Error(`Failed to deactivate old versions: ${deactivateError.message}`);
  }

  // Activate new version
  const { error: activateError } = await db
    .from("rule_versions")
    .update({
      is_active: true,
    })
    .eq("id", ruleVersionId);

  if (activateError) {
    throw new Error(`Failed to activate rule version: ${activateError.message}`);
  }

  // Mark canary test as promoted
  await db
    .from("canary_test_results")
    .update({
      promoted_to_production: true,
    })
    .eq("rule_version_id", ruleVersionId)
    .order("created_at", { ascending: false })
    .limit(1);
}

/**
 * Rollback a rule version to its parent
 */
export async function rollbackRuleVersion(
  db: any,
  ruleVersionId: string,
  userId: string,
  reason: string = "Manual rollback"
): Promise<boolean> {
  const { data, error } = await db.rpc("rollback_rule_version", {
    p_rule_version_id: ruleVersionId,
    p_user_id: userId,
    p_reason: reason,
  });

  if (error) {
    throw new Error(`Rollback failed: ${error.message}`);
  }

  return data;
}

/**
 * Get unresolved oscillations for an organization
 */
export async function getUnresolvedOscillations(
  db: any,
  orgId: OrgId,
  limit: number = 50
): Promise<CategoryOscillation[]> {
  const { data, error } = await db
    .from("category_oscillations")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_resolved", false)
    .order("last_detected_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch oscillations: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    orgId: row.org_id as OrgId,
    txId: row.tx_id,
    oscillationSequence: row.oscillation_sequence || [],
    oscillationCount: row.oscillation_count,
    firstDetectedAt: new Date(row.first_detected_at),
    lastDetectedAt: new Date(row.last_detected_at),
    isResolved: row.is_resolved,
    resolutionCategoryId: row.resolution_category_id as CategoryId | null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
    resolvedBy: row.resolved_by,
  }));
}

/**
 * Resolve an oscillation by setting a final category
 */
export async function resolveOscillation(
  db: any,
  oscillationId: string,
  resolutionCategoryId: CategoryId,
  userId: string
): Promise<void> {
  const { error } = await db
    .from("category_oscillations")
    .update({
      is_resolved: true,
      resolution_category_id: resolutionCategoryId,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq("id", oscillationId);

  if (error) {
    throw new Error(`Failed to resolve oscillation: ${error.message}`);
  }
}

/**
 * Get rule effectiveness metrics
 */
export async function getRuleEffectiveness(
  db: any,
  orgId: OrgId,
  ruleVersionId: string,
  daysSince: number = 30
): Promise<RuleEffectiveness[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSince);

  const { data, error } = await db
    .from("rule_effectiveness")
    .select("*")
    .eq("org_id", orgId)
    .eq("rule_version_id", ruleVersionId)
    .gte("measurement_date", cutoffDate.toISOString().split("T")[0])
    .order("measurement_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch rule effectiveness: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    ruleVersionId: row.rule_version_id,
    measurementDate: new Date(row.measurement_date),
    applicationsCount: row.applications_count,
    correctCount: row.correct_count,
    incorrectCount: row.incorrect_count,
    avgConfidence: parseFloat(row.avg_confidence || 0),
    precision: parseFloat(row.precision || 0),
  }));
}

/**
 * Get active rule versions for an organization
 */
export async function getActiveRuleVersions(
  db: any,
  orgId: OrgId,
  ruleType?: RuleType
): Promise<RuleVersion[]> {
  let query = db
    .from("rule_versions")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (ruleType) {
    query = query.eq("rule_type", ruleType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch active rules: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    orgId: row.org_id as OrgId,
    ruleType: row.rule_type as RuleType,
    ruleIdentifier: row.rule_identifier,
    categoryId: row.category_id as CategoryId,
    confidence: parseFloat(row.confidence),
    version: row.version,
    source: row.source as RuleSource,
    parentVersionId: row.parent_version_id,
    metadata: row.metadata || {},
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
    deactivatedBy: row.deactivated_by,
    deactivationReason: row.deactivation_reason,
  }));
}

/**
 * Detect if a rule is causing oscillations
 */
export async function detectRuleOscillations(
  db: any,
  orgId: OrgId,
  ruleVersionId: string,
  threshold: number = 3
): Promise<{ isOscillating: boolean; affectedTransactions: string[] }> {
  // This is a simplified version - in production, you'd analyze
  // whether transactions categorized by this rule are frequently re-categorized

  const { data: oscillations } = await db
    .from("category_oscillations")
    .select("tx_id")
    .eq("org_id", orgId)
    .eq("is_resolved", false)
    .gte("oscillation_count", threshold);

  const affectedTransactions = oscillations ? oscillations.map((o: any) => o.tx_id) : [];

  return {
    isOscillating: affectedTransactions.length > 0,
    affectedTransactions,
  };
}
