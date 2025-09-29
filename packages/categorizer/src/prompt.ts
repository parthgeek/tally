import type { NormalizedTransaction } from '@nexus/types';
import { getPromptCategories, getCategoriesByType } from './taxonomy.js';
import { CategorizerFeatureFlag, isFeatureEnabled, type FeatureFlagConfig } from '../../../services/categorizer/feature-flags.js';

/**
 * Pass-1 signal context for LLM prompts
 */
export interface Pass1Context {
  topSignals?: Array<{
    type: string;
    evidence: string;
    confidence: number;
  }>;
  categoryName?: string;
  confidence?: number;
}

/**
 * Builds a categorization prompt for e-commerce businesses using centralized taxonomy
 * Optionally includes Pass-1 deterministic signals to guide LLM
 */
export function buildCategorizationPrompt(
  tx: NormalizedTransaction,
  priorCategoryName?: string,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development',
  pass1Context?: Pass1Context
): string {
  // Trim description to 160 chars as specified in requirements
  const trimmedDescription = tx.description.length > 160
    ? tx.description.substring(0, 157) + '...'
    : tx.description;

  // Get categories organized by type for display, respecting feature flags
  const revenueCategories = getCategoriesByType('revenue', config, environment).filter(c => c.includeInPrompt);
  const cogsCategories = getCategoriesByType('cogs', config, environment).filter(c => c.includeInPrompt);
  const opexCategories = getCategoriesByType('opex', config, environment).filter(c => c.includeInPrompt);

  // Build category lists for prompt
  const revenueSlugs = revenueCategories.map(c => c.slug).join(', ');
  const cogsSlugs = cogsCategories.map(c => c.slug).join(', ');
  const opexSlugs = opexCategories.map(c => c.slug).join(', ');

  // Build Pass-1 context section if available
  let pass1Section = '';
  if (pass1Context && pass1Context.topSignals && pass1Context.topSignals.length > 0) {
    pass1Section = `\nPass-1 Analysis (Rule-based signals):
${pass1Context.topSignals.map(s => 
  `- ${s.type.toUpperCase()}: ${s.evidence} (confidence: ${(s.confidence * 100).toFixed(0)}%)`
).join('\n')}`;
    
    if (pass1Context.categoryName && pass1Context.confidence && pass1Context.confidence >= 0.70) {
      pass1Section += `\n- Suggested category: ${pass1Context.categoryName} (confidence: ${(pass1Context.confidence * 100).toFixed(0)}%)`;
    }
    
    pass1Section += '\n\nIMPORTANT: The above signals are from deterministic rules (MCC codes, vendor patterns, keywords). If these signals are strong (>80% confidence), they should heavily influence your categorization unless you have compelling evidence to the contrary.\n';
  }

  const prompt = `You are a financial categorization expert for e-commerce businesses. Always respond with valid JSON only.

Categorize this business transaction for an e-commerce store:

Transaction Details:
- Merchant: ${tx.merchantName || 'Unknown'}
- Description: ${trimmedDescription}
- Amount: $${(parseInt(tx.amountCents) / 100).toFixed(2)}
- MCC: ${tx.mcc || 'Not provided'}
- Industry: ecommerce
${priorCategoryName ? `- Prior category: ${priorCategoryName}` : ''}${pass1Section}

Available categories:
Revenue: ${revenueSlugs}
COGS: ${cogsSlugs}
Expenses: ${opexSlugs}

Return JSON only:
{
  "category_slug": "most_appropriate_category",
  "confidence": 0.95,
  "rationale": "Brief explanation of why this category fits"
}

`;

  // Check if two-tier taxonomy is enabled for different rules
  const isTwoTierEnabled = isFeatureEnabled(
    CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED,
    config,
    environment
  );

  const rulesSection = isTwoTierEnabled
    ? `Rules:
- Refunds/returns must not map to revenue; choose refunds_contra.
- Payment processors (Stripe, PayPal, Shopify Payments, BNPL) must not map to revenue; choose payment_processing_fees.
- Outbound shipping to customers goes to shipping_postage (COGS); inbound freight stays supplier_purchases.
- If uncertain, choose miscellaneous with lower confidence.
- Never put refunds or payment processors in miscellaneous.`
    : `Rules:
- Refunds/returns must not map to revenue; choose refunds_allowances_contra.
- Payment processors (Stripe, PayPal, Shopify Payments, BNPL) must not map to revenue.
- If uncertain, choose a broader expense category with lower confidence.`;

  return prompt + rulesSection;
}

/**
 * Gets available category slugs for validation
 */
export function getAvailableCategorySlugs(
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): string[] {
  return getPromptCategories(config, environment).map(category => category.slug);
}

/**
 * Validates if a category slug is available in the prompt
 */
export function isValidCategorySlug(
  slug: string,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): boolean {
  return getAvailableCategorySlugs(config, environment).includes(slug);
}