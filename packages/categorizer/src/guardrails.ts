import type { NormalizedTransaction } from '@nexus/types';
import { getCategoryBySlug, mapCategorySlugToId } from './taxonomy.js';
import { CategorizerFeatureFlag, isFeatureEnabled, type FeatureFlagConfig } from '../../../services/categorizer/feature-flags.js';

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  suggestedCategorySlug?: string;
  confidencePenalty?: number;
}

/**
 * E-commerce specific guardrails to prevent incorrect categorizations
 */

/**
 * Checks if a transaction should be blocked from mapping to revenue categories
 */
export function checkRevenueGuardrails(
  tx: NormalizedTransaction,
  proposedCategorySlug: string,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): GuardrailResult {
  const category = getCategoryBySlug(proposedCategorySlug, config, environment);

  // Check if two-tier taxonomy is enabled for different refund category handling
  const isTwoTierEnabled = isFeatureEnabled(
    CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED,
    config,
    environment
  );

  // Only apply to revenue categories
  if (!category || category.type !== 'revenue') {
    return { allowed: true };
  }

  const description = tx.description.toLowerCase();
  const merchantName = (tx.merchantName || '').toLowerCase();

  // Block refunds/returns from mapping to positive revenue
  const refundKeywords = [
    'refund', 'return', 'chargeback', 'reversal', 'void',
    'cancelled', 'dispute', 'adjustment', 'credit'
  ];

  const hasRefundKeywords = refundKeywords.some(keyword =>
    description.includes(keyword) || (merchantName && merchantName.includes(keyword))
  );

  // Check for negative amounts (typically refunds) and refund keywords
  const isNegativeAmount = parseInt(tx.amountCents) < 0;
  const isRefundPattern = hasRefundKeywords || isNegativeAmount;

  if (isRefundPattern && !proposedCategorySlug.includes('contra')) {
    const refundCategory = isTwoTierEnabled ? 'refunds_contra' : 'refunds_allowances_contra';
    return {
      allowed: false,
      reason: 'Refund/return cannot map to positive revenue',
      suggestedCategorySlug: refundCategory,
      confidencePenalty: 0.4
    };
  }

  // Block payment processors from mapping to revenue
  const paymentProcessors = [
    'stripe', 'paypal', 'square', 'shopify payments', 'shop pay',
    'afterpay', 'affirm', 'klarna', 'sezzle', 'adyen', 'braintree'
  ];

  const isPaymentProcessor = paymentProcessors.some(processor =>
    (merchantName && merchantName.includes(processor)) || description.includes(processor)
  );

  if (isPaymentProcessor) {
    return {
      allowed: false,
      reason: 'Payment processor cannot map to revenue',
      suggestedCategorySlug: 'payment_processing_fees',
      confidencePenalty: 0.3
    };
  }

  return { allowed: true };
}

/**
 * Checks shipping direction and routes to appropriate category
 */
