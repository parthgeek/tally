import { describe, expect, test } from 'vitest';
import type { CategoryId } from '@nexus/types';
import {
  matchKeywordRules,
  calculateKeywordConfidence,
  getBestKeywordMatch,
  getKeywordRulesForDomain,
  getAvailableDomains,
  KEYWORD_RULES,
  KEYWORD_PENALTIES
} from '../../rules/keywords.js';

describe('matchKeywordRules', () => {
  test('matches hair product keywords', () => {
    const matches = matchKeywordRules('Professional shampoo and conditioner for salon use');
    
    expect(matches.length).toBeGreaterThan(0);
    const hairMatch = matches.find(m => m.rule.categoryName === 'Supplies & Inventory');
    expect(hairMatch).toBeDefined();
    expect(hairMatch!.matchedKeywords).toContain('shampoo');
    expect(hairMatch!.matchedKeywords).toContain('conditioner');
  });

  test('matches software keywords', () => {
    const matches = matchKeywordRules('Monthly software subscription payment');
    
    expect(matches.length).toBeGreaterThan(0);
    const softwareMatch = matches.find(m => m.rule.categoryName === 'Software & Technology');
    expect(softwareMatch).toBeDefined();
    expect(softwareMatch!.matchedKeywords).toContain('software');
    expect(softwareMatch!.matchedKeywords).toContain('subscription');
  });

  test('matches utility keywords', () => {
    const matches = matchKeywordRules('Monthly electric bill payment');
    
    expect(matches.length).toBeGreaterThan(0);
    const utilityMatch = matches.find(m => m.rule.categoryName === 'Rent & Utilities');
    expect(utilityMatch).toBeDefined();
    expect(utilityMatch!.matchedKeywords).toContain('electric');
  });

  test('respects exclude keywords', () => {
    const matches = matchKeywordRules('Car rental for business trip');
    
    // Should not match rent → utilities because "car" is excluded
    const utilityMatch = matches.find(m => m.rule.categoryName === 'Rent & Utilities');
    expect(utilityMatch).toBeUndefined();
  });

  test('identifies penalty keywords', () => {
    const matches = matchKeywordRules('software.com bill payment transaction');
    
    expect(matches.length).toBeGreaterThan(0);
    const match = matches[0]!;
    expect(match.penalizedKeywords.length).toBeGreaterThan(0);
    expect(match.penalizedKeywords).toContain('com');
    expect(match.penalizedKeywords).toContain('bill');
  });

  test('handles case insensitive matching', () => {
    const matches = matchKeywordRules('SHAMPOO AND CONDITIONER PURCHASE');
    
    expect(matches.length).toBeGreaterThan(0);
    const match = matches.find(m => m.rule.domain === 'hair_products');
    expect(match).toBeDefined();
    expect(match!.matchedKeywords).toContain('shampoo');
    expect(match!.matchedKeywords).toContain('conditioner');
  });

  test('returns empty array for no matches', () => {
    const matches = matchKeywordRules('random text with no meaningful keywords');
    expect(matches).toEqual([]);
  });
});

describe('calculateKeywordConfidence', () => {
  test('calculates confidence for single match', () => {
    const matches = matchKeywordRules('Professional hair shampoo');
    const confidence = calculateKeywordConfidence(matches);
    
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(0.95);
  });

  test('gives bonus for multiple keywords', () => {
    const singleMatch = matchKeywordRules('shampoo');
    const multipleMatch = matchKeywordRules('shampoo conditioner hair color');
    
    const singleConfidence = calculateKeywordConfidence(singleMatch);
    const multipleConfidence = calculateKeywordConfidence(multipleMatch);
    
    expect(multipleConfidence).toBeGreaterThan(singleConfidence);
  });

  test('applies penalties correctly', () => {
    const cleanMatch = matchKeywordRules('professional shampoo');
    const penalizedMatch = matchKeywordRules('shampoo.com bill payment');
    
    const cleanConfidence = calculateKeywordConfidence(cleanMatch);
    const penalizedConfidence = calculateKeywordConfidence(penalizedMatch);
    
    expect(penalizedConfidence).toBeLessThan(cleanConfidence);
  });

  test('returns 0 for empty matches', () => {
    const confidence = calculateKeywordConfidence([]);
    expect(confidence).toBe(0);
  });

  test('caps confidence at 95%', () => {
    const matches = matchKeywordRules('insurance liability coverage premium deductible');
    const confidence = calculateKeywordConfidence(matches);
    
    expect(confidence).toBeLessThanOrEqual(0.95);
  });
});

describe('getBestKeywordMatch', () => {
  test('returns best match for clear category', () => {
    const result = getBestKeywordMatch('Professional hair shampoo and conditioner');
    
    expect(result).toBeDefined();
    expect(result!.categoryId).toBe('550e8400-e29b-41d4-a716-446655440012'); // Supplies & Inventory
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.rationale.length).toBeGreaterThan(0);
  });

  test('includes rationale with matched keywords', () => {
    const result = getBestKeywordMatch('Software subscription payment');
    
    expect(result).toBeDefined();
    expect(result!.rationale[0]).toContain('subscription');
    expect(result!.rationale[0]).toContain('software');
  });

  test('includes penalty information in rationale', () => {
    const result = getBestKeywordMatch('software.com bill transaction');
    
    expect(result).toBeDefined();
    expect(result!.rationale.some(r => r.includes('penalties'))).toBe(true);
  });

  test('returns undefined for no matches', () => {
    const result = getBestKeywordMatch('random unrelated text');
    expect(result).toBeUndefined();
  });

  test('selects highest weighted match', () => {
    // Insurance keywords typically have higher weights than general ones
    const result = getBestKeywordMatch('insurance coverage and office supplies');
    
    expect(result).toBeDefined();
    expect(result!.categoryId).toBe('550e8400-e29b-41d4-a716-446655440017'); // Insurance
  });
});

