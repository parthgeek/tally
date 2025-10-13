import type { NormalizedTransaction } from "@nexus/types";
import { getPromptCategories, getCategoriesByType } from "./taxonomy.js";
import {
  CategorizerFeatureFlag,
  isFeatureEnabled,
  type FeatureFlagConfig,
} from "./feature-flags.js";

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
 * Few-shot examples to guide LLM categorization
 * Selected based on common misclassification patterns from ablation studies
 */
const FEW_SHOT_EXAMPLES = [
  {
    merchant: "USPS",
    description: "POSTAGE STAMP PURCHASE",
    amount: "$65.00",
    mcc: "9402",
    category_slug: "shipping_postage",
    rationale: "Shipping costs are COGS for e-commerce, not operating expenses",
  },
  {
    merchant: "FedEx",
    description: "FEDEX GROUND SHIPPING",
    amount: "$125.50",
    mcc: "4215",
    category_slug: "shipping_postage",
    rationale: "Outbound shipping to customers is COGS",
  },
  {
    merchant: "Alibaba",
    description: "SUPPLIER PAYMENT - INVENTORY",
    amount: "$2450.00",
    mcc: "5999",
    category_slug: "supplier_purchases",
    rationale: "Inventory purchases from suppliers are COGS",
  },
  {
    merchant: "Stripe",
    description: "STRIPE PAYMENT PROCESSING FEE",
    amount: "$45.80",
    mcc: "6051",
    category_slug: "payment_processing_fees",
    rationale: "Payment processor fees are operating expenses, not COGS",
  },
  {
    merchant: "QuickBooks",
    description: "QUICKBOOKS SUBSCRIPTION",
    amount: "$50.00",
    mcc: "7372",
    category_slug: "software_subscriptions",
    rationale: "Accounting software is a business software subscription",
  },
  {
    merchant: "Unknown Vendor",
    description: "MISC EXPENSE - OFFICE",
    amount: "$32.15",
    mcc: null,
    category_slug: "miscellaneous",
    rationale: "Unclear expenses with no specific category should be marked miscellaneous",
  },
  {
    merchant: "Customer Refund",
    description: "REFUND - ORDER #12345",
    amount: "$89.99",
    mcc: null,
    category_slug: "refunds_contra",
    rationale: "Customer refunds are contra-revenue, not expenses",
  },
];

/**
 * Builds a categorization prompt for e-commerce businesses using centralized taxonomy
 * Optionally includes Pass-1 deterministic signals to guide LLM
 */
export function buildCategorizationPrompt(
  tx: NormalizedTransaction,
  priorCategoryName?: string,
  config: FeatureFlagConfig = {},
  environment: "development" | "staging" | "production" = "development",
  pass1Context?: Pass1Context
): string {
  // Trim description to 160 chars as specified in requirements
  const trimmedDescription =
    tx.description.length > 160 ? tx.description.substring(0, 157) + "..." : tx.description;

  // Get categories organized by type for display, respecting feature flags
  const revenueCategories = getCategoriesByType("revenue", config, environment).filter(
    (c) => c.includeInPrompt
  );
  const cogsCategories = getCategoriesByType("cogs", config, environment).filter(
    (c) => c.includeInPrompt
  );
  const opexCategories = getCategoriesByType("opex", config, environment).filter(
    (c) => c.includeInPrompt
  );

  // Build category lists for prompt
  const revenueSlugs = revenueCategories.map((c) => c.slug).join(", ");
  const cogsSlugs = cogsCategories.map((c) => c.slug).join(", ");
  const opexSlugs = opexCategories.map((c) => c.slug).join(", ");

  // Build Pass-1 context section if available
  let pass1Section = "";
  if (pass1Context && pass1Context.topSignals && pass1Context.topSignals.length > 0) {
    pass1Section = `\nPass-1 Analysis (Rule-based signals):
${pass1Context.topSignals
  .map(
    (s) =>
      `- ${s.type.toUpperCase()}: ${s.evidence} (confidence: ${(s.confidence * 100).toFixed(0)}%)`
  )
  .join("\n")}`;

    if (pass1Context.categoryName && pass1Context.confidence && pass1Context.confidence >= 0.7) {
      pass1Section += `\n- Suggested category: ${pass1Context.categoryName} (confidence: ${(pass1Context.confidence * 100).toFixed(0)}%)`;
    }

    pass1Section +=
      "\n\nIMPORTANT: The above signals are from deterministic rules (MCC codes, vendor patterns, keywords). If these signals are strong (>80% confidence), they should heavily influence your categorization unless you have compelling evidence to the contrary.\n";
  }

  // Build few-shot examples section
  const fewShotSection = `
Here are some example categorizations to guide you:

${FEW_SHOT_EXAMPLES.map(
  (ex) => `Example:
Merchant: ${ex.merchant}
Description: ${ex.description}
Amount: ${ex.amount}
MCC: ${ex.mcc || "Not provided"}
→ category_slug: "${ex.category_slug}"
→ rationale: "${ex.rationale}"`
).join("\n\n")}
`;

  const prompt = `You are a financial categorization expert for e-commerce businesses. Always respond with valid JSON only.
${fewShotSection}

Now categorize this business transaction for an e-commerce store:

Transaction Details:
- Merchant: ${tx.merchantName || "Unknown"}
- Description: ${trimmedDescription}
- Amount: $${(parseInt(tx.amountCents) / 100).toFixed(2)}
- MCC: ${tx.mcc || "Not provided"}
- Industry: ecommerce
${priorCategoryName ? `- Prior category: ${priorCategoryName}` : ""}${pass1Section}

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
  environment: "development" | "staging" | "production" = "development"
): string[] {
  return getPromptCategories(config, environment).map((category) => category.slug);
}

/**
 * Validates if a category slug is available in the prompt
 */
export function isValidCategorySlug(
  slug: string,
  config: FeatureFlagConfig = {},
  environment: "development" | "staging" | "production" = "development"
): boolean {
  return getAvailableCategorySlugs(config, environment).includes(slug);
}
