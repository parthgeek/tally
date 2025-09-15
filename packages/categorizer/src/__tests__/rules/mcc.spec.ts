import { describe, expect, test } from 'vitest';
import type { CategoryId } from '@nexus/types';
import { 
  getMCCMapping, 
  hasMCCMapping, 
  getMCCsForCategory, 
  isMCCCompatibleWithCategory,
  MCC_MAPPINGS
} from '../../rules/mcc.js';

describe('getMCCMapping', () => {
  test('returns correct mapping for known salon MCC', () => {
    const mapping = getMCCMapping('7230');
    expect(mapping).toEqual({
      categoryId: '550e8400-e29b-41d4-a716-446655440002',
      categoryName: 'Hair Services',
      strength: 'exact',
      baseConfidence: 0.95
    });
  });

  test('returns correct mapping for utilities MCC', () => {
    const mapping = getMCCMapping('4900');
    expect(mapping).toEqual({
      categoryId: '550e8400-e29b-41d4-a716-446655440011',
      categoryName: 'Rent & Utilities',
      strength: 'exact',
      baseConfidence: 0.90
    });
  });

  test('returns undefined for unknown MCC', () => {
    const mapping = getMCCMapping('9999');
    expect(mapping).toBeUndefined();
  });

  test('returns undefined for empty MCC', () => {
    const mapping = getMCCMapping('');
    expect(mapping).toBeUndefined();
  });
});

describe('hasMCCMapping', () => {
  test('returns true for known MCC', () => {
    expect(hasMCCMapping('7230')).toBe(true);
    expect(hasMCCMapping('4900')).toBe(true);
    expect(hasMCCMapping('5912')).toBe(true);
  });

  test('returns false for unknown MCC', () => {
    expect(hasMCCMapping('9999')).toBe(false);
    expect(hasMCCMapping('')).toBe(false);
    expect(hasMCCMapping('invalid')).toBe(false);
  });
});

describe('getMCCsForCategory', () => {
  test('returns all MCCs for Hair Services category', () => {
    const categoryId = '550e8400-e29b-41d4-a716-446655440002' as CategoryId;
    const mccs = getMCCsForCategory(categoryId);
    expect(mccs).toContain('7230');
    expect(mccs.length).toBeGreaterThan(0);
  });

  test('returns all MCCs for Software & Technology category', () => {
    const categoryId = '550e8400-e29b-41d4-a716-446655440020' as CategoryId;
    const mccs = getMCCsForCategory(categoryId);
    expect(mccs).toContain('4814');
    expect(mccs).toContain('4815');
    expect(mccs).toContain('7372');
  });

  test('returns empty array for unknown category', () => {
    const categoryId = 'unknown-category-id' as CategoryId;
    const mccs = getMCCsForCategory(categoryId);
    expect(mccs).toEqual([]);
  });
});

describe('isMCCCompatibleWithCategory', () => {
  test('returns true when MCC matches exact category', () => {
    const hairServicesCategoryId = '550e8400-e29b-41d4-a716-446655440002' as CategoryId;
    expect(isMCCCompatibleWithCategory('7230', hairServicesCategoryId)).toBe(true);
  });

  test('returns true for compatible category families', () => {
    // Business operations family compatibility
    const utilitiesCategoryId = '550e8400-e29b-41d4-a716-446655440011' as CategoryId;
    const softwareCategoryId = '550e8400-e29b-41d4-a716-446655440020' as CategoryId;
    
    // These should be compatible within business operations family
    expect(isMCCCompatibleWithCategory('4900', softwareCategoryId)).toBe(true);
  });

  test('returns false for incompatible categories', () => {
    const hairServicesCategoryId = '550e8400-e29b-41d4-a716-446655440002' as CategoryId;
    // Utilities MCC should not be compatible with hair services
    expect(isMCCCompatibleWithCategory('4900', hairServicesCategoryId)).toBe(false);
  });

  test('returns true for unknown MCC (no constraint)', () => {
    const anyCategoryId = '550e8400-e29b-41d4-a716-446655440002' as CategoryId;
    expect(isMCCCompatibleWithCategory('9999', anyCategoryId)).toBe(true);
  });
});

describe('MCC_MAPPINGS structure', () => {
  test('all mappings have required fields', () => {
    for (const [mcc, mapping] of Object.entries(MCC_MAPPINGS)) {
      expect(mcc).toMatch(/^\d{4}$/); // 4-digit MCC code
      expect(mapping.categoryId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(mapping.categoryName).toBeTruthy();
      expect(mapping.strength).toMatch(/^(exact|family|unknown)$/);
      expect(mapping.baseConfidence).toBeGreaterThan(0);
      expect(mapping.baseConfidence).toBeLessThanOrEqual(1);
    }
  });

  test('confidence values are realistic', () => {
    for (const [, mapping] of Object.entries(MCC_MAPPINGS)) {
      if (mapping.strength === 'exact') {
        expect(mapping.baseConfidence).toBeGreaterThanOrEqual(0.85);
      } else if (mapping.strength === 'family') {
        expect(mapping.baseConfidence).toBeGreaterThanOrEqual(0.70);
        expect(mapping.baseConfidence).toBeLessThan(0.90);
      }
    }
  });

  test('has expected salon business MCCs', () => {
    expect(MCC_MAPPINGS['7230']).toBeDefined(); // Hair services
    expect(MCC_MAPPINGS['7298']).toBeDefined(); // Skin care
    expect(MCC_MAPPINGS['5912']).toBeDefined(); // Supplies
    expect(MCC_MAPPINGS['4900']).toBeDefined(); // Utilities
  });

  test('categories are consistently named', () => {
    const categoryNames = Object.values(MCC_MAPPINGS).map(m => m.categoryName);
    const uniqueNames = new Set(categoryNames);
    
    // Should have reasonable number of unique category names
    expect(uniqueNames.size).toBeGreaterThan(5);
    expect(uniqueNames.size).toBeLessThan(30);
    
    // Check for common naming patterns
    expect(categoryNames.some(name => name.includes('Services'))).toBe(true);
    expect(categoryNames.some(name => name.includes('Supplies'))).toBe(true);
  });
});