describe('getKeywordRulesForDomain', () => {
  test('returns rules for hair_products domain', () => {
    const rules = getKeywordRulesForDomain('hair_products');
    
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every(r => r.domain === 'hair_products')).toBe(true);
    expect(rules.some(r => r.keywords.includes('shampoo'))).toBe(true);
  });

  test('returns rules for technology domain', () => {
    const rules = getKeywordRulesForDomain('technology');
    
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every(r => r.domain === 'technology')).toBe(true);
    expect(rules.some(r => r.keywords.includes('software'))).toBe(true);
  });

  test('returns empty array for unknown domain', () => {
    const rules = getKeywordRulesForDomain('unknown_domain');
    expect(rules).toEqual([]);
  });
});

describe('getAvailableDomains', () => {
  test('returns all unique domains', () => {
    const domains = getAvailableDomains();
    
    expect(domains.length).toBeGreaterThan(0);
    expect(new Set(domains).size).toBe(domains.length); // All unique
    expect(domains).toContain('hair_products');
    expect(domains).toContain('technology');
    expect(domains).toContain('utilities');
  });

  test('domains match those in KEYWORD_RULES', () => {
    const domains = getAvailableDomains();
    const ruleDomains = new Set(KEYWORD_RULES.map(r => r.domain));
    
    expect(new Set(domains)).toEqual(ruleDomains);
  });
});

describe('KEYWORD_RULES structure', () => {
  test('all rules have required fields', () => {
    for (const rule of KEYWORD_RULES) {
      expect(rule.keywords.length).toBeGreaterThan(0);
      expect(rule.categoryId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(rule.categoryName).toBeTruthy();
      expect(rule.confidence).toBeGreaterThan(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
      expect(rule.weight).toBeGreaterThan(0);
      expect(rule.domain).toBeTruthy();
    }
  });

  test('keywords are lowercase and meaningful', () => {
    for (const rule of KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        expect(keyword).toBe(keyword.toLowerCase());
        expect(keyword.length).toBeGreaterThan(1); // No single character keywords
        expect(keyword.trim()).toBe(keyword); // No leading/trailing spaces
      }
    }
  });

  test('confidence correlates with weight', () => {
    for (const rule of KEYWORD_RULES) {
      if (rule.weight >= 5) {
        expect(rule.confidence).toBeGreaterThanOrEqual(0.85);
      }
      if (rule.weight <= 2) {
        expect(rule.confidence).toBeLessThanOrEqual(0.80);
      }
    }
  });

  test('domains are logically grouped', () => {
    const domains = getAvailableDomains();
    
    // Should have salon-specific domains
    expect(domains).toContain('hair_products');
    expect(domains).toContain('nail_products');
    expect(domains).toContain('salon_equipment');
    
    // Should have business operation domains
    expect(domains).toContain('utilities');
    expect(domains).toContain('technology');
    expect(domains).toContain('insurance');
  });

  test('exclude keywords prevent false positives', () => {
    const rulesWithExcludes = KEYWORD_RULES.filter(r => r.excludeKeywords);
    
    expect(rulesWithExcludes.length).toBeGreaterThan(0);
    
    for (const rule of rulesWithExcludes) {
      expect(rule.excludeKeywords!.length).toBeGreaterThan(0);
      // Exclude keywords should be reasonable
      for (const exclude of rule.excludeKeywords!) {
        expect(exclude.length).toBeGreaterThan(1);
        expect(exclude).toBe(exclude.toLowerCase());
      }
    }
  });
});

describe('KEYWORD_PENALTIES structure', () => {
  test('all penalties have required fields', () => {
    for (const penalty of KEYWORD_PENALTIES) {
      expect(penalty.keyword).toBeTruthy();
      expect(penalty.penalty).toBeGreaterThan(0);
      expect(penalty.penalty).toBeLessThanOrEqual(1);
      expect(penalty.reason).toBeTruthy();
    }
  });

  test('penalty amounts are reasonable', () => {
    for (const penalty of KEYWORD_PENALTIES) {
      expect(penalty.penalty).toBeLessThanOrEqual(0.2); // No penalty should be too harsh
      expect(penalty.penalty).toBeGreaterThanOrEqual(0.01); // But should be meaningful
    }
  });

  test('includes expected generic terms', () => {
    const penaltyKeywords = KEYWORD_PENALTIES.map(p => p.keyword);
    
    expect(penaltyKeywords).toContain('com');
    expect(penaltyKeywords).toContain('bill');
    expect(penaltyKeywords).toContain('payment');
    expect(penaltyKeywords).toContain('transaction');
  });

  test('penalties have meaningful reasons', () => {
    for (const penalty of KEYWORD_PENALTIES) {
      expect(penalty.reason.length).toBeGreaterThan(10);
      expect(penalty.reason).toContain(penalty.keyword.toLowerCase());
    }
  });
});