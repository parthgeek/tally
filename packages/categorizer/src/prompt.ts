/**
 * Universal Prompt Builder for Multi-Vertical Categorization
 * 
 * This prompt system teaches the LLM to:
 * 1. Categorize into universal categories (not vendor names)
 * 2. Extract relevant attributes (vendor, platform, etc.)
 * 3. Provide confidence scores and rationale
 */

import { getPromptCategoriesForIndustry, type Industry, type UniversalCategory } from './taxonomy.js';

export interface PromptContext {
  industry: Industry;
  transaction: {
    description: string;
    merchantName: string | null;
    amount: number;
    mcc: string | null;
    date?: string;
  };
}

export interface LLMResponse {
  category_slug: string;
  confidence: number;
  attributes?: Record<string, string>;
  rationale: string;
}

/**
 * Build universal categorization prompt
 */
export function buildUniversalPrompt(context: PromptContext): string {
  const categories = getPromptCategoriesForIndustry(context.industry);
  
  // Format categories for prompt
  const categoriesFormatted = categories.map(formatCategoryForPrompt).join('\n\n');
  
  // Build few-shot examples
  const examples = getFewShotExamples(context.industry);
  const examplesFormatted = examples.map(formatExample).join('\n\n');
  
  return `You are a financial categorization expert for ${getIndustryDescription(context.industry)} businesses.

Your task is to categorize this business transaction into ONE category AND extract relevant attributes.

TRANSACTION TO CATEGORIZE:
Merchant: ${context.transaction.merchantName || 'Unknown'}
Description: ${context.transaction.description}
Amount: $${(context.transaction.amount / 100).toFixed(2)}
MCC Code: ${context.transaction.mcc || 'Not provided'}
${context.transaction.date ? `Date: ${context.transaction.date}` : ''}

AVAILABLE CATEGORIES:
${categoriesFormatted}

IMPORTANT INSTRUCTIONS:
1. Choose the MOST APPROPRIATE category from the list above based on the transaction PURPOSE
2. Vendor names (Stripe, Meta, Google, etc.) are NOT categories - they are ATTRIBUTES
3. Extract any relevant attributes based on the transaction details
4. Provide a confidence score (0-1) based on how certain you are
5. Give a brief, specific rationale

CRITICAL RULES:
- Payment processors (Stripe, PayPal, Square) → "payment_processing_fees" category with processor attribute
- Ad platforms (Facebook, Google, TikTok) → "marketing_ads" category with platform attribute
- Internet service providers (Comcast, Verizon, AT&T, Spectrum) → "telecommunications" category (NOT software_subscriptions)
- Business phone/VoIP (Zoom Phone, RingCentral) → "telecommunications" category
- Business software tools (Slack, Zoom meetings, Google Workspace, Adobe) → "software_subscriptions" category with vendor attribute
- 3PL/warehouses → "fulfillment_logistics" category with provider attribute
- When uncertain, prefer more general categories over specific ones
- If truly unclear, use "miscellaneous" category

DECISION-MAKING FRAMEWORK:

Step 1: Identify the PURPOSE
- What is the primary business function? (acquiring customers, processing payments, shipping products, etc.)
- Ignore the vendor name initially - focus on the economic substance

Step 2: Classify by Financial Statement Section
- Does this generate REVENUE? → Use revenue categories
- Does this directly cost to produce/deliver? → Use COGS categories  
- Does this support operations but isn't production? → Use OpEx categories
- Is this tax or a clearing account? → Use liability/clearing categories

Step 3: Select the Most Specific Category
- Prefer specific categories over general ones when confident
- Use "miscellaneous" only when truly unclear
- Remember: vendor names go in attributes, not categories

Step 4: Common Disambiguations
- Shopify/Amazon payments TO YOU → platform_fees (they charge you fees)
- Shopify/Amazon SALES → product_sales (revenue from customers buying products)
- Shopify PAYOUT → payouts_clearing (just transferring money, NOT revenue)
- Shipping CHARGED to customer → shipping_income (revenue you collect)
- Shipping YOU pay to carrier → freight_shipping (COGS, cost to fulfill)
- Office supplies for business → office_supplies (general OpEx)
- Packaging supplies for products → packaging (COGS, direct product cost)
- Marketing tools (Klaviyo, Mailchimp) → marketing_ads (customer acquisition)
- General business tools (Slack, Zoom meetings) → software_subscriptions (productivity)
- Internet service (Comcast, Verizon, Spectrum, AT&T) → telecommunications (NOT software_subscriptions)
- Business phone systems (Zoom Phone, RingCentral) → telecommunications (NOT software_subscriptions)
- Warehouse/fulfillment services → fulfillment_logistics (e-commerce specific)
- Rent for warehouse → rent_utilities (facilities OpEx)

CONFIDENCE SCORE GUIDANCE:

HIGH confidence (0.90-1.00):
- Exact match to examples (e.g., "Stripe payment fee" → payment_processing_fees)
- Clear, unambiguous descriptions with known vendors
- Transaction purpose is obvious from description

MEDIUM confidence (0.70-0.89):
- Category is clear but description is somewhat generic
- Vendor is known but transaction type has minor ambiguity
- One category is most likely among 2 possibilities

LOW confidence (0.50-0.69):
- Description is generic or unclear
- Vendor is unfamiliar or transaction type is ambiguous
- Could reasonably fit 2-3 categories

VERY LOW confidence (0.30-0.49):
- Very little information in description
- Unknown vendor with unclear purpose
- Multiple categories equally plausible

When in doubt, err on the side of LOWER confidence and more general categories.

EXAMPLES OF CORRECT CATEGORIZATION:
${examplesFormatted}

Now categorize the transaction above. Respond with valid JSON only:
{
  "category_slug": "most_appropriate_category",
  "confidence": 0.95,
  "attributes": {
    "key": "value"
  },
  "rationale": "Brief explanation of why this category fits"
}`;
}

