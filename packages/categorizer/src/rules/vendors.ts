import type { CategoryId } from '@nexus/types';

/**
 * Vendor pattern matching strength levels
 */
export type VendorMatchStrength = 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex';

/**
 * Vendor pattern rule definition
 */
export interface VendorPattern {
  pattern: string;
  matchType: VendorMatchStrength;
  categoryId: CategoryId;
  categoryName: string;
  confidence: number;
  priority: number; // Higher priority wins in conflicts
}

/**
 * Known merchant patterns with high-confidence categorization for e-commerce
 * Ordered by priority (higher priority patterns checked first)
 * 
 * IMPORTANT: Ambiguous vendors (Stripe, PayPal, Shopify, Square) removed
 * These are handled by compound rules in database (vendor + keywords)
 * to distinguish between fees, payouts, and subscriptions
 */
export const VENDOR_PATTERNS: VendorPattern[] = [
  // === Software & Technology (Unambiguous SaaS) ===
  {
    pattern: 'adobe',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.92,
    priority: 95
  },
  {
    pattern: 'microsoft',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.92,
    priority: 95
  },
  {
    pattern: 'canva',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.95,
    priority: 95
  },
  {
    pattern: 'squarespace',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.95,
    priority: 100
  },
  {
    pattern: 'wix',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.95,
    priority: 100
  },
  {
    pattern: 'zoom',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.92,
    priority: 90
  },
  {
    pattern: 'slack',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'asana',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.95,
    priority: 90
  },

  // === Marketing & Advertising Platforms (Unambiguous) ===
  {
    pattern: 'facebook ads',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.93,
    priority: 95
  },
  {
    pattern: 'meta for business',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.93,
    priority: 95
  },
  {
    pattern: 'google ads',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.93,
    priority: 95
  },
  {
    pattern: 'tiktok ads',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.93,
    priority: 95
  },
  {
    pattern: 'pinterest ads',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.92,
    priority: 90
  },

  // === Shipping Carriers (COGS - Shipping & Postage) ===
  {
    pattern: 'usps',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    confidence: 0.93,
    priority: 95
  },
  {
    pattern: 'fedex',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    confidence: 0.93,
    priority: 95
  },
  {
    pattern: 'ups',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    confidence: 0.93,
    priority: 95
  },
  {
    pattern: 'dhl',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    confidence: 0.92,
    priority: 95
  },

  // === 3PL & Fulfillment (Operations & Logistics) ===
  {
    pattern: 'shipbob',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440306' as CategoryId,
    categoryName: 'Operations & Logistics',
    confidence: 0.95,
    priority: 95
  },
  {
    pattern: 'shipmonk',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440306' as CategoryId,
    categoryName: 'Operations & Logistics',
    confidence: 0.95,
    priority: 95
  },
  {
    pattern: 'deliverr',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440306' as CategoryId,
    categoryName: 'Operations & Logistics',
    confidence: 0.95,
    priority: 95
  },

  // === Email/SMS Marketing Tools ===
  {
    pattern: 'klaviyo',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'mailchimp',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'attentive',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.92,
    priority: 90
  },
  {
    pattern: 'postscript',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.92,
    priority: 90
  },

  // === General & Administrative ===
  {
    pattern: 'quickbooks',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'gusto',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440305' as CategoryId,
    categoryName: 'Labor',
    confidence: 0.95,
    priority: 95
  },
  {
    pattern: 'rippling',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440305' as CategoryId,
    categoryName: 'Labor',
    confidence: 0.95,
    priority: 95
  },
  {
    pattern: 'staples',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.85,
    priority: 75
  },
  {
    pattern: 'office depot',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.85,
    priority: 75
  },

  // === Insurance ===
  {
    pattern: 'state farm',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.93,
    priority: 90
  },
  {
    pattern: 'allstate',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.93,
    priority: 90
  },
  {
    pattern: 'geico',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.93,
    priority: 90
  },

  // === Miscellaneous (Travel, Meals) ===
  {
    pattern: 'starbucks',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.75,
    priority: 70
  },
  {
    pattern: 'dunkin',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.75,
    priority: 70
  },
  {
    pattern: 'shell',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.80,
    priority: 75
  },
  {
    pattern: 'chevron',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.80,
    priority: 75
  },
  {
    pattern: 'exxon',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.80,
    priority: 75
  }
];

