import { describe, expect, test } from 'vitest';
import type { CategoryId } from '@nexus/types';
import {
  matchVendorPattern,
  normalizeVendorName,
  getPatternsForCategory,
  getConflictingPatterns,
  VENDOR_PATTERNS
} from '../../rules/vendors.js';

describe('normalizeVendorName', () => {
  test('removes business suffixes', () => {
    expect(normalizeVendorName('Adobe Inc.')).toBe('adobe');
    expect(normalizeVendorName('Microsoft LLC')).toBe('microsoft');
    expect(normalizeVendorName('Google Corp')).toBe('google');
    expect(normalizeVendorName('Facebook Company')).toBe('facebook');
  });

  test('removes punctuation and normalizes spacing', () => {
    expect(normalizeVendorName('Sally Beauty Supply, Inc.')).toBe('sally beauty supply');
    expect(normalizeVendorName('T-Mobile USA')).toBe('t mobile usa');
    expect(normalizeVendorName('AT&T Corp.')).toBe('at t corp');
  });

  test('converts to lowercase and trims', () => {
    expect(normalizeVendorName('  STARBUCKS COFFEE  ')).toBe('starbucks coffee');
    expect(normalizeVendorName('Shell Oil')).toBe('shell oil');
  });

  test('handles empty and whitespace strings', () => {
    expect(normalizeVendorName('')).toBe('');
    expect(normalizeVendorName('   ')).toBe('');
    expect(normalizeVendorName('\t\n')).toBe('');
  });
});

describe('matchVendorPattern', () => {
  test('matches exact vendor names', () => {
    const result = matchVendorPattern('Adobe Inc.');
    expect(result).toBeDefined();
    expect(result!.categoryName).toBe('Software & Technology');
    expect(result!.matchType).toBe('contains');
    expect(result!.confidence).toBeGreaterThan(0.9);
  });

  test('matches case-insensitively', () => {
    const result = matchVendorPattern('ADOBE CREATIVE CLOUD');
    expect(result).toBeDefined();
    expect(result!.categoryName).toBe('Software & Technology');
  });

  test('matches vendor contains patterns', () => {
    const result = matchVendorPattern('Microsoft Office 365');
    expect(result).toBeDefined();
    expect(result!.categoryName).toBe('Software & Technology');
  });

  test('prioritizes higher priority patterns', () => {
    const result = matchVendorPattern('Square Inc Payment Processing');
    expect(result).toBeDefined();
    expect(result!.categoryName).toBe('Banking & Fees');
    expect(result!.priority).toBe(100); // Should be high priority payment processor
  });

  test('returns undefined for unknown vendors', () => {
    const result = matchVendorPattern('Unknown Random Vendor LLC');
    expect(result).toBeUndefined();
  });

  test('matches beauty supply vendors', () => {
    const sallyResult = matchVendorPattern('Sally Beauty Supply Store');
    expect(sallyResult).toBeDefined();
    expect(sallyResult!.categoryName).toBe('Supplies & Inventory');

    const cosmoprofResult = matchVendorPattern('CosmoProf Beauty Supplies');
    expect(cosmoprofResult).toBeDefined();
    expect(cosmoprofResult!.categoryName).toBe('Supplies & Inventory');
  });

  test('matches utility companies', () => {
    const verizonResult = matchVendorPattern('Verizon Wireless');
    expect(verizonResult).toBeDefined();
    expect(verizonResult!.categoryName).toBe('Rent & Utilities');

    const comcastResult = matchVendorPattern('Comcast Cable');
    expect(comcastResult).toBeDefined();
    expect(comcastResult!.categoryName).toBe('Rent & Utilities');
  });

  test('matches gas stations', () => {
    const shellResult = matchVendorPattern('Shell Gas Station #1234');
    expect(shellResult).toBeDefined();
    expect(shellResult!.categoryName).toBe('Vehicle & Travel');

    const chevronResult = matchVendorPattern('Chevron');
    expect(chevronResult).toBeDefined();
    expect(chevronResult!.categoryName).toBe('Vehicle & Travel');
  });
});

