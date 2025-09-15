import type { CategoryId } from '@nexus/types';

/**
 * Keyword matching configuration
 */
export interface KeywordRule {
  keywords: string[];
  categoryId: CategoryId;
  categoryName: string;
  confidence: number;
  weight: number;
  domain: string; // Helps scope the keywords to specific business domains
  excludeKeywords?: string[]; // Keywords that exclude this rule
}

/**
 * Keyword penalty for overly generic terms that should reduce confidence
 */
export interface KeywordPenalty {
  keyword: string;
  penalty: number; // Amount to subtract from confidence (0-1)
  reason: string;
}

/**
 * Carefully scoped keyword rules for transaction categorization
 * Ordered by specificity and confidence
 */
export const KEYWORD_RULES: KeywordRule[] = [
  // === Software & Technology ===
  {
    keywords: ['subscription', 'saas', 'software', 'license', 'api', 'cloud', 'hosting'],
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.80,
    weight: 3,
    domain: 'technology'
  },
  {
    keywords: ['domain', 'ssl', 'certificate', 'hosting', 'server'],
    categoryId: '550e8400-e29b-41d4-a716-446655440020' as CategoryId,
    categoryName: 'Software & Technology',
    confidence: 0.85,
    weight: 4,
    domain: 'web_services'
  },

  // === Rent & Utilities ===
  {
    keywords: ['rent', 'lease', 'rental'],
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.90,
    weight: 5,
    domain: 'property',
    excludeKeywords: ['car', 'vehicle', 'equipment']
  },
  {
    keywords: ['electric', 'electricity', 'power', 'energy'],
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.90,
    weight: 5,
    domain: 'utilities'
  },
  {
    keywords: ['gas', 'water', 'sewer', 'waste', 'garbage'],
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.85,
    weight: 4,
    domain: 'utilities',
    excludeKeywords: ['gasoline', 'fuel']
  },
  {
    keywords: ['internet', 'wifi', 'broadband', 'fiber'],
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.85,
    weight: 4,
    domain: 'telecommunications'
  },
  {
    keywords: ['phone', 'cellular', 'mobile', 'landline'],
    categoryId: '550e8400-e29b-41d4-a716-446655440011' as CategoryId,
    categoryName: 'Rent & Utilities',
    confidence: 0.80,
    weight: 3,
    domain: 'telecommunications'
  },

  // === Supplies & Inventory ===
  {
    keywords: ['shampoo', 'conditioner', 'hair color', 'bleach', 'toner', 'developer'],
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.95,
    weight: 6,
    domain: 'hair_products'
  },
  {
    keywords: ['nail polish', 'gel', 'acrylic', 'cuticle', 'nail art'],
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.95,
    weight: 6,
    domain: 'nail_products'
  },
  {
    keywords: ['facial', 'serum', 'moisturizer', 'cleanser', 'toner', 'mask'],
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.90,
    weight: 5,
    domain: 'skincare_products'
  },
  {
    keywords: ['towels', 'capes', 'foils', 'gloves', 'disposable'],
    categoryId: '550e8400-e29b-41d4-a716-446655440012' as CategoryId,
    categoryName: 'Supplies & Inventory',
    confidence: 0.85,
    weight: 4,
    domain: 'salon_supplies'
  },

  // === Equipment & Hardware ===
  {
    keywords: ['chair', 'dryer', 'shampoo bowl', 'station', 'mirror'],
    categoryId: '550e8400-e29b-41d4-a716-446655440013' as CategoryId,
    categoryName: 'Equipment & Hardware',
    confidence: 0.90,
    weight: 5,
    domain: 'salon_equipment'
  },
  {
    keywords: ['clippers', 'scissors', 'razor', 'trimmer', 'curling iron'],
    categoryId: '550e8400-e29b-41d4-a716-446655440013' as CategoryId,
    categoryName: 'Equipment & Hardware',
    confidence: 0.95,
    weight: 6,
    domain: 'tools'
  },

  // === Staff Wages & Benefits ===
  {
    keywords: ['payroll', 'wages', 'salary', 'benefits', 'health insurance'],
    categoryId: '550e8400-e29b-41d4-a716-446655440014' as CategoryId,
    categoryName: 'Staff Wages & Benefits',
    confidence: 0.95,
    weight: 6,
    domain: 'payroll'
  },
  {
    keywords: ['workers comp', 'unemployment', 'fica', 'withholding'],
    categoryId: '550e8400-e29b-41d4-a716-446655440014' as CategoryId,
    categoryName: 'Staff Wages & Benefits',
    confidence: 0.90,
    weight: 5,
    domain: 'employment_taxes'
  },

  // === Marketing & Advertising ===
  {
    keywords: ['advertising', 'marketing', 'promotion', 'flyers', 'brochure'],
    categoryId: '550e8400-e29b-41d4-a716-446655440015' as CategoryId,
    categoryName: 'Marketing & Advertising',
    confidence: 0.90,
    weight: 5,
    domain: 'marketing'
  },
  {
    keywords: ['social media', 'facebook ads', 'instagram', 'google ads'],
    categoryId: '550e8400-e29b-41d4-a716-446655440015' as CategoryId,
    categoryName: 'Marketing & Advertising',
    confidence: 0.95,
    weight: 6,
    domain: 'digital_marketing'
  },

  // === Professional Services ===
  {
    keywords: ['accountant', 'lawyer', 'attorney', 'consultant', 'advisor'],
    categoryId: '550e8400-e29b-41d4-a716-446655440016' as CategoryId,
    categoryName: 'Professional Services',
    confidence: 0.90,
    weight: 5,
    domain: 'professional_services'
  },
  {
    keywords: ['cleaning', 'janitorial', 'maintenance', 'repair'],
    categoryId: '550e8400-e29b-41d4-a716-446655440016' as CategoryId,
    categoryName: 'Professional Services',
    confidence: 0.80,
    weight: 3,
    domain: 'maintenance_services'
  },

  // === Insurance ===
  {
    keywords: ['insurance', 'liability', 'coverage', 'premium', 'deductible'],
    categoryId: '550e8400-e29b-41d4-a716-446655440017' as CategoryId,
    categoryName: 'Insurance',
    confidence: 0.95,
    weight: 6,
    domain: 'insurance'
  },

  // === Licenses & Permits ===
  {
    keywords: ['license', 'permit', 'registration', 'certification', 'renewal'],
    categoryId: '550e8400-e29b-41d4-a716-446655440018' as CategoryId,
    categoryName: 'Licenses & Permits',
    confidence: 0.90,
    weight: 5,
    domain: 'government'
  },

  // === Banking & Fees ===
  {
    keywords: ['fee', 'charge', 'overdraft', 'monthly maintenance', 'transaction fee'],
    categoryId: '550e8400-e29b-41d4-a716-446655440019' as CategoryId,
    categoryName: 'Banking & Fees',
    confidence: 0.85,
    weight: 4,
    domain: 'banking'
  },

  // === Vehicle & Travel ===
  {
    keywords: ['gasoline', 'fuel', 'gas station', 'diesel'],
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    confidence: 0.90,
    weight: 5,
    domain: 'fuel'
  },
  {
    keywords: ['parking', 'toll', 'mileage', 'car wash'],
    categoryId: '550e8400-e29b-41d4-a716-446655440009' as CategoryId,
    categoryName: 'Vehicle & Travel',
    confidence: 0.85,
    weight: 4,
    domain: 'automotive'
  },

  // === Business Meals ===
  {
    keywords: ['lunch', 'dinner', 'meeting', 'client meal', 'catering'],
    categoryId: '550e8400-e29b-41d4-a716-446655440007' as CategoryId,
    categoryName: 'Business Meals',
    confidence: 0.75,
    weight: 3,
    domain: 'meals',
    excludeKeywords: ['personal', 'family', 'home']
  },

  // === Office & Admin ===
  {
    keywords: ['paper', 'pens', 'folders', 'filing', 'office supplies'],
    categoryId: '550e8400-e29b-41d4-a716-446655440010' as CategoryId,
    categoryName: 'Office & Admin',
    confidence: 0.80,
    weight: 3,
    domain: 'office'
  }
];