/**
 * Minimum length threshold for vendor names after suffix removal
 * Below this length, we preserve suffixes to avoid ambiguous short names
 */
const MIN_VENDOR_NAME_LENGTH = 4;

/**
 * Corporate suffixes to remove during normalization
 */
const CORPORATE_SUFFIXES = ['llc', 'inc', 'corp', 'ltd', 'co', 'company'];

/**
 * Removes corporate suffixes from normalized vendor name
 * Preserves suffixes if removal would result in very short names
 */
function removeCorporateSuffixes(normalized: string): string {
  const suffixPattern = new RegExp(`\\b(${CORPORATE_SUFFIXES.join('|')})\\b`, 'g');
  const withoutSuffixes = normalized.replace(suffixPattern, '').replace(/\s+/g, ' ').trim();

  // Preserve suffix if removal would create ambiguous short names (e.g., "AT&T Corp" → "at t corp")
  if (withoutSuffixes.length <= MIN_VENDOR_NAME_LENGTH && normalized.length > withoutSuffixes.length) {
    return normalized;
  }

  return withoutSuffixes;
}

/**
 * Normalizes vendor name for consistent pattern matching
 * Converts to lowercase, removes punctuation, normalizes spacing, and handles corporate suffixes
 */
export function normalizeVendorName(vendor: string): string {
  const normalized = vendor
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return removeCorporateSuffixes(normalized);
}

/**
 * Matches a vendor name against known patterns
 * Returns the best matching pattern or undefined
 */
export function matchVendorPattern(vendorName: string): VendorPattern | undefined {
  const normalized = normalizeVendorName(vendorName);
  
  let bestMatch: VendorPattern | undefined;
  let bestPriority = -1;
  
  for (const pattern of VENDOR_PATTERNS) {
    const normalizedPattern = normalizeVendorName(pattern.pattern);
    let isMatch = false;
    
    switch (pattern.matchType) {
      case 'exact':
        isMatch = normalized === normalizedPattern;
        break;
      case 'contains':
        isMatch = normalized.includes(normalizedPattern);
        break;
      case 'prefix':
        isMatch = normalized.startsWith(normalizedPattern);
        break;
      case 'suffix':
        isMatch = normalized.endsWith(normalizedPattern);
        break;
      case 'regex':
        try {
          const regex = new RegExp(pattern.pattern, 'i');
          isMatch = regex.test(normalized);
        } catch {
          // Invalid regex - skip
          isMatch = false;
        }
        break;
    }
    
    if (isMatch && pattern.priority > bestPriority) {
      bestMatch = pattern;
      bestPriority = pattern.priority;
    }
  }
  
  return bestMatch;
}

/**
 * Gets all patterns for a specific category
 */
export function getPatternsForCategory(categoryId: CategoryId): VendorPattern[] {
  return VENDOR_PATTERNS.filter(pattern => pattern.categoryId === categoryId);
}

/**
 * Gets patterns that could conflict with each other (same vendor, different categories)
 */
export function getConflictingPatterns(): Array<{ vendor: string; patterns: VendorPattern[] }> {
  const vendorGroups = new Map<string, VendorPattern[]>();
  
  for (const pattern of VENDOR_PATTERNS) {
    const normalized = normalizeVendorName(pattern.pattern);
    if (!vendorGroups.has(normalized)) {
      vendorGroups.set(normalized, []);
    }
    vendorGroups.get(normalized)!.push(pattern);
  }
  
  return Array.from(vendorGroups.entries())
    .filter(([, patterns]) => patterns.length > 1)
    .map(([vendor, patterns]) => ({ vendor, patterns }));
}