/**
 * Format category for prompt display
 */
function formatCategoryForPrompt(category: UniversalCategory): string {
  const attributes = Object.keys(category.attributeSchema);
  const hasAttributes = attributes.length > 0;
  
  let formatted = `• ${category.slug} - "${category.name}"`;
  
  if (category.description) {
    formatted += `\n  Description: ${category.description}`;
  }
  
  if (category.examples && category.examples.length > 0) {
    formatted += `\n  Examples: ${category.examples.slice(0, 3).join(', ')}`;
  }
  
  if (hasAttributes) {
    formatted += `\n  Extractable attributes: ${attributes.join(', ')}`;
  }
  
  return formatted;
}

/**
 * Get few-shot examples for an industry
 */
function getFewShotExamples(industry: Industry): Array<{
  description: string;
  merchant: string;
  category: string;
  attributes: Record<string, string>;
  rationale: string;
}> {
  const universalExamples = [
    {
      description: 'STRIPE PAYMENT PROCESSING FEE',
      merchant: 'Stripe',
      category: 'payment_processing_fees',
      attributes: { processor: 'Stripe', fee_type: 'transaction' },
      rationale: 'Payment processing fee - NOT a Stripe category, but payment_processing_fees with Stripe as attribute'
    },
    {
      description: 'FACEBOOK ADS MANAGER CHARGE',
      merchant: 'Meta',
      category: 'marketing_ads',
      attributes: { platform: 'Meta', campaign_type: 'paid_social' },
      rationale: 'Digital advertising - NOT a Facebook category, but marketing_ads with Meta as platform attribute'
    },
    {
      description: 'ADOBE CREATIVE CLOUD SUBSCRIPTION',
      merchant: 'Adobe',
      category: 'software_subscriptions',
      attributes: { vendor: 'Adobe', category: 'design', subscription_type: 'monthly' },
      rationale: 'Software subscription - vendor name goes in attributes, not category'
    },
    {
      description: 'CUSTOMER REFUND - ORDER #12345',
      merchant: 'Unknown',
      category: 'refunds_contra',
      attributes: { reason: 'return' },
      rationale: 'Customer refund reduces revenue (contra-revenue account)'
    },
    {
      description: 'KLAVIYO EMAIL MARKETING',
      merchant: 'Klaviyo',
      category: 'marketing_ads',
      attributes: { platform: 'Klaviyo', campaign_type: 'email' },
      rationale: 'Email marketing tool is customer acquisition (marketing_ads), NOT general software_subscriptions'
    },
    {
      description: 'USPS SHIPPING TO CUSTOMER',
      merchant: 'USPS',
      category: 'freight_shipping',
      attributes: { carrier: 'USPS', direction: 'outbound' },
      rationale: 'Shipping YOU pay to send to customer is freight_shipping (COGS), NOT shipping_income even if customer reimburses'
    },
    {
      description: 'PRINTER PAPER AND PENS',
      merchant: 'Office Depot',
      category: 'office_supplies',
      attributes: { supplier: 'Office Depot', item_type: 'general_office' },
      rationale: 'General office supplies (OpEx office_supplies), NOT packaging which is for products (COGS)'
    },
  ];
  
  const ecommerceExamples = [
    {
      description: 'SHOPIFY SUBSCRIPTION - BASIC PLAN',
      merchant: 'Shopify',
      category: 'platform_fees',
      attributes: { platform: 'Shopify', fee_type: 'monthly_subscription' },
      rationale: 'E-commerce platform subscription fee paid TO Shopify (platform_fees OpEx), NOT product_sales revenue'
    },
    {
      description: 'SHOPIFY PAYOUT - $5,234.21',
      merchant: 'Shopify',
      category: 'payouts_clearing',
      attributes: { platform: 'Shopify' },
      rationale: 'Payout is just a transfer of money already earned (clearing account), NOT new revenue'
    },
    {
      description: 'SHIPBOB FULFILLMENT FEES',
      merchant: 'ShipBob',
      category: 'fulfillment_logistics',
      attributes: { provider: 'ShipBob', service_type: 'pick_pack' },
      rationale: '3PL fulfillment service for e-commerce (fulfillment_logistics), specific to ecommerce industry'
    },
    {
      description: 'SUPPLIER INVOICE #A5678',
      merchant: 'ABC Wholesale',
      category: 'materials_supplies',
      attributes: { supplier: 'ABC Wholesale', material_type: 'inventory' },
      rationale: 'Inventory purchase from supplier (materials_supplies COGS), used to make/sell products'
    },
    {
      description: 'WAREHOUSE RENT - SEPTEMBER',
      merchant: 'Storage Co',
      category: 'rent_utilities',
      attributes: { facility_type: 'warehouse' },
      rationale: 'Warehouse rent is facilities cost (rent_utilities OpEx), NOT fulfillment_logistics which is 3PL services'
    },
  ];
  
  if (industry === 'ecommerce') {
    return [...universalExamples, ...ecommerceExamples];
  }
  
  return universalExamples;
}

