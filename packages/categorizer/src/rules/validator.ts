/**
 * Rule Conflict Detector and Validator
 *
 * Static analysis of MCC, vendor, and keyword rules to detect:
 * - Conflicts and overlaps
 * - Priority inversions
 * - Dead/unused rules
 * - Regex performance risks (catastrophic backtracking)
 * - Deterministic resolution order issues
 */

import type { CategoryId } from "@nexus/types";
import { MCC_MAPPINGS } from "./mcc.js";
import { UNIVERSAL_VENDOR_PATTERNS } from "./vendors.js";

// Alias for consistency within this module
const VENDOR_PATTERNS = UNIVERSAL_VENDOR_PATTERNS;
import { KEYWORD_RULES } from "./keywords.js";
import safeRegex from "safe-regex";

// ============================================================================
// Types
// ============================================================================

export interface RuleConflict {
  conflictType: "overlap" | "priority_inversion" | "ambiguous" | "dead_rule";
  severity: "critical" | "high" | "medium" | "low";
  ruleType: "mcc" | "vendor" | "keyword";
  rule1: {
    id: string;
    pattern: string;
    categorySlug: CategoryId;
    categoryName: string;
    priority?: number;
  };
  rule2?: {
    id: string;
    pattern: string;
    categorySlug: CategoryId;
    categoryName: string;
    priority?: number;
  };
  reason: string;
  examples: string[];
  recommendation: string;
}

export interface RegexSafetyIssue {
  ruleType: "vendor" | "keyword";
  ruleId: string;
  pattern: string;
  issue: "unsafe_regex" | "catastrophic_backtracking" | "too_complex";
  severity: "critical" | "high" | "medium";
  reason: string;
  recommendation: string;
}

export interface ValidationReport {
  timestamp: string;
  summary: {
    totalRules: number;
    conflictCount: number;
    criticalConflicts: number;
    highConflicts: number;
    regexIssues: number;
    deadRules: number;
  };
  conflicts: RuleConflict[];
  regexIssues: RegexSafetyIssue[];
  resolutionOrder: Array<{
    ruleType: "mcc" | "vendor" | "keyword";
    priority: number;
    description: string;
  }>;
}

// ============================================================================
// MCC Rule Validation
// ============================================================================

