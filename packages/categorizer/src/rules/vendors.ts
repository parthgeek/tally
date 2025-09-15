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
 * Known merchant patterns with high-confidence categorization
 * Ordered by priority (higher priority patterns checked first)
 */
export const VENDOR_PATTERNS: VendorPattern[] = [
  // === High-priority exact matches ===
  {
    pattern: 'square inc',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440019' as CategoryId,
    categoryName: 'Banking & Fees',
    confidence: 0.95,
    priority: 100
  },
  {
    pattern: 'paypal',
    matchType: 'exact', 
    categoryId: '550e8400-e29b-41d4-a716-446655440019' as CategoryId,
    categoryName: 'Banking & Fees',
    confidence: 0.95,
    priority: 100
  },
  {
    pattern: 'stripe',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440019' as CategoryId,
    categoryName: 'Banking & Fees',
    confidence: 0.95,
    priority: 100
  },

  // === Software & Technology (High priority) ===
  {
    pattern: 'adobe',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.92,
    priority: 95
  },
  {
    pattern: 'microsoft',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.92,
    priority: 95
  },
  {
    pattern: 'google',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.90,
    priority: 95
  },
  {
    pattern: 'canva',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95
  },
  {
    pattern: 'squarespace',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95
  },
  {
    pattern: 'shopify',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95
  },

  // === Beauty Supply Vendors ===
  {
    pattern: 'sally beauty',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'cosmoprof',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'olaplex',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'redken',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'loreal',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.90,
    priority: 90
  },

  // === Utilities & Telecommunications ===
  {
    pattern: 'verizon',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.92,
    priority: 85
  },
  {
    pattern: 'att',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.90,
    priority: 85
  },
  {
    pattern: 't-mobile',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.90,
    priority: 85
  },
  {
    pattern: 'comcast',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.92,
    priority: 85
  },

  // === Fuel & Automotive ===
  {
    pattern: 'shell',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    confidence: 0.90,
    priority: 80
  },
  {
    pattern: 'chevron',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    confidence: 0.90,
    priority: 80
  },
  {
    pattern: 'exxon',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    confidence: 0.90,
    priority: 80
  },
  {
    pattern: 'mobil',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    confidence: 0.90,
    priority: 80
  },
  {
    pattern: 'bp',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    confidence: 0.85,
    priority: 80
  },

  // === Office & Retail Supplies ===
  {
    pattern: 'staples',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440010' as CategoryId,
    categoryName: 'Office & Admin',
    confidence: 0.85,
    priority: 75
  },
  {
    pattern: 'office depot',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440010' as CategoryId,
    categoryName: 'Office & Admin',
    confidence: 0.85,
    priority: 75
  },
  {
    pattern: 'costco',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.70,
    priority: 70
  },
  {
    pattern: 'amazon',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.60, // Lower confidence due to ambiguity
    priority: 50
  },

  // === Food & Business Meals ===
  {
    pattern: 'starbucks',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440007' as CategoryId,
    categoryName: 'Business Meals',
    confidence: 0.75,
    priority: 70
  },
  {
    pattern: 'dunkin',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440007' as CategoryId,
    categoryName: 'Business Meals',
    confidence: 0.75,
    priority: 70
  },

  // === Marketing & Advertising ===
  {
    pattern: 'facebook',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440015' as CategoryId,
    categoryName: 'Marketing & Advertising',
    confidence: 0.90,
    priority: 85
  },
  {
    pattern: 'meta',
    matchType: 'exact',
    categoryId: '550e8400-e29b-41d4-a716-446655440015' as CategoryId,
    categoryName: 'Marketing & Advertising',
    confidence: 0.90,
    priority: 85
  },
  {
    pattern: 'instagram',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440015' as CategoryId,
    categoryName: 'Marketing & Advertising',
    confidence: 0.90,
    priority: 85
  },

  // === Insurance ===
  {
    pattern: 'state farm',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440017' as CategoryId,
    categoryName: 'Insurance',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'allstate',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440017' as CategoryId,
    categoryName: 'Insurance',
    confidence: 0.95,
    priority: 90
  },
  {
    pattern: 'geico',
    matchType: 'contains',
    categoryId: '550e8400-e29b-41d4-a716-446655440017' as CategoryId,
    categoryName: 'Insurance',
    confidence: 0.95,
    priority: 90
  }
];

/**
 * Normalizes vendor name for consistent pattern matching
 */
export function normalizeVendorName(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    .replace(/\b(llc|inc|corp|ltd|co|company)\b\.?/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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