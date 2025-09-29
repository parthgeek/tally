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
 * Comprehensive MCC to category mapping table for e-commerce businesses
 * Based on Visa/Mastercard merchant category codes
 * Mapped to two-tier taxonomy umbrella buckets
 */
export const MCC_MAPPINGS: Record<string, MCCMapping> = {
  // === Payment Processing & Financial Services ===
  '6012': { // Financial Institutions - Manual Cash Disbursements
    categoryId: '550e8400-e29b-41d4-a716-446655440301' as CategoryId,
    categoryName: 'Payment Processing Fees',
    strength: 'exact',
    baseConfidence: 0.95
  },
  '6011': { // Automated Cash Disbursements (ATMs, Payouts)
    categoryId: '550e8400-e29b-41d4-a716-446655440503' as CategoryId,
    categoryName: 'Payouts Clearing',
    strength: 'exact',
    baseConfidence: 0.92
  },
  '6051': { // Non-Financial Institutions - Foreign Currency
    categoryId: '550e8400-e29b-41d4-a716-446655440301' as CategoryId,
    categoryName: 'Payment Processing Fees',
    strength: 'family',
    baseConfidence: 0.85
  },
  '6211': { // Security Brokers/Dealers (Payment platforms)
    categoryId: '550e8400-e29b-41d4-a716-446655440301' as CategoryId,
    categoryName: 'Payment Processing Fees',
    strength: 'family',
    baseConfidence: 0.88
  },
  '6300': { // Insurance
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'exact',
    baseConfidence: 0.90
  },

  // === Marketing & Advertising ===
  '7311': { // Advertising Services
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    strength: 'exact',
    baseConfidence: 0.95
  },
  '7321': { // Consumer Credit Reporting Agencies (Analytics/Data)
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    strength: 'family',
    baseConfidence: 0.80
  },
  '7338': { // Quick Copy and Printing (Marketing materials)
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    strength: 'family',
    baseConfidence: 0.75
  },
  '7333': { // Commercial Photography (Marketing assets)
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    strength: 'family',
    baseConfidence: 0.80
  },

  // === Software & Technology ===
  '5734': { // Computer Software Stores (SaaS, Software)
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    strength: 'exact',
    baseConfidence: 0.92
  },
  '5815': { // Digital Goods - Media, Books, Music
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '7372': { // Computer Programming, Data Processing
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    strength: 'exact',
    baseConfidence: 0.92
  },
  '7379': { // Computer Maintenance, Repair (Software support)
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    strength: 'family',
    baseConfidence: 0.85
  },
  '4816': { // Computer Network/Information Services
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '4814': { // Telecommunication Services (Phone/Internet)
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'family',
    baseConfidence: 0.82
  },

  // === Logistics & Transportation ===
  '4215': { // Courier Services (UPS, FedEx, DHL)
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    strength: 'exact',
    baseConfidence: 0.93
  },
  '4789': { // Transportation Services (Freight, Shipping)
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    strength: 'family',
    baseConfidence: 0.88
  },
  '4214': { // Motor Freight Carriers (Freight forwarding)
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    strength: 'family',
    baseConfidence: 0.85
  },
  '4225': { // Public Warehousing - Storage
    categoryId: '550e8400-e29b-41d4-a716-446655440306' as CategoryId,
    categoryName: 'Operations & Logistics',
    strength: 'exact',
    baseConfidence: 0.90
  },

  // === Wholesale & Suppliers ===
  '5013': { // Motor Vehicle Supplies and New Parts
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    strength: 'family',
    baseConfidence: 0.75
  },
  '5044': { // Office/Photographic Equipment (Wholesale)
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    strength: 'family',
    baseConfidence: 0.80
  },
  '5111': { // Stationery/Office Supplies (Wholesale)
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    strength: 'family',
    baseConfidence: 0.82
  },
  '5137': { // Men's/Women's Clothing (Wholesale)
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    strength: 'family',
    baseConfidence: 0.85
  },
  '5139': { // Commercial Footwear (Wholesale)
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    strength: 'family',
    baseConfidence: 0.85
  },

  // === Business Services ===
  '7399': { // Business Services (General)
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'family',
    baseConfidence: 0.70
  },
  '8931': { // Accounting/Bookkeeping Services
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'exact',
    baseConfidence: 0.88
  },
  '8111': { // Legal Services
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'exact',
    baseConfidence: 0.90
  },
  '8999': { // Professional Services (Consultants)
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'family',
    baseConfidence: 0.75
  },

  // === Labor & Payroll ===
  '7361': { // Employment Agencies, Temporary Help
    categoryId: '550e8400-e29b-41d4-a716-446655440305' as CategoryId,
    categoryName: 'Labor',
    strength: 'exact',
    baseConfidence: 0.92
  },

  // === Office & Administrative ===
  '5943': { // Office Supply Stores
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'family',
    baseConfidence: 0.80
  },
  '5021': { // Office and Commercial Furniture
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'family',
    baseConfidence: 0.75
  },

  // === Utilities & Facilities ===
  '4900': { // Utilities (Electric, Gas, Water, Sanitary)
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'exact',
    baseConfidence: 0.92
  },
  '4899': { // Cable and Other Pay TV (Internet/Utilities)
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'family',
    baseConfidence: 0.85
  },

  // === Packaging & Supplies ===
  '5198': { // Paints, Varnishes, and Supplies
    categoryId: '550e8400-e29b-41d4-a716-446655440206' as CategoryId,
    categoryName: 'Packaging',
    strength: 'family',
    baseConfidence: 0.70
  },

  // === Government & Compliance ===
  '9399': { // Government Services
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    strength: 'exact',
    baseConfidence: 0.88
  },
  '9311': { // Tax Payments
    categoryId: '550e8400-e29b-41d4-a716-446655440601' as CategoryId,
    categoryName: 'Taxes & Liabilities',
    strength: 'exact',
    baseConfidence: 0.95
  },

  // === Miscellaneous (Travel, Meals, etc.) ===
  '3000-3999': { // Airlines (Travel)
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    strength: 'family',
    baseConfidence: 0.75
  },
  '5812': { // Eating Places, Restaurants
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    strength: 'family',
    baseConfidence: 0.70
  },
  '5814': { // Fast Food Restaurants
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    strength: 'family',
    baseConfidence: 0.70
  },
  '5541': { // Service Stations (Fuel)
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    strength: 'family',
    baseConfidence: 0.72
  },
  '5542': { // Automated Fuel Dispensers
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    strength: 'family',
    baseConfidence: 0.72
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
 * Used for cross-category compatibility checking within two-tier taxonomy
 */
function isCompatibleCategoryFamily(mccCategoryId: CategoryId, targetCategoryId: CategoryId): boolean {
  // Define category families that can be compatible (two-tier taxonomy)
  const categoryFamilies = [
    // OpEx - G&A family (software, admin, professional services can overlap)
    ['550e8400-e29b-41d4-a716-446655440304', '550e8400-e29b-41d4-a716-446655440307'], // software_subscriptions, general_administrative
    
    // OpEx - Marketing & Ads family
    ['550e8400-e29b-41d4-a716-446655440303', '550e8400-e29b-41d4-a716-446655440304'], // marketing_ads, software_subscriptions (ad platforms as SaaS)
    
    // COGS - Shipping & Logistics family
    ['550e8400-e29b-41d4-a716-446655440207', '550e8400-e29b-41d4-a716-446655440306'], // shipping_postage, operations_logistics
    
    // COGS - Supplier & Packaging family
    ['550e8400-e29b-41d4-a716-446655440205', '550e8400-e29b-41d4-a716-446655440206'], // supplier_purchases, packaging
    
    // Payment Processing & Payouts family
    ['550e8400-e29b-41d4-a716-446655440301', '550e8400-e29b-41d4-a716-446655440503'], // payment_processing_fees, payouts_clearing
  ];

  return categoryFamilies.some(family => 
    family.includes(mccCategoryId) && family.includes(targetCategoryId)
  );
}