export function checkShippingDirectionGuardrails(
  tx: NormalizedTransaction,
  proposedCategorySlug: string,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): GuardrailResult {
  const isTwoTierEnabled = isFeatureEnabled(
    CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED,
    config,
    environment
  );

  // Only apply for two-tier taxonomy (legacy taxonomy doesn't distinguish shipping direction)
  if (!isTwoTierEnabled) {
    return { allowed: true };
  }

  const description = tx.description.toLowerCase();
  const merchantName = (tx.merchantName || '').toLowerCase();

  // Outbound shipping carriers (to customers) -> shipping_postage (COGS)
  const outboundCarriers = ['usps', 'ups', 'fedex', 'dhl', 'postal service'];
  const outboundKeywords = ['shipping', 'postage', 'delivery', 'freight to'];

  const isOutboundShipping = outboundCarriers.some(carrier =>
    merchantName.includes(carrier) || description.includes(carrier)
  ) || outboundKeywords.some(keyword =>
    description.includes(keyword)
  );

  // Inbound shipping (from suppliers) -> supplier_purchases (COGS)
  const inboundKeywords = ['freight from', 'inbound freight', 'supplier shipping', 'wholesale freight'];
  const isInboundShipping = inboundKeywords.some(keyword =>
    description.includes(keyword)
  );

  // Shipping software/platforms -> operations_logistics (OpEx)
  const shippingPlatforms = ['shipstation', 'shippo', 'easypost', 'pirate ship'];
  const isShippingPlatform = shippingPlatforms.some(platform =>
    merchantName.includes(platform) || description.includes(platform)
  );

  if (isOutboundShipping && proposedCategorySlug !== 'shipping_postage') {
    return {
      allowed: false,
      reason: 'Outbound shipping should map to shipping_postage (COGS)',
      suggestedCategorySlug: 'shipping_postage',
      confidencePenalty: 0.2
    };
  }

  if (isInboundShipping && proposedCategorySlug !== 'supplier_purchases') {
    return {
      allowed: false,
      reason: 'Inbound freight should map to supplier_purchases (COGS)',
      suggestedCategorySlug: 'supplier_purchases',
      confidencePenalty: 0.2
    };
  }

  if (isShippingPlatform && proposedCategorySlug !== 'operations_logistics') {
    return {
      allowed: false,
      reason: 'Shipping software should map to operations_logistics (OpEx)',
      suggestedCategorySlug: 'operations_logistics',
      confidencePenalty: 0.2
    };
  }

  return { allowed: true };
}

/**
 * Checks for sales tax patterns and routes to liability account
 */
export function checkSalesTaxGuardrails(
  tx: NormalizedTransaction,
  proposedCategorySlug: string,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): GuardrailResult {
  const description = tx.description.toLowerCase();
  const merchantName = (tx.merchantName || '').toLowerCase();

  const salesTaxKeywords = [
    'sales tax', 'state tax', 'local tax', 'use tax',
    'revenue department', 'tax authority', 'comptroller',
    'department of revenue', 'tax commission'
  ];

  const hasSalesTaxPattern = salesTaxKeywords.some(keyword =>
    description.includes(keyword) || (merchantName && merchantName.includes(keyword))
  );

  // Check for tax authority merchants
  const taxAuthorities = [
    'state of', 'city of', 'county of', 'department of revenue',
    'tax collector', 'revenue service'
  ];

  const isTaxAuthority = taxAuthorities.some(authority =>
    merchantName && merchantName.includes(authority)
  );

  if ((hasSalesTaxPattern || isTaxAuthority) && proposedCategorySlug !== 'sales_tax_payable') {
    return {
      allowed: false,
      reason: 'Sales tax payment should map to liability account',
      suggestedCategorySlug: 'sales_tax_payable',
      confidencePenalty: 0.2
    };
  }

  return { allowed: true };
}

/**
 * Checks for universal payout patterns and routes to clearing account
 */
export function checkPayoutGuardrails(
  tx: NormalizedTransaction,
  proposedCategorySlug: string,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): GuardrailResult {
  const description = tx.description.toLowerCase();
  const merchantName = (tx.merchantName || '').toLowerCase();

  const isTwoTierEnabled = isFeatureEnabled(
    CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED,
    config,
    environment
  );

  // Universal payout patterns
  const payoutKeywords = [
    'payout', 'transfer', 'deposit', 'settlement', 'disbursement'
  ];

  const paymentProcessors = [
    'shopify', 'stripe', 'paypal', 'square', 'amazon payments'
  ];

  const hasPayoutKeywords = payoutKeywords.some(keyword =>
    description.includes(keyword)
  );

  const isPaymentProcessorMerchant = paymentProcessors.some(processor =>
    merchantName.includes(processor)
  );

  const clearingCategory = isTwoTierEnabled ? 'payouts_clearing' : 'shopify_payouts_clearing';
  const expectedCategory = isTwoTierEnabled ? 'payouts_clearing' : 'shopify_payouts_clearing';

  if (isPaymentProcessorMerchant && hasPayoutKeywords && proposedCategorySlug !== expectedCategory) {
    return {
      allowed: false,
      reason: 'Payment processor payouts should map to clearing account',
      suggestedCategorySlug: clearingCategory,
      confidencePenalty: 0.1
    };
  }

  return { allowed: true };
}

