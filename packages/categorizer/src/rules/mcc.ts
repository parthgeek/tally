import type { CategoryId } from '@nexus/types';

/**
 * MCC (Merchant Category Code) strength levels for categorization confidence
 */
export type MCCStrength = 'exact' | 'family' | 'unknown';

/**
 * MCC mapping entry with categorization metadata
 */
export interface MCCMapping {
  categoryId: CategoryId;
  categoryName: string;
  strength: MCCStrength;
  baseConfidence: number;
}

/**
 * Comprehensive MCC to category mapping table
 * Based on Visa/Mastercard merchant category codes with salon business focus
 */
export const MCC_MAPPINGS: Record<string, MCCMapping> = {
  // === Hair & Beauty Services (Exact matches) ===
  '7230': {
    categoryId: '550e8400-e29b-41d4-a716-446655440002' as CategoryId,
    categoryName: 'Hair Services',
    strength: 'exact',
    baseConfidence: 0.95
  },
  '7298': {
    categoryId: '550e8400-e29b-41d4-a716-446655440004' as CategoryId,
    categoryName: 'Skin Care Services', 
    strength: 'exact',
    baseConfidence: 0.95
  },
  '7297': {
    categoryId: '550e8400-e29b-41d4-a716-446655440003' as CategoryId,
    categoryName: 'Nail Services',
    strength: 'exact', 
    baseConfidence: 0.95
  },

  // === Retail & Supplies (Family matches) ===
  '5912': {
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    strength: 'family',
    baseConfidence: 0.85
  },
  '5977': {
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    strength: 'family',
    baseConfidence: 0.80
  },
  '5310': {
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    strength: 'family',
    baseConfidence: 0.75
  },

  // === Utilities & Rent (Exact matches) ===
  '4900': {
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '4814': {
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '4815': {
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    strength: 'exact',
    baseConfidence: 0.90
  },

  // === Food & Dining ===
  '5812': {
    categoryId: '550e8400-e29b-41d4-a716-446655440007' as CategoryId,
    categoryName: 'Business Meals',
    strength: 'family',
    baseConfidence: 0.70
  },
  '5814': {
    categoryId: '550e8400-e29b-41d4-a716-446655440007' as CategoryId,
    categoryName: 'Business Meals', 
    strength: 'family',
    baseConfidence: 0.75
  },

  // === Gas Stations & Fuel ===
  '5541': {
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '5542': {
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    strength: 'exact', 
    baseConfidence: 0.90
  },

  // === Professional Services ===
  '8931': {
    categoryId: '550e8400-e29b-41d4-a716-446655440016' as CategoryId,
    categoryName: 'Professional Services',
    strength: 'family',
    baseConfidence: 0.75
  },
  '7311': {
    categoryId: '550e8400-e29b-41d4-a716-446655440015' as CategoryId,
    categoryName: 'Marketing & Advertising',
    strength: 'exact',
    baseConfidence: 0.85
  },
  '8999': {
    categoryId: '550e8400-e29b-41d4-a716-446655440016' as CategoryId,
    categoryName: 'Professional Services',
    strength: 'family',
    baseConfidence: 0.70
  },

  // === Insurance ===
  '6300': {
    categoryId: '550e8400-e29b-41d4-a716-446655440017' as CategoryId,
    categoryName: 'Insurance',
    strength: 'exact',
    baseConfidence: 0.90
  },

  // === Government & Licenses ===
  '9399': {
    categoryId: '550e8400-e29b-41d4-a716-446655440018' as CategoryId,
    categoryName: 'Licenses & Permits',
    strength: 'exact',
    baseConfidence: 0.85
  },

  // === Equipment & Hardware ===
  '5200': {
    categoryId: '550e8400-e29b-41d4-a716-446655440013' as CategoryId,
    categoryName: 'Equipment & Hardware',
    strength: 'family',
    baseConfidence: 0.75
  },
  '5211': {
    categoryId: '550e8400-e29b-41d4-a716-446655440013' as CategoryId,
    categoryName: 'Equipment & Hardware',
    strength: 'family',
    baseConfidence: 0.80
  },

  // === Office Supplies ===
  '5943': {
    categoryId: '550e8400-e29b-41d4-a716-446655440010' as CategoryId,
    categoryName: 'Office & Admin',
    strength: 'family',
    baseConfidence: 0.75
  },

  // === Software & Technology ===
  '7372': {
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '7379': {
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    strength: 'exact',
    baseConfidence: 0.85
  },

  // === Transportation & Delivery ===
  '4111': {
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    strength: 'family',
    baseConfidence: 0.75
  },
  '4121': {
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    strength: 'family',
    baseConfidence: 0.75
  },

  // === Banking & Financial ===
  '6010': {
    categoryId: '550e8400-e29b-41d4-a716-446655440019' as CategoryId,
    categoryName: 'Banking & Fees',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '6011': {
    categoryId: '550e8400-e29b-41d4-a716-446655440019' as CategoryId,
    categoryName: 'Banking & Fees',
    strength: 'exact',
    baseConfidence: 0.90
  }
};

/**
 * Gets MCC mapping for a given merchant category code
 */
export function getMCCMapping(mcc: string): MCCMapping | undefined {
  return MCC_MAPPINGS[mcc];
}

/**
 * Checks if an MCC exists in our mapping table
 */
export function hasMCCMapping(mcc: string): boolean {
  return mcc in MCC_MAPPINGS;
}

/**
 * Gets all MCCs for a specific category
 */
export function getMCCsForCategory(categoryId: CategoryId): string[] {
  return Object.entries(MCC_MAPPINGS)
    .filter(([, mapping]) => mapping.categoryId === categoryId)
    .map(([mcc]) => mcc);
}

/**
 * Validates if an MCC is compatible with a given category
 * Used for guardrails to prevent obviously wrong categorizations
 */
export function isMCCCompatibleWithCategory(mcc: string, categoryId: CategoryId): boolean {
  const mapping = getMCCMapping(mcc);
  if (!mapping) {
    // Unknown MCC - allow any category (no constraint)
    return true;
  }
  
  // Known MCC - only allow same category or compatible family
  return mapping.categoryId === categoryId || isCompatibleCategoryFamily(mapping.categoryId, categoryId);
}

/**
 * Determines if two categories are in compatible families
 * Used for cross-category compatibility checking
 */
function isCompatibleCategoryFamily(mccCategoryId: CategoryId, targetCategoryId: CategoryId): boolean {
  // Define category families that can be compatible
  const categoryFamilies = [
    // Business operations family
    ['550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440020'],
    // Service delivery family  
    ['550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004'],
    // Supply & inventory family
    ['550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440013'],
    // Professional services family
    ['550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440016']
  ];

  return categoryFamilies.some(family => 
    family.includes(mccCategoryId) && family.includes(targetCategoryId)
  );
}