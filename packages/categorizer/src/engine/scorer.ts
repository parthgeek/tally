import type { CategoryId } from "@nexus/types";

/**
 * Signal strength levels for different rule types
 */
export type SignalStrength = "weak" | "medium" | "strong" | "exact";

/**
 * Individual categorization signal from a specific rule type
 */
export interface CategorizationSignal {
  type: "mcc" | "vendor" | "keyword" | "pattern" | "embedding";
  categoryId: CategoryId;
  categoryName: string;
  strength: SignalStrength;
  confidence: number;
  weight: number;
  metadata: {
    source: string; // e.g., "MCC:7230", "vendor:adobe", "keyword:software"
    details: string; // Human-readable explanation
    matchedTerms?: string[]; // For keywords, patterns
  };
}

/**
 * Aggregated score for a specific category
 */
export interface CategoryScore {
  categoryId: CategoryId;
  categoryName: string;
  totalScore: number;
  confidence: number;
  signals: CategorizationSignal[];
  dominantSignal: CategorizationSignal;
}

/**
 * Complete scoring result with all candidates
 */
export interface ScoringResult {
  bestCategory: CategoryScore | undefined;
  allCandidates: CategoryScore[];
  rationale: string[];
}

/**
 * Weights for different signal types in score aggregation
 * Updated for e-commerce context where vendor+keyword combinations
 * are often more reliable than MCC alone
 */
const SIGNAL_WEIGHTS = {
  mcc: 4.5, // Increased - now e-commerce-specific MCCs
  vendor: 4.0, // Increased - now context-aware (no ambiguous patterns)
  keyword: 2.5, // Increased - now e-commerce-specific keywords
  pattern: 1.5, // Unchanged - still lower confidence
  embedding: 1.0, // Unchanged - boost only, not standalone
} as const;

/**
 * Confidence modifiers based on signal strength
 */
const STRENGTH_MODIFIERS = {
  exact: 1.0, // No modification
  strong: 0.9, // Slight reduction
  medium: 0.75, // Moderate reduction
  weak: 0.6, // Significant reduction
} as const;

/**
 * Minimum thresholds for category consideration
 */
const MIN_SCORE_THRESHOLD = 0.5;
const MIN_CONFIDENCE_THRESHOLD = 0.1;

/**
 * Creates a categorization signal
 */
export function createSignal(
  type: CategorizationSignal["type"],
  categoryId: CategoryId,
  categoryName: string,
  strength: SignalStrength,
  baseConfidence: number,
  source: string,
  details: string,
  matchedTerms?: string[]
): CategorizationSignal {
  const weight = SIGNAL_WEIGHTS[type];
  const strengthModifier = STRENGTH_MODIFIERS[strength];
  const confidence = Math.min(0.98, baseConfidence * strengthModifier);

  const result: CategorizationSignal = {
    type,
    categoryId,
    categoryName,
    strength,
    confidence,
    weight,
    metadata: {
      source,
      details,
    },
  };

  if (matchedTerms) {
    result.metadata.matchedTerms = matchedTerms;
  }

  return result;
}

/**
 * Aggregates signals for the same category using weighted scoring
 */
function aggregateSignalsForCategory(signals: CategorizationSignal[]): CategoryScore {
  if (signals.length === 0) {
    throw new Error("Cannot aggregate empty signals array");
  }

  const firstSignal = signals[0]!;
  const categoryId = firstSignal.categoryId;
  const categoryName = firstSignal.categoryName;

  // Calculate weighted score
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let maxConfidence = 0;

  for (const signal of signals) {
    const weightedScore = signal.confidence * signal.weight;
    totalWeightedScore += weightedScore;
    totalWeight += signal.weight;
    maxConfidence = Math.max(maxConfidence, signal.confidence);
  }

  // Normalized score based on weights
  const normalizedScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  // NEW: Compound signal bonus - reward high-value signal combinations
  const signalTypes = new Set(signals.map((s) => s.type));
  let compoundBonus = 0;

  // Strong combinations that dramatically increase confidence
  if (signalTypes.has("mcc") && signalTypes.has("vendor")) {
    compoundBonus += 0.12; // MCC + Vendor is very strong
  } else if (signalTypes.has("vendor") && signalTypes.has("keyword")) {
    compoundBonus += 0.1; // Vendor + Keyword is strong
  } else if (signalTypes.has("mcc") && signalTypes.has("keyword")) {
    compoundBonus += 0.08; // MCC + Keyword is good
  }

  // Additional bonus for 3+ distinct signal types
  if (signalTypes.size >= 3) {
    compoundBonus += 0.05;
  }

  // Confidence calculation: blend of max confidence and normalized score with signal count bonus
  const signalCountBonus = Math.min(0.15, (signals.length - 1) * 0.05); // Max 15% bonus for multiple signals
  const baseConfidence = maxConfidence * 0.7 + normalizedScore * 0.3;
  const blendedConfidence = Math.min(0.98, baseConfidence + signalCountBonus + compoundBonus);

  // Find the dominant (highest confidence) signal
  const dominantSignal = signals.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  return {
    categoryId,
    categoryName,
    totalScore: normalizedScore,
    confidence: blendedConfidence,
    signals,
    dominantSignal,
  };
}