/**
 * Applies all e-commerce guardrails to a proposed categorization
 */
export function applyEcommerceGuardrails(
  tx: NormalizedTransaction,
  proposedCategorySlug: string,
  confidence: number,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): {
  categorySlug: string;
  confidence: number;
  guardrailsApplied: string[];
  violations: string[];
} {
  let finalCategorySlug = proposedCategorySlug;
  let finalConfidence = confidence;
  const guardrailsApplied: string[] = [];
  const violations: string[] = [];

  // Apply revenue guardrails
  const revenueCheck = checkRevenueGuardrails(tx, proposedCategorySlug, config, environment);
  if (!revenueCheck.allowed) {
    violations.push(revenueCheck.reason!);
    if (revenueCheck.suggestedCategorySlug) {
      finalCategorySlug = revenueCheck.suggestedCategorySlug;
      guardrailsApplied.push('revenue_block');
    }
    if (revenueCheck.confidencePenalty) {
      finalConfidence = Math.max(0, finalConfidence - revenueCheck.confidencePenalty);
    }
  }

  // Apply shipping direction guardrails (two-tier taxonomy only)
  const shippingCheck = checkShippingDirectionGuardrails(tx, finalCategorySlug, config, environment);
  if (!shippingCheck.allowed) {
    violations.push(shippingCheck.reason!);
    if (shippingCheck.suggestedCategorySlug) {
      finalCategorySlug = shippingCheck.suggestedCategorySlug;
      guardrailsApplied.push('shipping_direction_redirect');
    }
    if (shippingCheck.confidencePenalty) {
      finalConfidence = Math.max(0, finalConfidence - shippingCheck.confidencePenalty);
    }
  }

  // Apply sales tax guardrails
  const salesTaxCheck = checkSalesTaxGuardrails(tx, finalCategorySlug, config, environment);
  if (!salesTaxCheck.allowed) {
    violations.push(salesTaxCheck.reason!);
    if (salesTaxCheck.suggestedCategorySlug) {
      finalCategorySlug = salesTaxCheck.suggestedCategorySlug;
      guardrailsApplied.push('sales_tax_redirect');
    }
    if (salesTaxCheck.confidencePenalty) {
      finalConfidence = Math.max(0, finalConfidence - salesTaxCheck.confidencePenalty);
    }
  }

  // Apply payout guardrails
  const payoutCheck = checkPayoutGuardrails(tx, finalCategorySlug, config, environment);
  if (!payoutCheck.allowed) {
    violations.push(payoutCheck.reason!);
    if (payoutCheck.suggestedCategorySlug) {
      finalCategorySlug = payoutCheck.suggestedCategorySlug;
      guardrailsApplied.push('payout_redirect');
    }
    if (payoutCheck.confidencePenalty) {
      finalConfidence = Math.max(0, finalConfidence - payoutCheck.confidencePenalty);
    }
  }

  return {
    categorySlug: finalCategorySlug,
    confidence: Math.max(0, Math.min(1, finalConfidence || 0)), // Ensure confidence is between 0 and 1, handle NaN
    guardrailsApplied,
    violations
  };
}

/**
 * Gets the category ID for a slug after applying guardrails
 */
export function getCategoryIdWithGuardrails(
  tx: NormalizedTransaction,
  proposedCategorySlug: string,
  confidence: number,
  config: FeatureFlagConfig = {},
  environment: 'development' | 'staging' | 'production' = 'development'
): {
  categoryId: string;
  confidence: number;
  guardrailsApplied: string[];
  violations: string[];
} {
  const result = applyEcommerceGuardrails(tx, proposedCategorySlug, confidence, config, environment);

  return {
    categoryId: mapCategorySlugToId(result.categorySlug, config, environment),
    confidence: result.confidence,
    guardrailsApplied: result.guardrailsApplied,
    violations: result.violations
  };
}