import { describe, expect, test } from 'vitest';
import type { CategoryId } from '@nexus/types';
import {
  createSignal,
  scoreSignals,
  calibrateConfidence,
  getConfidenceDistribution,
  type CategorizationSignal,
  type CategoryScore
} from '../../engine/scorer.js';

const HAIR_SERVICES_ID = '550e8400-e29b-41d4-a716-446655440002' as CategoryId;
const SOFTWARE_ID = '550e8400-e29b-41d4-a716-446655440020' as CategoryId;
const SUPPLIES_ID = '550e8400-e29b-41d4-a716-446655440012' as CategoryId;

describe('createSignal', () => {
  test('creates MCC signal with correct properties', () => {
    const signal = createSignal(
      'mcc',
      HAIR_SERVICES_ID,
      'Hair Services',
      'exact',
      0.95,
      'MCC:7230',
      'Hair salon services'
    );

    expect(signal.type).toBe('mcc');
    expect(signal.categoryId).toBe(HAIR_SERVICES_ID);
    expect(signal.categoryName).toBe('Hair Services');
    expect(signal.strength).toBe('exact');
    expect(signal.confidence).toBe(0.95); // Exact strength, no modification
    expect(signal.weight).toBe(4.0); // MCC weight
    expect(signal.metadata.source).toBe('MCC:7230');
    expect(signal.metadata.details).toBe('Hair salon services');
  });

  test('applies strength modifiers to confidence', () => {
    const exactSignal = createSignal('vendor', HAIR_SERVICES_ID, 'Hair Services', 'exact', 0.8, 'vendor:test', 'test');
    const strongSignal = createSignal('vendor', HAIR_SERVICES_ID, 'Hair Services', 'strong', 0.8, 'vendor:test', 'test');
    const mediumSignal = createSignal('vendor', HAIR_SERVICES_ID, 'Hair Services', 'medium', 0.8, 'vendor:test', 'test');
    const weakSignal = createSignal('vendor', HAIR_SERVICES_ID, 'Hair Services', 'weak', 0.8, 'vendor:test', 'test');

    expect(exactSignal.confidence).toBe(0.8);
    expect(strongSignal.confidence).toBeCloseTo(0.72, 2); // 0.8 * 0.9
    expect(mediumSignal.confidence).toBe(0.6);  // 0.8 * 0.75
    expect(weakSignal.confidence).toBe(0.48);   // 0.8 * 0.6
  });

  test('caps confidence at 0.98', () => {
    const signal = createSignal('mcc', HAIR_SERVICES_ID, 'Hair Services', 'exact', 0.99, 'MCC:7230', 'test');
    expect(signal.confidence).toBe(0.98);
  });

  test('includes matched terms in metadata', () => {
    const signal = createSignal('keyword', SUPPLIES_ID, 'Supplies', 'medium', 0.8, 'keywords', 'test', ['shampoo', 'conditioner']);
    expect(signal.metadata.matchedTerms).toEqual(['shampoo', 'conditioner']);
  });
});

describe('scoreSignals', () => {
  test('returns empty result for no signals', () => {
    const result = scoreSignals([]);
    
    expect(result.bestCategory).toBeUndefined();
    expect(result.allCandidates).toEqual([]);
    expect(result.rationale).toContain('No categorization signals found');
  });

  test('scores single signal correctly', () => {
    const signal = createSignal('mcc', HAIR_SERVICES_ID, 'Hair Services', 'exact', 0.9, 'MCC:7230', 'Hair salon');
    const result = scoreSignals([signal]);
    
    expect(result.bestCategory).toBeDefined();
    expect(result.bestCategory!.categoryId).toBe(HAIR_SERVICES_ID);
    expect(result.bestCategory!.confidence).toBeGreaterThan(0.8);
    expect(result.bestCategory!.signals).toHaveLength(1);
    expect(result.bestCategory!.dominantSignal).toBe(signal);
  });

  test('aggregates multiple signals for same category', () => {
    const mccSignal = createSignal('mcc', HAIR_SERVICES_ID, 'Hair Services', 'exact', 0.9, 'MCC:7230', 'Hair salon');
    const vendorSignal = createSignal('vendor', HAIR_SERVICES_ID, 'Hair Services', 'strong', 0.85, 'vendor:salon', 'Salon vendor');
    
    const result = scoreSignals([mccSignal, vendorSignal]);
    
    expect(result.bestCategory).toBeDefined();
    expect(result.bestCategory!.categoryId).toBe(HAIR_SERVICES_ID);
    expect(result.bestCategory!.signals).toHaveLength(2);
    expect(result.bestCategory!.confidence).toBeGreaterThan(0.9); // Should get signal count bonus
  });

  test('compares different categories correctly', () => {
    const hairSignal = createSignal('vendor', HAIR_SERVICES_ID, 'Hair Services', 'medium', 0.7, 'vendor:salon', 'Salon');
    const softwareSignal = createSignal('mcc', SOFTWARE_ID, 'Software', 'exact', 0.95, 'MCC:7372', 'Software');
    
    const result = scoreSignals([hairSignal, softwareSignal]);
    
    expect(result.bestCategory).toBeDefined();
    expect(result.bestCategory!.categoryId).toBe(SOFTWARE_ID); // Higher confidence should win
    expect(result.allCandidates).toHaveLength(2);
    expect(result.allCandidates[0]!.categoryId).toBe(SOFTWARE_ID); // Should be sorted by score
  });

  test('applies minimum thresholds', () => {
    const weakSignal = createSignal('keyword', HAIR_SERVICES_ID, 'Hair Services', 'weak', 0.05, 'keywords', 'very weak');
    const result = scoreSignals([weakSignal]);
    
    expect(result.bestCategory).toBeUndefined(); // Should be below threshold
    expect(result.allCandidates).toEqual([]);
  });

  test('generates meaningful rationale', () => {
    const mccSignal = createSignal('mcc', HAIR_SERVICES_ID, 'Hair Services', 'exact', 0.9, 'MCC:7230', 'Hair salon services');
    const result = scoreSignals([mccSignal]);
    
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.rationale[0]).toContain('Hair Services');
    expect(result.rationale[1]).toContain('MCC:7230');
  });

  test('identifies competing categories in rationale', () => {
    const hairSignal = createSignal('vendor', HAIR_SERVICES_ID, 'Hair Services', 'medium', 0.75, 'vendor:salon', 'Salon');
    const softwareSignal = createSignal('keyword', SOFTWARE_ID, 'Software', 'medium', 0.72, 'keywords', 'Software');
    
    const result = scoreSignals([hairSignal, softwareSignal]);
    
    expect(result.rationale.some(r => r.includes('competing'))).toBe(true);
  });
});