/**
 * Scores all signals and returns aggregated results by category
 */
export function scoreSignals(signals: CategorizationSignal[]): ScoringResult {
  if (signals.length === 0) {
    return {
      bestCategory: undefined,
      allCandidates: [],
      rationale: ["No categorization signals found"],
    };
  }

  // Group signals by category
  const signalsByCategory = new Map<CategoryId, CategorizationSignal[]>();
  for (const signal of signals) {
    if (!signalsByCategory.has(signal.categoryId)) {
      signalsByCategory.set(signal.categoryId, []);
    }
    signalsByCategory.get(signal.categoryId)!.push(signal);
  }

  // Aggregate scores for each category
  const categoryScores: CategoryScore[] = [];
  for (const [, categorySignals] of signalsByCategory) {
    const score = aggregateSignalsForCategory(categorySignals);

    // Apply minimum thresholds
    if (score.totalScore >= MIN_SCORE_THRESHOLD && score.confidence >= MIN_CONFIDENCE_THRESHOLD) {
      categoryScores.push(score);
    }
  }

  // Sort by total score (descending)
  categoryScores.sort((a, b) => b.totalScore - a.totalScore);

  // Find best category
  const bestCategory = categoryScores.length > 0 ? categoryScores[0] : undefined;

  // Generate rationale
  const rationale: string[] = [];
  if (bestCategory) {
    rationale.push(
      `best: ${bestCategory.categoryName} (confidence: ${bestCategory.confidence.toFixed(3)})`
    );

    // Add dominant signal details
    const dominant = bestCategory.dominantSignal;
    rationale.push(`dominant: ${dominant.metadata.source} → ${dominant.metadata.details}`);

    // Add supporting signals
    const supportingSignals = bestCategory.signals.filter((s) => s !== dominant).slice(0, 2); // Limit to top 2 supporting signals

    for (const signal of supportingSignals) {
      rationale.push(`supporting: ${signal.metadata.source} → ${signal.metadata.details}`);
    }

    // Mention if there are competing categories
    if (categoryScores.length > 1) {
      const secondBest = categoryScores[1]!;
      const scoreDiff = bestCategory.totalScore - secondBest.totalScore;
      if (scoreDiff < 0.2) {
        // Close competition
        rationale.push(
          `competing: ${secondBest.categoryName} (score diff: ${scoreDiff.toFixed(3)})`
        );
      }
    }
  } else {
    rationale.push("No category met minimum scoring thresholds");
    rationale.push(
      `signals processed: ${signals.length}, categories considered: ${signalsByCategory.size}`
    );
  }

  return {
    bestCategory,
    allCandidates: categoryScores,
    rationale,
  };
}

/**
 * Calibrates confidence score to avoid uniform distributions
 * Maps internal confidence to calibrated output confidence using non-linear scaling
 *
 * Strategy:
 * - Preserve high-confidence signals (0.90+) with minimal compression
 * - Apply sigmoid transformation to medium/low confidence (< 0.90)
 * - Add signal count bonus to reward multiple confirming signals
 */