/**
 * Format example for prompt
 */
function formatExample(example: {
  description: string;
  merchant: string;
  category: string;
  attributes: Record<string, string>;
  rationale: string;
}): string {
  const attrsFormatted = JSON.stringify(example.attributes, null, 2).split('\n').join('\n    ');
  
  return `Example:
  Merchant: ${example.merchant}
  Description: ${example.description}
  → category_slug: "${example.category}"
  → attributes: ${attrsFormatted}
  → rationale: "${example.rationale}"`;
}


/**
 * Get industry description for prompt
 */
function getIndustryDescription(industry: Industry): string {
  const descriptions: Record<Industry, string> = {
    all: 'general',
    ecommerce: 'e-commerce',
    saas: 'SaaS (Software-as-a-Service)',
    restaurant: 'restaurant',
    professional_services: 'professional services',
  };
  
  return descriptions[industry] || 'business';
}

/**
 * Parse LLM response
 */
export function parseLLMResponse(responseText: string): LLMResponse {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                      responseText.match(/```\s*([\s\S]*?)\s*```/);
    
    const jsonText = jsonMatch ? jsonMatch[1] : responseText;
    
    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Empty response text from LLM');
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate required fields
    if (!parsed.category_slug) {
      throw new Error('Missing category_slug in response');
    }
    
    return {
      category_slug: parsed.category_slug,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      attributes: parsed.attributes || {},
      rationale: parsed.rationale || 'No rationale provided',
    };
  } catch (error) {
    console.error('Failed to parse LLM response:', error);
    console.error('Response text:', responseText);
    
    // Fallback to miscellaneous
    return {
      category_slug: 'miscellaneous',
      confidence: 0.3,
      attributes: {},
      rationale: 'Failed to parse LLM response',
    };
  }
}

/**
 * Get available category slugs for validation
 */
export function getAvailableCategorySlugs(industry: Industry): string[] {
  return getPromptCategoriesForIndustry(industry).map(c => c.slug);
}

/**
 * Validate if a category slug is available in the prompt
 */
export function isValidCategorySlug(slug: string, industry: Industry): boolean {
  const validSlugs = getAvailableCategorySlugs(industry);
  return validSlugs.includes(slug);
}