/**
 * Keywords that should penalize confidence due to being overly generic
 */
export const KEYWORD_PENALTIES: KeywordPenalty[] = [
  {
    keyword: 'com',
    penalty: 0.10,
    reason: 'Generic domain suffix'
  },
  {
    keyword: 'inc',
    penalty: 0.05,
    reason: 'Generic business suffix'
  },
  {
    keyword: 'llc',
    penalty: 0.05,
    reason: 'Generic business suffix'
  },
  {
    keyword: 'bill',
    penalty: 0.15,
    reason: 'Overly generic billing term'
  },
  {
    keyword: 'payment',
    penalty: 0.10,
    reason: 'Generic payment term'
  },
  {
    keyword: 'purchase',
    penalty: 0.10,
    reason: 'Generic purchase term'
  },
  {
    keyword: 'transaction',
    penalty: 0.15,
    reason: 'Generic transaction term'
  }
];

/**
 * Matches keywords in a transaction description against categorization rules
 */
export function matchKeywordRules(description: string): Array<{ rule: KeywordRule; matchedKeywords: string[]; penalizedKeywords: string[] }> {
  const normalizedDesc = description.toLowerCase().trim();
  const matches: Array<{ rule: KeywordRule; matchedKeywords: string[]; penalizedKeywords: string[] }> = [];

  for (const rule of KEYWORD_RULES) {
    const matchedKeywords: string[] = [];
    const penalizedKeywords: string[] = [];
    
    // Check for keyword matches
    for (const keyword of rule.keywords) {
      if (normalizedDesc.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    
    // Check for exclude keywords (disqualifies the rule)
    if (rule.excludeKeywords) {
      const hasExcludeMatch = rule.excludeKeywords.some(excludeKeyword => 
        normalizedDesc.includes(excludeKeyword.toLowerCase())
      );
      if (hasExcludeMatch) {
        continue; // Skip this rule
      }
    }
    
    // Check for penalty keywords
    for (const penalty of KEYWORD_PENALTIES) {
      if (normalizedDesc.includes(penalty.keyword.toLowerCase())) {
        penalizedKeywords.push(penalty.keyword);
      }
    }
    
    if (matchedKeywords.length > 0) {
      matches.push({ rule, matchedKeywords, penalizedKeywords });
    }
  }

  return matches;
}

/**
 * Calculates confidence score for keyword matches
 */
export function calculateKeywordConfidence(matches: Array<{ rule: KeywordRule; matchedKeywords: string[]; penalizedKeywords: string[] }>): number {
  if (matches.length === 0) return 0;

  // Find the best matching rule (highest weight * keyword count)
  let bestScore = 0;
  let bestConfidence = 0;

  for (const match of matches) {
    const keywordBonus = Math.min(0.2, match.matchedKeywords.length * 0.05); // Max 20% bonus for multiple keywords
    const penaltyDeduction = match.penalizedKeywords.reduce((sum, keyword) => {
      const penalty = KEYWORD_PENALTIES.find(p => p.keyword === keyword);
      return sum + (penalty?.penalty || 0);
    }, 0);
    
    const score = match.rule.weight * match.matchedKeywords.length;
    const adjustedConfidence = Math.max(0, match.rule.confidence + keywordBonus - penaltyDeduction);
    
    if (score > bestScore) {
      bestScore = score;
      bestConfidence = adjustedConfidence;
    }
  }

  return Math.min(0.95, bestConfidence); // Cap at 95%
}

/**
 * Gets the best category match from keyword analysis
 */
export function getBestKeywordMatch(description: string): { categoryId: CategoryId; confidence: number; rationale: string[] } | undefined {
  const matches = matchKeywordRules(description);
  if (matches.length === 0) return undefined;

  // Find highest-scoring match
  let bestMatch = matches[0]!; // We know matches.length > 0 from the check above
  let bestScore = bestMatch.rule.weight * bestMatch.matchedKeywords.length;

  for (let i = 1; i < matches.length; i++) {
    const score = matches[i]!.rule.weight * matches[i]!.matchedKeywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = matches[i]!;
    }
  }

  const confidence = calculateKeywordConfidence([bestMatch]);
  const rationale = [
    `keywords: [${bestMatch.matchedKeywords.join(', ')}] → ${bestMatch.rule.categoryName}`,
    ...(bestMatch.penalizedKeywords.length > 0 ? [`penalties: [${bestMatch.penalizedKeywords.join(', ')}]`] : [])
  ];

  return {
    categoryId: bestMatch.rule.categoryId,
    confidence,
    rationale
  };
}

/**
 * Gets keyword rules for a specific domain
 */
export function getKeywordRulesForDomain(domain: string): KeywordRule[] {
  return KEYWORD_RULES.filter(rule => rule.domain === domain);
}

/**
 * Gets all available domains
 */
export function getAvailableDomains(): string[] {
  return [...new Set(KEYWORD_RULES.map(rule => rule.domain))];
}