describe('calibrateConfidence', () => {
  test('transforms confidence non-linearly', () => {
    const low = calibrateConfidence(0.3, 1);
    const medium = calibrateConfidence(0.5, 1);
    const high = calibrateConfidence(0.8, 1);
    
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
    
    // Should not be linear relationship
    const lowMediumDiff = medium - low;
    const mediumHighDiff = high - medium;
    expect(Math.abs(lowMediumDiff - mediumHighDiff)).toBeGreaterThan(0.05);
  });

  test('applies signal count bonus', () => {
    const singleSignal = calibrateConfidence(0.7, 1);
    const multipleSignals = calibrateConfidence(0.7, 3);
    
    expect(multipleSignals).toBeGreaterThan(singleSignal);
  });

  test('respects bounds', () => {
    expect(calibrateConfidence(0, 1)).toBeGreaterThanOrEqual(0.05);
    expect(calibrateConfidence(1, 1)).toBeLessThanOrEqual(0.98);
    expect(calibrateConfidence(-0.1, 1)).toBeGreaterThanOrEqual(0.05);
    expect(calibrateConfidence(1.1, 1)).toBeLessThanOrEqual(0.98);
  });

  test('handles edge cases', () => {
    expect(calibrateConfidence(0, 0)).toBe(0);
    expect(calibrateConfidence(0.98, 10)).toBe(0.98);
  });
});

describe('getConfidenceDistribution', () => {
  test('calculates statistics for empty array', () => {
    const stats = getConfidenceDistribution([]);
    
    expect(stats.mean).toBe(0);
    expect(stats.median).toBe(0);
    expect(stats.std).toBe(0);
    expect(stats.range.min).toBe(0);
    expect(stats.range.max).toBe(0);
    expect(stats.bins).toEqual(new Array(10).fill(0));
  });

  test('calculates statistics for single score', () => {
    const score: CategoryScore = {
      categoryId: HAIR_SERVICES_ID,
      categoryName: 'Hair Services',
      totalScore: 0.8,
      confidence: 0.75,
      signals: [],
      dominantSignal: {} as CategorizationSignal
    };
    
    const stats = getConfidenceDistribution([score]);
    
    expect(stats.mean).toBe(0.75);
    expect(stats.median).toBe(0.75);
    expect(stats.std).toBe(0);
    expect(stats.range.min).toBe(0.75);
    expect(stats.range.max).toBe(0.75);
    expect(stats.bins[7]).toBe(1); // 0.75 falls in bin 7 (0.7-0.8)
  });

  test('calculates statistics for multiple scores', () => {
    const scores: CategoryScore[] = [
      {
        categoryId: HAIR_SERVICES_ID,
        categoryName: 'Hair Services',
        totalScore: 0.9,
        confidence: 0.9,
        signals: [],
        dominantSignal: {} as CategorizationSignal
      },
      {
        categoryId: SOFTWARE_ID,
        categoryName: 'Software',
        totalScore: 0.7,
        confidence: 0.6,
        signals: [],
        dominantSignal: {} as CategorizationSignal
      },
      {
        categoryId: SUPPLIES_ID,
        categoryName: 'Supplies',
        totalScore: 0.8,
        confidence: 0.8,
        signals: [],
        dominantSignal: {} as CategorizationSignal
      }
    ];
    
    const stats = getConfidenceDistribution(scores);
    
    expect(stats.mean).toBeCloseTo(0.767, 2); // (0.9 + 0.6 + 0.8) / 3
    expect(stats.median).toBe(0.8); // Middle value when sorted [0.6, 0.8, 0.9]
    expect(stats.std).toBeGreaterThan(0);
    expect(stats.range.min).toBe(0.6);
    expect(stats.range.max).toBe(0.9);
    
    // Check bins
    expect(stats.bins[6]).toBe(1); // 0.6 in bin 6
    expect(stats.bins[8]).toBe(1); // 0.8 in bin 8
    expect(stats.bins[9]).toBe(1); // 0.9 in bin 9
  });

  test('handles edge confidence values correctly', () => {
    const scores: CategoryScore[] = [
      {
        categoryId: HAIR_SERVICES_ID,
        categoryName: 'Hair Services',
        totalScore: 1.0,
        confidence: 1.0, // Edge case
        signals: [],
        dominantSignal: {} as CategorizationSignal
      },
      {
        categoryId: SOFTWARE_ID,
        categoryName: 'Software',
        totalScore: 0.0,
        confidence: 0.0, // Edge case
        signals: [],
        dominantSignal: {} as CategorizationSignal
      }
    ];
    
    const stats = getConfidenceDistribution(scores);
    
    expect(stats.bins[0]).toBe(1); // 0.0 in bin 0
    expect(stats.bins[9]).toBe(1); // 1.0 in bin 9 (max bin)
  });
});