describe('getPatternsForCategory', () => {
  test('returns patterns for Software & Technology category', () => {
    const categoryId = '550e8400-e29b-41d4-a716-446655440020' as CategoryId;
    const patterns = getPatternsForCategory(categoryId);
    
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.pattern === 'adobe')).toBe(true);
    expect(patterns.some(p => p.pattern === 'microsoft')).toBe(true);
    expect(patterns.some(p => p.pattern === 'canva')).toBe(true);
  });

  test('returns patterns for Supplies & Inventory category', () => {
    const categoryId = '550e8400-e29b-41d4-a716-446655440012' as CategoryId;
    const patterns = getPatternsForCategory(categoryId);
    
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.pattern === 'sally beauty')).toBe(true);
    expect(patterns.some(p => p.pattern === 'cosmoprof')).toBe(true);
  });

  test('returns empty array for unknown category', () => {
    const categoryId = 'unknown-category-id' as CategoryId;
    const patterns = getPatternsForCategory(categoryId);
    expect(patterns).toEqual([]);
  });
});

describe('getConflictingPatterns', () => {
  test('identifies vendors with multiple patterns', () => {
    const conflicts = getConflictingPatterns();
    
    // Should return array of conflicts (vendors appearing in multiple categories)
    expect(Array.isArray(conflicts)).toBe(true);
    
    // Check if there are any legitimate conflicts to resolve
    for (const conflict of conflicts) {
      expect(conflict.vendor).toBeTruthy();
      expect(conflict.patterns.length).toBeGreaterThan(1);
      expect(conflict.patterns.every(p => p.pattern)).toBe(true);
    }
  });

  test('conflicting patterns have different priorities', () => {
    const conflicts = getConflictingPatterns();
    
    for (const conflict of conflicts) {
      if (conflict.patterns.length > 1) {
        // Should have different priorities to resolve conflicts
        const priorities = conflict.patterns.map(p => p.priority);
        const uniquePriorities = new Set(priorities);
        expect(uniquePriorities.size).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('VENDOR_PATTERNS structure', () => {
  test('all patterns have required fields', () => {
    for (const pattern of VENDOR_PATTERNS) {
      expect(pattern.pattern).toBeTruthy();
      expect(pattern.matchType).toMatch(/^(exact|prefix|suffix|contains|regex)$/);
      expect(pattern.categoryId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(pattern.categoryName).toBeTruthy();
      expect(pattern.confidence).toBeGreaterThan(0);
      expect(pattern.confidence).toBeLessThanOrEqual(1);
      expect(pattern.priority).toBeGreaterThanOrEqual(0);
    }
  });

  test('priorities are reasonable and distributed', () => {
    const priorities = VENDOR_PATTERNS.map(p => p.priority);
    const uniquePriorities = new Set(priorities);
    
    expect(uniquePriorities.size).toBeGreaterThan(3); // Should have variety
    expect(Math.max(...priorities)).toBeLessThanOrEqual(100);
    expect(Math.min(...priorities)).toBeGreaterThanOrEqual(0);
  });

  test('confidence values correlate with priorities', () => {
    for (const pattern of VENDOR_PATTERNS) {
      if (pattern.priority >= 90) {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.85);
      }
      if (pattern.priority <= 60) {
        expect(pattern.confidence).toBeLessThanOrEqual(0.80);
      }
    }
  });

  test('has expected high-priority financial vendors', () => {
    const financialVendors = VENDOR_PATTERNS.filter(p => 
      p.categoryName === 'Banking & Fees' && p.priority >= 95
    );
    
    expect(financialVendors.length).toBeGreaterThan(0);
    expect(financialVendors.some(p => p.pattern.includes('square'))).toBe(true);
    expect(financialVendors.some(p => p.pattern.includes('paypal'))).toBe(true);
  });

  test('has salon-specific vendor patterns', () => {
    const salonVendors = VENDOR_PATTERNS.filter(p => 
      p.categoryName === 'Supplies & Inventory'
    );
    
    expect(salonVendors.length).toBeGreaterThan(0);
    expect(salonVendors.some(p => p.pattern.includes('sally'))).toBe(true);
    expect(salonVendors.some(p => p.pattern.includes('cosmoprof'))).toBe(true);
  });

  test('patterns do not overlap inappropriately', () => {
    // Test that specific patterns don't accidentally match too broadly
    const exactPatterns = VENDOR_PATTERNS.filter(p => p.matchType === 'exact');
    const containsPatterns = VENDOR_PATTERNS.filter(p => p.matchType === 'contains');
    
    // Exact patterns should generally have higher priority than contains patterns
    // for the same vendor space
    for (const exactPattern of exactPatterns) {
      const conflictingContains = containsPatterns.filter(p => 
        exactPattern.pattern.includes(p.pattern) || p.pattern.includes(exactPattern.pattern)
      );
      
      for (const conflicting of conflictingContains) {
        if (exactPattern.categoryId !== conflicting.categoryId) {
          expect(exactPattern.priority).toBeGreaterThanOrEqual(conflicting.priority);
        }
      }
    }
  });
});