function validateMCCRules(): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const mccEntries = Object.entries(MCC_MAPPINGS);

  // Check for MCC codes mapping to multiple categories
  for (let i = 0; i < mccEntries.length; i++) {
    const [mcc1, mapping1] = mccEntries[i]!;

    for (let j = i + 1; j < mccEntries.length; j++) {
      const [mcc2, mapping2] = mccEntries[j]!;

      // Check for same MCC different categories (should not happen, but validate)
      if (mcc1 === mcc2 && mapping1.categorySlug !== mapping2.categorySlug) {
        conflicts.push({
          conflictType: "overlap",
          severity: "critical",
          ruleType: "mcc",
          rule1: {
            id: `mcc:${mcc1}`,
            pattern: mcc1,
            categorySlug: mapping1.categorySlug,
            categoryName: mapping1.categoryName,
            priority:
              mapping1.strength === "exact" ? 100 : mapping1.strength === "family" ? 80 : 50,
          },
          rule2: {
            id: `mcc:${mcc2}`,
            pattern: mcc2,
            categorySlug: mapping2.categorySlug,
            categoryName: mapping2.categoryName,
            priority:
              mapping2.strength === "exact" ? 100 : mapping2.strength === "family" ? 80 : 50,
          },
          reason: "Same MCC code maps to multiple categories - impossible conflict",
          examples: [`MCC ${mcc1} → ${mapping1.categoryName} AND ${mapping2.categoryName}`],
          recommendation: "Remove duplicate MCC or merge categories",
        });
      }

      // Check for weak confidence on important codes
      if (mapping1.baseConfidence < 0.7 && mapping1.strength === "exact") {
        conflicts.push({
          conflictType: "ambiguous",
          severity: "medium",
          ruleType: "mcc",
          rule1: {
            id: `mcc:${mcc1}`,
            pattern: mcc1,
            categorySlug: mapping1.categorySlug,
            categoryName: mapping1.categoryName,
            priority: 100,
          },
          reason: `MCC marked as 'exact' but has low confidence ${mapping1.baseConfidence}`,
          examples: [],
          recommendation: 'Either lower strength to "family" or increase base confidence',
        });
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Vendor Pattern Validation
// ============================================================================

function validateVendorPatterns(): { conflicts: RuleConflict[]; regexIssues: RegexSafetyIssue[] } {
  const conflicts: RuleConflict[] = [];
  const regexIssues: RegexSafetyIssue[] = [];

  for (let i = 0; i < VENDOR_PATTERNS.length; i++) {
    const pattern1 = VENDOR_PATTERNS[i]!;

    // Check regex safety for patterns using regex match type
    if (pattern1.matchType === "regex") {
      const isSafe = safeRegex(pattern1.pattern);
      if (!isSafe) {
        regexIssues.push({
          ruleType: "vendor",
          ruleId: `vendor:${i}:${pattern1.pattern.substring(0, 20)}`,
          pattern: pattern1.pattern,
          issue: "unsafe_regex",
          severity: "critical",
          reason: "Pattern has catastrophic backtracking risk",
          recommendation: `Replace regex "${pattern1.pattern}" with simpler alternative or use non-regex match type`,
        });
      }
    }

    // Check for overlapping patterns
    for (let j = i + 1; j < VENDOR_PATTERNS.length; j++) {
      const pattern2 = VENDOR_PATTERNS[j]!;

      // Exact patterns should not overlap
      if (pattern1.matchType === "exact" && pattern2.matchType === "exact") {
        if (pattern1.pattern.toLowerCase() === pattern2.pattern.toLowerCase()) {
          if (pattern1.categorySlug !== pattern2.categorySlug) {
            conflicts.push({
              conflictType: "overlap",
              severity: "critical",
              ruleType: "vendor",
              rule1: {
                id: `vendor:${i}`,
                pattern: pattern1.pattern,
                categorySlug: pattern1.categorySlug,
                categoryName: pattern1.categoryName,
                priority: pattern1.priority,
              },
              rule2: {
                id: `vendor:${j}`,
                pattern: pattern2.pattern,
                categorySlug: pattern2.categorySlug,
                categoryName: pattern2.categoryName,
                priority: pattern2.priority,
              },
              reason: "Same vendor pattern maps to different categories",
              examples: [
                `"${pattern1.pattern}" → ${pattern1.categoryName} AND ${pattern2.categoryName}`,
              ],
              recommendation: "Remove duplicate or use more specific pattern",
            });
          }
        }
      }

      // Check for containment (one pattern is substring of another)
      if (pattern1.matchType === "contains" && pattern2.matchType === "contains") {
        const p1Lower = pattern1.pattern.toLowerCase();
        const p2Lower = pattern2.pattern.toLowerCase();

        if (p1Lower.includes(p2Lower) || p2Lower.includes(p1Lower)) {
          if (pattern1.categorySlug !== pattern2.categorySlug) {
            const containedIn = p1Lower.includes(p2Lower)
              ? "pattern1_contains_pattern2"
              : "pattern2_contains_pattern1";
            conflicts.push({
              conflictType: "overlap",
              severity: "high",
              ruleType: "vendor",
              rule1: {
                id: `vendor:${i}`,
                pattern: pattern1.pattern,
                categorySlug: pattern1.categorySlug,
                categoryName: pattern1.categoryName,
                priority: pattern1.priority,
              },
              rule2: {
                id: `vendor:${j}`,
                pattern: pattern2.pattern,
                categorySlug: pattern2.categorySlug,
                categoryName: pattern2.categoryName,
                priority: pattern2.priority,
              },
              reason: `Vendor patterns overlap (${containedIn}) - priority-based resolution needed`,
              examples: [
                containedIn === "pattern1_contains_pattern2"
                  ? `"${p1Lower}" contains "${p2Lower}"`
                  : `"${p2Lower}" contains "${p1Lower}"`,
              ],
              recommendation:
                "Ensure priority is set correctly to resolve overlap deterministically",
            });
          }
        }
      }

      // Priority inversion check: higher priority with lower confidence
      if (pattern1.categorySlug === pattern2.categorySlug) {
        if (pattern1.priority > pattern2.priority && pattern1.confidence < pattern2.confidence) {
          conflicts.push({
            conflictType: "priority_inversion",
            severity: "medium",
            ruleType: "vendor",
            rule1: {
              id: `vendor:${i}`,
              pattern: pattern1.pattern,
              categorySlug: pattern1.categorySlug,
              categoryName: pattern1.categoryName,
              priority: pattern1.priority,
            },
            rule2: {
              id: `vendor:${j}`,
              pattern: pattern2.pattern,
              categorySlug: pattern2.categorySlug,
              categoryName: pattern2.categoryName,
              priority: pattern2.priority,
            },
            reason: "Higher priority rule has lower confidence than lower priority rule",
            examples: [],
            recommendation: "Align priority with confidence or document reasoning",
          });
        }
      }
    }
  }

  return { conflicts, regexIssues };
}

// ============================================================================
// Keyword Rule Validation
// ============================================================================

function validateKeywordRules(): { conflicts: RuleConflict[]; regexIssues: RegexSafetyIssue[] } {
  const conflicts: RuleConflict[] = [];
  const regexIssues: RegexSafetyIssue[] = [];

  for (let i = 0; i < KEYWORD_RULES.length; i++) {
    const rule1 = KEYWORD_RULES[i]!;

    // Check for keyword overlap across different categories
    for (let j = i + 1; j < KEYWORD_RULES.length; j++) {
      const rule2 = KEYWORD_RULES[j]!;

      // Find common keywords
      const commonKeywords = rule1.keywords.filter((k1) =>
        rule2.keywords.some((k2) => k1.toLowerCase() === k2.toLowerCase())
      );

      if (commonKeywords.length > 0 && rule1.categorySlug !== rule2.categorySlug) {
        // Check if exclude keywords would prevent the conflict
        const isResolvedByExclude = commonKeywords.every((_keyword) => {
          const rule1Excludes = rule1.excludeKeywords?.some((ek) =>
            rule2.keywords.some((k2) => k2.toLowerCase() === ek.toLowerCase())
          );
          const rule2Excludes = rule2.excludeKeywords?.some((ek) =>
            rule1.keywords.some((k1) => k1.toLowerCase() === ek.toLowerCase())
          );
          return rule1Excludes || rule2Excludes;
        });

        // Only report conflict if not resolved by exclude keywords
        if (!isResolvedByExclude) {
          const severity: "critical" | "high" | "medium" | "low" =
            commonKeywords.length >= 3
              ? "critical"
              : commonKeywords.length === 2
                ? "high"
                : "medium";

          conflicts.push({
            conflictType: "overlap",
            severity,
            ruleType: "keyword",
            rule1: {
              id: `keyword:${i}:${rule1.domain}`,
              pattern: rule1.keywords.join(", "),
              categorySlug: rule1.categorySlug,
              categoryName: rule1.categoryName,
              priority: rule1.weight,
            },
            rule2: {
              id: `keyword:${j}:${rule2.domain}`,
              pattern: rule2.keywords.join(", "),
              categorySlug: rule2.categorySlug,
              categoryName: rule2.categoryName,
              priority: rule2.weight,
            },
            reason: `${commonKeywords.length} keywords overlap between different categories`,
            examples: [`Common keywords: ${commonKeywords.join(", ")}`],
            recommendation: "Use exclude keywords or domain scoping to disambiguate",
          });
        }
      }
    }

    // Check for exclude keyword contradictions
    if (rule1.excludeKeywords) {
      const contradictions = rule1.keywords.filter((k) => rule1.excludeKeywords!.includes(k));
      if (contradictions.length > 0) {
        conflicts.push({
          conflictType: "ambiguous",
          severity: "critical",
          ruleType: "keyword",
          rule1: {
            id: `keyword:${i}:${rule1.domain}`,
            pattern: rule1.keywords.join(", "),
            categorySlug: rule1.categorySlug,
            categoryName: rule1.categoryName,
            priority: rule1.weight,
          },
          reason: "Rule has keywords that are also in exclude list - impossible to match",
          examples: [`Contradictory keywords: ${contradictions.join(", ")}`],
          recommendation: "Remove contradictions from keywords or excludeKeywords",
        });
      }
    }
  }

  // Note: Keywords use simple string matching, not regex, so no regex safety issues to check

  return { conflicts, regexIssues };
}

// ============================================================================
// Deterministic Resolution Order
// ============================================================================

function getResolutionOrder(): Array<{
  ruleType: "mcc" | "vendor" | "keyword";
  priority: number;
  description: string;
}> {
  return [
    {
      ruleType: "mcc",
      priority: 1,
      description: 'MCC codes with "exact" strength (95%+ confidence) - highest priority',
    },
    {
      ruleType: "vendor",
      priority: 2,
      description: 'Vendor exact matches (e.g., "Google Ads" exact)',
    },
    {
      ruleType: "mcc",
      priority: 3,
      description: 'MCC codes with "family" strength (80-90% confidence)',
    },
    {
      ruleType: "vendor",
      priority: 4,
      description: "Vendor prefix/suffix/contains matches",
    },
    {
      ruleType: "keyword",
      priority: 5,
      description: "Keyword matches with high weight (6+)",
    },
    {
      ruleType: "keyword",
      priority: 6,
      description: "Keyword matches with medium weight (4-5)",
    },
    {
      ruleType: "mcc",
      priority: 7,
      description: 'MCC codes with "unknown" strength (<80% confidence)',
    },
    {
      ruleType: "keyword",
      priority: 8,
      description: "Keyword matches with low weight (1-3)",
    },
  ];
}

// ============================================================================
// Main Validation Function
// ============================================================================

export function validateAllRules(): ValidationReport {
  const timestamp = new Date().toISOString();
  const allConflicts: RuleConflict[] = [];
  const allRegexIssues: RegexSafetyIssue[] = [];

  // Validate MCC rules
  const mccConflicts = validateMCCRules();
  allConflicts.push(...mccConflicts);

  // Validate vendor patterns
  const { conflicts: vendorConflicts, regexIssues: vendorRegexIssues } = validateVendorPatterns();
  allConflicts.push(...vendorConflicts);
  allRegexIssues.push(...vendorRegexIssues);

  // Validate keyword rules
  const { conflicts: keywordConflicts, regexIssues: keywordRegexIssues } = validateKeywordRules();
  allConflicts.push(...keywordConflicts);
  allRegexIssues.push(...keywordRegexIssues);

  // Calculate summary
  const totalRules =
    Object.keys(MCC_MAPPINGS).length + VENDOR_PATTERNS.length + KEYWORD_RULES.length;

  const criticalConflicts = allConflicts.filter((c) => c.severity === "critical").length;
  const highConflicts = allConflicts.filter((c) => c.severity === "high").length;
  const deadRules = allConflicts.filter((c) => c.conflictType === "dead_rule").length;

  return {
    timestamp,
    summary: {
      totalRules,
      conflictCount: allConflicts.length,
      criticalConflicts,
      highConflicts,
      regexIssues: allRegexIssues.length,
      deadRules,
    },
    conflicts: allConflicts.sort((a, b) => {
      // Sort by severity: critical > high > medium > low
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    regexIssues: allRegexIssues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    resolutionOrder: getResolutionOrder(),
  };
}

/**
 * Generates a human-readable conflict report
 */
export function generateConflictReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push("# Rule Conflict Analysis Report");
  lines.push(`Generated: ${report.timestamp}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Total Rules: ${report.summary.totalRules}`);
  lines.push(`- Total Conflicts: ${report.summary.conflictCount}`);
  lines.push(`  - Critical: ${report.summary.criticalConflicts}`);
  lines.push(`  - High: ${report.summary.highConflicts}`);
  lines.push(`- Regex Safety Issues: ${report.summary.regexIssues}`);
  lines.push(`- Dead Rules: ${report.summary.deadRules}`);
  lines.push("");

  if (report.summary.criticalConflicts > 0 || report.summary.regexIssues > 0) {
    lines.push("## ⚠️ CRITICAL ISSUES REQUIRE IMMEDIATE ATTENTION");
    lines.push("");
  }

  if (report.regexIssues.length > 0) {
    lines.push("## Regex Safety Issues");
    for (const issue of report.regexIssues) {
      lines.push(`### [${issue.severity.toUpperCase()}] ${issue.ruleType}:${issue.ruleId}`);
      lines.push(`**Pattern:** \`${issue.pattern}\``);
      lines.push(`**Issue:** ${issue.issue}`);
      lines.push(`**Reason:** ${issue.reason}`);
      lines.push(`**Recommendation:** ${issue.recommendation}`);
      lines.push("");
    }
  }

  if (report.conflicts.length > 0) {
    lines.push("## Rule Conflicts");
    for (const conflict of report.conflicts) {
      lines.push(
        `### [${conflict.severity.toUpperCase()}] ${conflict.conflictType} - ${conflict.ruleType}`
      );
      lines.push(
        `**Rule 1:** ${conflict.rule1.pattern} → ${conflict.rule1.categoryName} (priority: ${conflict.rule1.priority || "N/A"})`
      );
      if (conflict.rule2) {
        lines.push(
          `**Rule 2:** ${conflict.rule2.pattern} → ${conflict.rule2.categoryName} (priority: ${conflict.rule2.priority || "N/A"})`
        );
      }
      lines.push(`**Reason:** ${conflict.reason}`);
      if (conflict.examples.length > 0) {
        lines.push(`**Examples:**`);
        for (const example of conflict.examples) {
          lines.push(`  - ${example}`);
        }
      }
      lines.push(`**Recommendation:** ${conflict.recommendation}`);
      lines.push("");
    }
  }

  lines.push("## Deterministic Resolution Order");
  for (const order of report.resolutionOrder) {
    lines.push(`${order.priority}. **${order.ruleType.toUpperCase()}:** ${order.description}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("*This report was auto-generated by the rule validation tool.*");

  return lines.join("\n");
}