export function calibrateConfidence(internalConfidence: number, signalCount: number): number {
  // Edge case: When both confidence and signal count are zero, return 0 to indicate
  // complete absence of categorization signals (no basis for any confidence level)
  if (internalConfidence <= 0 && signalCount === 0) return 0;

  // When confidence is low but signals exist, apply minimum floor to prevent
  // completely zeroing out categorization attempts with weak signals
  if (internalConfidence <= 0) return 0.05;

  // Cap maximum confidence to prevent overconfident predictions
  if (internalConfidence >= 0.98) return 0.98;

  // NEW: Preserve high-confidence zone (0.90+) with minimal compression
  // These are strong signals that should reach auto-apply threshold
  if (internalConfidence >= 0.9) {
    const signalBonus = Math.min(0.03, Math.log(signalCount + 1) * 0.02);
    return Math.min(0.98, internalConfidence + signalBonus);
  }

  // Apply sigmoid transformation only to medium/low confidence (< 0.90)
  // This creates better separation between weak and moderate signals
  const x = (internalConfidence - 0.45) * 6; // Shift center slightly lower to 0.45
  const sigmoid = 1 / (1 + Math.exp(-x));

  // Apply signal count bonus (more signals = higher confidence)
  const signalBonus = Math.min(0.1, Math.log(signalCount + 1) * 0.05);

  // Map sigmoid output to [0.1, 0.85] range with bonus (max 0.95 with bonus)
  const calibrated = 0.1 + sigmoid * 0.75 + signalBonus;

  return Math.min(0.98, Math.max(0.05, calibrated));
}

/**
 * Calibrates LLM confidence scores to match observed accuracy
 *
 * LLMs (especially Gemini) tend to be overconfident, reporting ~98% confidence
 * even when actual accuracy is 88-90%. This function applies temperature scaling
 * (Platt scaling) to calibrate LLM confidence to match real-world accuracy.
 *
 * Based on ablation study findings:
 * - Baseline: 97.6% avg confidence, 88% actual accuracy (9.6 point gap)
 * - Temperature 0.5: 97.7% avg confidence, 89% actual accuracy (8.7 point gap)
 *
 * Calibration strategy:
 * 1. Apply temperature scaling to compress high-confidence predictions
 * 2. Use beta distribution to model uncertainty
 * 3. Adjust based on Pass1 signal strength (if available)
 *
 * @param rawConfidence - Raw confidence from LLM (0-1)
 * @param hasStrongPass1Signal - Whether Pass1 provided strong supporting evidence
 * @returns Calibrated confidence (0-1)
 */
export function calibrateLLMConfidence(
  rawConfidence: number,
  hasStrongPass1Signal: boolean = false
): number {
  // Edge cases
  if (rawConfidence <= 0) return 0.05;
  if (rawConfidence >= 1.0) return 0.95;

  // Temperature scaling parameter (fitted from ablation data)
  // Higher temperature = more aggressive compression of high confidence
  const temperature = 2.5;

  // Apply temperature scaling (logistic function)
  // Convert confidence to logits, scale, then convert back to probability
  const epsilon = 1e-10; // Prevent log(0)
  const logit = Math.log((rawConfidence + epsilon) / (1 - rawConfidence + epsilon));
  const scaledLogit = logit / temperature;
  const calibratedBase = 1 / (1 + Math.exp(-scaledLogit));

  // Apply beta distribution to model uncertainty
  // Beta(alpha=2, beta=2) gives more weight to middle values
  // This prevents extreme confidence scores
  const alpha = 2;
  const beta = 2;
  const betaAdjustment =
    Math.pow(calibratedBase, alpha - 1) * Math.pow(1 - calibratedBase, beta - 1);
  const betaNormalization = 6; // Approximate normalization constant for Beta(2,2)
  const betaCalibrated = calibratedBase * (betaAdjustment * betaNormalization);

  // Boost confidence if Pass1 provided strong supporting signal
  const pass1Boost = hasStrongPass1Signal ? 0.08 : 0;

  // Final calibration: blend temperature scaling with beta adjustment
  const blendWeight = 0.7; // 70% temperature scaling, 30% beta adjustment
  const finalConfidence =
    calibratedBase * blendWeight + betaCalibrated * (1 - blendWeight) + pass1Boost;

  // Clamp to reasonable range [0.25, 0.95]
  // Lower bound 0.25 because LLM made a prediction (some signal)
  // Upper bound 0.95 to avoid overconfidence even with Pass1 boost
  return Math.max(0.25, Math.min(0.95, finalConfidence));
}

/**
 * Gets confidence distribution statistics for analysis
 */
export function getConfidenceDistribution(scores: CategoryScore[]): {
  mean: number;
  median: number;
  std: number;
  range: { min: number; max: number };
  bins: number[];
} {
  if (scores.length === 0) {
    return {
      mean: 0,
      median: 0,
      std: 0,
      range: { min: 0, max: 0 },
      bins: new Array(10).fill(0),
    };
  }

  const confidences = scores.map((s) => s.confidence).sort((a, b) => a - b);

  // Calculate statistics
  const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const median = confidences[Math.floor(confidences.length / 2)] || 0;

  const variance =
    confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
  const std = Math.sqrt(variance);

  const range = {
    min: confidences[0] || 0,
    max: confidences[confidences.length - 1] || 0,
  };

  // Create histogram bins (10 bins from 0.0 to 1.0)
  const bins = new Array(10).fill(0);
  for (const confidence of confidences) {
    const binIndex = Math.min(9, Math.floor(confidence * 10));
    bins[binIndex]++;
  }

  return { mean, median, std, range, bins };
}

