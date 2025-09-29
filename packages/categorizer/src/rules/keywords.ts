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
 * E-commerce-specific keyword rules for transaction categorization
 * Mapped to two-tier taxonomy umbrella buckets
 * Ordered by specificity and confidence
 */
export const KEYWORD_RULES: KeywordRule[] = [
  // === Payment Processing Fees ===
  {
    keywords: ['processing fee', 'transaction fee', 'payment fee', 'merchant fee', 'card fee'],
    categoryId: '550e8400-e29b-41d4-a716-446655440301' as CategoryId,
    categoryName: 'Payment Processing Fees',
    confidence: 0.90,
    weight: 5,
    domain: 'payment_processing',
    excludeKeywords: ['payout', 'deposit', 'transfer']
  },
  {
    keywords: ['chargeback', 'dispute fee', 'declined transaction'],
    categoryId: '550e8400-e29b-41d4-a716-446655440301' as CategoryId,
    categoryName: 'Payment Processing Fees',
    confidence: 0.92,
    weight: 5,
    domain: 'payment_disputes'
  },

  // === Payouts & Clearing ===
  {
    keywords: ['payout', 'transfer', 'deposit', 'settlement', 'disbursement'],
    categoryId: '550e8400-e29b-41d4-a716-446655440503' as CategoryId,
    categoryName: 'Payouts Clearing',
    confidence: 0.88,
    weight: 5,
    domain: 'payouts',
    excludeKeywords: ['fee', 'charge']
  },

  // === Refunds (Contra-Revenue) ===
  {
    keywords: ['refund', 'return', 'chargeback', 'reversal', 'void'],
    categoryId: '550e8400-e29b-41d4-a716-446655440105' as CategoryId,
    categoryName: 'Refunds (Contra-Revenue)',
    confidence: 0.92,
    weight: 6,
    domain: 'refunds'
  },
  {
    keywords: ['customer return', 'order cancellation', 'cancelled order'],
    categoryId: '550e8400-e29b-41d4-a716-446655440105' as CategoryId,
    categoryName: 'Refunds (Contra-Revenue)',
    confidence: 0.88,
    weight: 5,
    domain: 'order_cancellations'
  },

  // === Supplier Purchases (COGS) ===
  {
    keywords: ['wholesale', 'supplier invoice', 'purchase order', 'po#', 'net 30', 'net 60'],
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    confidence: 0.90,
    weight: 6,
    domain: 'inventory_purchasing',
    excludeKeywords: ['refund', 'credit']
  },
  {
    keywords: ['inventory purchase', 'product cost', 'goods purchased', 'merchandise'],
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    confidence: 0.85,
    weight: 5,
    domain: 'inventory'
  },
  {
    keywords: ['alibaba', 'aliexpress', 'wholesale order', 'bulk purchase'],
    categoryId: '550e8400-e29b-41d4-a716-446655440205' as CategoryId,
    categoryName: 'Supplier Purchases',
    confidence: 0.82,
    weight: 4,
    domain: 'wholesale_platforms'
  },

  // === Packaging (COGS) ===
  {
    keywords: ['packaging', 'boxes', 'mailers', 'poly bags', 'bubble wrap', 'packing tape'],
    categoryId: '550e8400-e29b-41d4-a716-446655440206' as CategoryId,
    categoryName: 'Packaging',
    confidence: 0.92,
    weight: 6,
    domain: 'packaging_materials'
  },
  {
    keywords: ['shipping supplies', 'packing materials', 'cartons', 'labels'],
    categoryId: '550e8400-e29b-41d4-a716-446655440206' as CategoryId,
    categoryName: 'Packaging',
    confidence: 0.88,
    weight: 5,
    domain: 'packing_supplies'
  },

  // === Shipping & Postage (COGS - Outbound) ===
  {
    keywords: ['postage', 'shipping label', 'freight', 'delivery charge', 'carrier fee'],
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    confidence: 0.90,
    weight: 5,
    domain: 'outbound_shipping'
  },
  {
    keywords: ['priority mail', 'ground shipping', 'express delivery', 'overnight'],
    categoryId: '550e8400-e29b-41d4-a716-446655440207' as CategoryId,
    categoryName: 'Shipping & Postage',
    confidence: 0.88,
    weight: 5,
    domain: 'shipping_services'
  },

  // === Returns Processing (COGS) ===
  {
    keywords: ['rma', 'return authorization', 'return label', 'restocking fee', 'return processing'],
    categoryId: '550e8400-e29b-41d4-a716-446655440208' as CategoryId,
    categoryName: 'Returns Processing',
    confidence: 0.90,
    weight: 5,
    domain: 'returns_handling',
    excludeKeywords: ['refund'] // Refunds go to revenue contra
  },
  {
    keywords: ['reverse logistics', 'return shipping', 'damaged goods'],
    categoryId: '550e8400-e29b-41d4-a716-446655440208' as CategoryId,
    categoryName: 'Returns Processing',
    confidence: 0.85,
    weight: 4,
    domain: 'returns_logistics'
  },

  // === Marketing & Ads (OpEx) ===
  {
    keywords: ['advertising', 'ad spend', 'campaign', 'sponsored', 'promotion'],
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.88,
    weight: 5,
    domain: 'advertising'
  },
  {
    keywords: ['facebook ads', 'google ads', 'tiktok ads', 'instagram ads', 'pinterest ads'],
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.93,
    weight: 6,
    domain: 'digital_advertising'
  },
  {
    keywords: ['influencer', 'affiliate', 'marketing agency', 'creative services'],
    categoryId: '550e8400-e29b-41d4-a716-446655440303' as CategoryId,
    categoryName: 'Marketing & Ads',
    confidence: 0.85,
    weight: 4,
    domain: 'marketing_services'
  },

  // === Software Subscriptions (OpEx) ===
  {
    keywords: ['subscription', 'saas', 'monthly plan', 'annual plan', 'license fee'],
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.85,
    weight: 4,
    domain: 'software_licensing'
  },
  {
    keywords: ['app charge', 'shopify app', 'plugin', 'extension', 'integration'],
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.88,
    weight: 5,
    domain: 'ecommerce_apps'
  },
  {
    keywords: ['domain', 'hosting', 'ssl certificate', 'cdn', 'cloud storage'],
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.90,
    weight: 5,
    domain: 'web_services'
  },
  {
    keywords: ['email marketing', 'sms platform', 'analytics', 'crm'],
    categoryId: '550e8400-e29b-41d4-a716-446655440304' as CategoryId,
    categoryName: 'Software Subscriptions',
    confidence: 0.87,
    weight: 4,
    domain: 'marketing_tools'
  },

  // === Labor (OpEx) ===
  {
    keywords: ['payroll', 'wages', 'salary', 'contractor', 'freelance'],
    categoryId: '550e8400-e29b-41d4-a716-446655440305' as CategoryId,
    categoryName: 'Labor',
    confidence: 0.92,
    weight: 6,
    domain: 'payroll'
  },
  {
    keywords: ['employee benefits', 'health insurance', 'workers comp', 'fica', 'withholding'],
    categoryId: '550e8400-e29b-41d4-a716-446655440305' as CategoryId,
    categoryName: 'Labor',
    confidence: 0.90,
    weight: 5,
    domain: 'employment_taxes'
  },

  // === Operations & Logistics (OpEx) ===
  {
    keywords: ['3pl', 'fulfillment center', 'pick and pack', 'warehouse', 'storage fee'],
    categoryId: '550e8400-e29b-41d4-a716-446655440306' as CategoryId,
    categoryName: 'Operations & Logistics',
    confidence: 0.92,
    weight: 6,
    domain: 'fulfillment'
  },
  {
    keywords: ['prep service', 'kitting', 'assembly', 'inventory management'],
    categoryId: '550e8400-e29b-41d4-a716-446655440306' as CategoryId,
    categoryName: 'Operations & Logistics',
    confidence: 0.88,
    weight: 5,
    domain: 'fulfillment_services'
  },
  {
    keywords: ['customer service', 'support tickets', 'helpdesk', 'live chat'],
    categoryId: '550e8400-e29b-41d4-a716-446655440306' as CategoryId,
    categoryName: 'Operations & Logistics',
    confidence: 0.80,
    weight: 3,
    domain: 'customer_support'
  },

  // === General & Administrative (OpEx) ===
  {
    keywords: ['rent', 'lease', 'office space', 'co-working'],
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.90,
    weight: 5,
    domain: 'facilities',
    excludeKeywords: ['car', 'vehicle']
  },
  {
    keywords: ['electric', 'electricity', 'gas', 'water', 'utilities', 'internet', 'phone'],
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.88,
    weight: 5,
    domain: 'utilities',
    excludeKeywords: ['gasoline', 'fuel']
  },
  {
    keywords: ['insurance', 'liability', 'coverage', 'premium', 'policy'],
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.92,
    weight: 5,
    domain: 'insurance'
  },
  {
    keywords: ['accountant', 'bookkeeping', 'lawyer', 'attorney', 'legal fees'],
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.90,
    weight: 5,
    domain: 'professional_services'
  },
  {
    keywords: ['office supplies', 'paper', 'pens', 'furniture', 'desk'],
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.82,
    weight: 3,
    domain: 'office_supplies'
  },
  {
    keywords: ['bank fee', 'monthly fee', 'overdraft', 'wire transfer'],
    categoryId: '550e8400-e29b-41d4-a716-446655440307' as CategoryId,
    categoryName: 'General & Administrative',
    confidence: 0.85,
    weight: 4,
    domain: 'banking',
    excludeKeywords: ['payment processing', 'merchant']
  },

  // === Miscellaneous (OpEx) ===
  {
    keywords: ['travel', 'hotel', 'airfare', 'conference', 'trade show'],
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.85,
    weight: 4,
    domain: 'business_travel'
  },
  {
    keywords: ['gasoline', 'fuel', 'parking', 'toll', 'mileage'],
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.82,
    weight: 3,
    domain: 'vehicle'
  },
  {
    keywords: ['lunch', 'dinner', 'meal', 'restaurant', 'catering'],
    categoryId: '550e8400-e29b-41d4-a716-446655440308' as CategoryId,
    categoryName: 'Miscellaneous',
    confidence: 0.75,
    weight: 3,
    domain: 'meals',
    excludeKeywords: ['personal']
  },

  // === Taxes & Liabilities (Hidden) ===
  {
    keywords: ['sales tax', 'state tax', 'tax payment', 'revenue department'],
    categoryId: '550e8400-e29b-41d4-a716-446655440601' as CategoryId,
    categoryName: 'Taxes & Liabilities',
    confidence: 0.95,
    weight: 6,
    domain: 'tax_payments'
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