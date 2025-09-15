import type { CategoryId } from '@nexus/types';

/**
 * Signal strength levels for different rule types
 */
export type SignalStrength = 'weak' | 'medium' | 'strong' | 'exact';

/**
 * Individual categorization signal from a specific rule type
 */
export interface CategorizationSignal {
  type: 'mcc' | 'vendor' | 'keyword' | 'pattern' | 'embedding';
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
 */
const SIGNAL_WEIGHTS = {
  mcc: 4.0,      // Strong foundation signal
  vendor: 3.5,   // High confidence for known vendors
  keyword: 2.0,  // Medium confidence, domain-dependent
  pattern: 1.5,  // Lower confidence, more generic
  embedding: 1.0 // Boost only, not standalone
} as const;

/**
 * Confidence modifiers based on signal strength
 */
const STRENGTH_MODIFIERS = {
  exact: 1.0,   // No modification
  strong: 0.9,  // Slight reduction
  medium: 0.75, // Moderate reduction
  weak: 0.6     // Significant reduction
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
  type: CategorizationSignal['type'],
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
      details
    }
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
    throw new Error('Cannot aggregate empty signals array');
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

  // Confidence calculation: blend of max confidence and normalized score with signal count bonus
  const signalCountBonus = Math.min(0.15, (signals.length - 1) * 0.05); // Max 15% bonus for multiple signals
  const blendedConfidence = Math.min(0.98, 
    (maxConfidence * 0.7 + normalizedScore * 0.3) + signalCountBonus
  );

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
    dominantSignal
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
      rationale: ['No categorization signals found']
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
  for (const [categoryId, categorySignals] of signalsByCategory) {
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
    rationale.push(`best: ${bestCategory.categoryName} (confidence: ${bestCategory.confidence.toFixed(3)})`);
    
    // Add dominant signal details
    const dominant = bestCategory.dominantSignal;
    rationale.push(`dominant: ${dominant.metadata.source} → ${dominant.metadata.details}`);
    
    // Add supporting signals
    const supportingSignals = bestCategory.signals
      .filter(s => s !== dominant)
      .slice(0, 2); // Limit to top 2 supporting signals
    
    for (const signal of supportingSignals) {
      rationale.push(`supporting: ${signal.metadata.source} → ${signal.metadata.details}`);
    }

    // Mention if there are competing categories
    if (categoryScores.length > 1) {
      const secondBest = categoryScores[1]!;
      const scoreDiff = bestCategory.totalScore - secondBest.totalScore;
      if (scoreDiff < 0.2) { // Close competition
        rationale.push(`competing: ${secondBest.categoryName} (score diff: ${scoreDiff.toFixed(3)})`);
      }
    }
  } else {
    rationale.push('No category met minimum scoring thresholds');
    rationale.push(`signals processed: ${signals.length}, categories considered: ${signalsByCategory.size}`);
  }

  return {
    bestCategory,
    allCandidates: categoryScores,
    rationale
  };
}

/**
 * Calibrates confidence score to avoid uniform distributions
 * Maps internal confidence to calibrated output confidence using non-linear scaling
 */
export function calibrateConfidence(internalConfidence: number, signalCount: number): number {
  if (internalConfidence <= 0) return 0;
  if (internalConfidence >= 0.98) return 0.98;

  // Apply sigmoid-like transformation to create non-linear distribution
  // This helps avoid uniform confidence values
  const x = (internalConfidence - 0.5) * 6; // Scale input to roughly [-3, 3]
  const sigmoid = 1 / (1 + Math.exp(-x));
  
  // Apply signal count bonus (more signals = higher confidence)
  const signalBonus = Math.min(0.1, Math.log(signalCount + 1) * 0.05);
  
  // Map sigmoid output to [0.1, 0.95] range with bonus
  const calibrated = 0.1 + (sigmoid * 0.85) + signalBonus;
  
  return Math.min(0.98, Math.max(0.05, calibrated));
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
      bins: new Array(10).fill(0)
    };
  }

  const confidences = scores.map(s => s.confidence).sort((a, b) => a - b);
  
  // Calculate statistics
  const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const median = confidences[Math.floor(confidences.length / 2)] || 0;
  
  const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
  const std = Math.sqrt(variance);
  
  const range = {
    min: confidences[0] || 0,
    max: confidences[confidences.length - 1] || 0
  };

  // Create histogram bins (10 bins from 0.0 to 1.0)
  const bins = new Array(10).fill(0);
  for (const confidence of confidences) {
    const binIndex = Math.min(9, Math.floor(confidence * 10));
    bins[binIndex]++;
  }

  return { mean, median, std, range, bins };
}