/**
 * Amount-based heuristics for confidence adjustment
 * Uses transaction amount patterns to refine categorization
 */

interface AmountHeuristic {
  modifier: number; // Confidence adjustment (-0.2 to +0.2)
  reason: string;
}

/**
 * Applies amount-based heuristics to adjust confidence
 * Returns a modifier (-0.2 to +0.2) and reason
 */
export function applyAmountHeuristics(
  amountCents: string,
  categoryId: CategoryId,
  merchantName?: string
): AmountHeuristic {
  const amount = Math.abs(parseInt(amountCents, 10)) / 100; // Convert to dollars

  // Payment Processing Fees (typically small amounts)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440301" as CategoryId)) {
    if (amount < 1.0) {
      return { modifier: +0.15, reason: "Very small amount typical of processing fees" };
    } else if (amount < 10.0) {
      return { modifier: +0.1, reason: "Small amount consistent with processing fees" };
    } else if (amount > 100.0) {
      return { modifier: -0.1, reason: "Large amount unusual for processing fees" };
    }
  }

  // Refunds (negative amounts or "refund" in name)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440105" as CategoryId)) {
    if (parseInt(amountCents, 10) < 0) {
      return { modifier: +0.15, reason: "Negative amount strongly indicates refund" };
    }
    // Positive amounts for refunds are less certain
    if (parseInt(amountCents, 10) > 0 && amount > 1000.0) {
      return {
        modifier: -0.08,
        reason: "Large positive amount less typical for refund processing",
      };
    }
  }

  // Payouts & Clearing (typically large positive amounts)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440503" as CategoryId)) {
    if (amount > 1000.0) {
      return { modifier: +0.12, reason: "Large amount typical of payout/settlement" };
    } else if (amount < 100.0) {
      return { modifier: -0.1, reason: "Small amount unusual for payouts" };
    }
  }

  // Supplier Purchases (typically medium to large amounts)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440205" as CategoryId)) {
    if (amount > 500.0) {
      return {
        modifier: +0.08,
        reason: "Large amount consistent with wholesale/supplier purchase",
      };
    } else if (amount < 50.0) {
      return { modifier: -0.08, reason: "Small amount less typical for supplier purchases" };
    }
  }

  // Shipping & Postage (typically small to medium amounts)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440207" as CategoryId)) {
    if (amount >= 5.0 && amount <= 200.0) {
      return { modifier: +0.08, reason: "Amount typical for shipping costs" };
    } else if (amount > 500.0) {
      return { modifier: -0.1, reason: "Large amount unusual for individual shipping" };
    }
  }

  // Marketing & Ads (can be any size, but patterns exist)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440303" as CategoryId)) {
    // Round numbers often indicate ad spend budgets
    if (amount >= 100 && amount % 100 === 0) {
      return { modifier: +0.05, reason: "Round amount typical of ad spend budgets" };
    }
  }

  // Software Subscriptions (typically recurring round amounts)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440304" as CategoryId)) {
    // Common subscription amounts: $9, $19, $29, $49, $99, etc.
    const commonPrices = [9, 19, 29, 39, 49, 59, 79, 99, 149, 199, 299];
    if (commonPrices.some((price) => Math.abs(amount - price) < 0.5)) {
      return { modifier: +0.1, reason: "Amount matches common SaaS pricing tiers" };
    }
  }

  // Labor/Payroll (typically larger round amounts)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440305" as CategoryId)) {
    if (amount > 500.0 && (amount % 100 === 0 || amount % 50 === 0)) {
      return { modifier: +0.08, reason: "Large round amount typical of payroll" };
    }
  }

  // Taxes & Liabilities (typically larger amounts, often round)
  if (categoryId === ("550e8400-e29b-41d4-a716-446655440601" as CategoryId)) {
    if (amount > 100.0) {
      return { modifier: +0.08, reason: "Substantial amount typical of tax payments" };
    }
  }

  // No adjustment
  return { modifier: 0, reason: "Amount within expected range" };
}
