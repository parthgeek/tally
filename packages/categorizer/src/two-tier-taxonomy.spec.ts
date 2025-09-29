import { describe, expect, test } from 'vitest';
import {
  getActiveTaxonomy,
  getPromptCategories,
  getCategoriesByType,
  mapCategorySlugToId,
  TWO_TIER_TAXONOMY,
  ECOMMERCE_TAXONOMY
} from './taxonomy.js';
import { CategorizerFeatureFlag } from '../../../services/categorizer/feature-flags.js';
import {
  buildCategorizationPrompt,
  getAvailableCategorySlugs,
  isValidCategorySlug
} from './prompt.js';
import {
  checkRevenueGuardrails,
  checkShippingDirectionGuardrails,
  checkPayoutGuardrails,
  applyEcommerceGuardrails
} from './guardrails.js';
import type { NormalizedTransaction } from '@nexus/types';

describe('Two-tier taxonomy functionality', () => {
  const mockTransaction: NormalizedTransaction = {
    id: 'test-id' as any,
    orgId: 'test-org' as any,
    accountId: 'test-account',
    amountCents: '1000',
    description: 'Test transaction',
    merchantName: 'Test Merchant',
    date: '2024-01-01',
    mcc: '1234',
    categoryId: undefined,
    rawData: {},
    source: 'plaid',
    createdAt: '2024-01-01T00:00:00Z'
  };

  const twoTierConfig = {
    [CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED]: true
  };

  const legacyConfig = {
    [CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED]: false
  };

  describe('getActiveTaxonomy', () => {
    test('returns two-tier taxonomy when flag is enabled', () => {
      const taxonomy = getActiveTaxonomy(twoTierConfig, 'development');
      expect(taxonomy).toBe(TWO_TIER_TAXONOMY);
      expect(taxonomy.length).toBeLessThan(ECOMMERCE_TAXONOMY.length); // Should be simpler
    });

    test('returns legacy taxonomy when flag is disabled', () => {
      const taxonomy = getActiveTaxonomy(legacyConfig, 'development');
      expect(taxonomy).toBe(ECOMMERCE_TAXONOMY);
    });
  });

  describe('getPromptCategories', () => {
    test('returns only tier 2 buckets for two-tier taxonomy', () => {
      const categories = getPromptCategories(twoTierConfig, 'development');

      // Should have core umbrella buckets
      const categorySlugs = categories.map(c => c.slug);
      expect(categorySlugs).toContain('shipping_income');
      expect(categorySlugs).toContain('refunds_contra');
      expect(categorySlugs).toContain('supplier_purchases');
      expect(categorySlugs).toContain('packaging');
      expect(categorySlugs).toContain('shipping_postage');
      expect(categorySlugs).toContain('marketing_ads');
      expect(categorySlugs).toContain('software_subscriptions');
      expect(categorySlugs).toContain('payment_processing_fees');
      expect(categorySlugs).toContain('operations_logistics');
      expect(categorySlugs).toContain('general_administrative');
      expect(categorySlugs).toContain('miscellaneous');

      // Should NOT have fine-grained categories
      expect(categorySlugs).not.toContain('stripe_fees');
      expect(categorySlugs).not.toContain('ads_meta');
      expect(categorySlugs).not.toContain('shopify_platform');
    });

    test('returns legacy categories when flag is disabled', () => {
      const categories = getPromptCategories(legacyConfig, 'development');
      const categorySlugs = categories.map(c => c.slug);

      // Should have fine-grained categories
      expect(categorySlugs).toContain('stripe_fees');
      expect(categorySlugs).toContain('ads_meta');
      expect(categorySlugs).toContain('shopify_platform');
    });
  });

  describe('mapCategorySlugToId', () => {
    test('maps to miscellaneous fallback for two-tier taxonomy', () => {
      const categoryId = mapCategorySlugToId('nonexistent_category', twoTierConfig, 'development');
      const miscellaneousId = mapCategorySlugToId('miscellaneous', twoTierConfig, 'development');
      expect(categoryId).toBe(miscellaneousId);
    });

    test('maps to other_ops fallback for legacy taxonomy', () => {
      const categoryId = mapCategorySlugToId('nonexistent_category', legacyConfig, 'development');
      const otherOpsId = mapCategorySlugToId('other_ops', legacyConfig, 'development');
      expect(categoryId).toBe(otherOpsId);
    });
  });

  describe('buildCategorizationPrompt', () => {
    test('includes two-tier specific rules when flag is enabled', () => {
      const prompt = buildCategorizationPrompt(mockTransaction, undefined, twoTierConfig, 'development');

      expect(prompt).toContain('refunds_contra');
      expect(prompt).toContain('payment_processing_fees');
      expect(prompt).toContain('shipping_postage');
      expect(prompt).toContain('miscellaneous');
      expect(prompt).toContain('Never put refunds or payment processors in miscellaneous');
    });

    test('includes legacy rules when flag is disabled', () => {
      const prompt = buildCategorizationPrompt(mockTransaction, undefined, legacyConfig, 'development');

      expect(prompt).toContain('refunds_allowances_contra');
      expect(prompt).not.toContain('shipping_postage');
      expect(prompt).not.toContain('Never put refunds or payment processors in miscellaneous');
    });
  });

  describe('Revenue guardrails', () => {
    test('suggests refunds_contra for refunds in two-tier taxonomy', () => {
      const refundTx = {
        ...mockTransaction,
        amountCents: '-1000',
        description: 'Refund for order 12345'
      };

      const result = checkRevenueGuardrails(refundTx, 'shipping_income', twoTierConfig, 'development');

      expect(result.allowed).toBe(false);
      expect(result.suggestedCategorySlug).toBe('refunds_contra');
    });

    test('suggests refunds_allowances_contra for refunds in legacy taxonomy', () => {
      const refundTx = {
        ...mockTransaction,
        amountCents: '-1000',
        description: 'Refund for order 12345'
      };

      const result = checkRevenueGuardrails(refundTx, 'shipping_income', legacyConfig, 'development');

      expect(result.allowed).toBe(false);
      expect(result.suggestedCategorySlug).toBe('refunds_allowances_contra');
    });
  });

  describe('Shipping direction guardrails', () => {
    test('routes outbound shipping to shipping_postage in two-tier taxonomy', () => {
      const shippingTx = {
        ...mockTransaction,
        merchantName: 'UPS',
        description: 'Shipping to customer'
      };

      const result = checkShippingDirectionGuardrails(shippingTx, 'operations_logistics', twoTierConfig, 'development');

      expect(result.allowed).toBe(false);
      expect(result.suggestedCategorySlug).toBe('shipping_postage');
    });

    test('routes shipping platforms to operations_logistics in two-tier taxonomy', () => {
      const shippingTx = {
        ...mockTransaction,
        merchantName: 'ShipStation',
        description: 'Monthly subscription'
      };

      const result = checkShippingDirectionGuardrails(shippingTx, 'software_subscriptions', twoTierConfig, 'development');

      expect(result.allowed).toBe(false);
      expect(result.suggestedCategorySlug).toBe('operations_logistics');
    });

    test('does nothing for legacy taxonomy', () => {
      const shippingTx = {
        ...mockTransaction,
        merchantName: 'UPS',
        description: 'Shipping to customer'
      };

      const result = checkShippingDirectionGuardrails(shippingTx, 'shipping_expense', legacyConfig, 'development');

      expect(result.allowed).toBe(true);
    });
  });

  describe('Payout guardrails', () => {
    test('routes payouts to payouts_clearing in two-tier taxonomy', () => {
      const payoutTx = {
        ...mockTransaction,
        merchantName: 'Stripe',
        description: 'Transfer to bank account'
      };

      const result = checkPayoutGuardrails(payoutTx, 'payment_processing_fees', twoTierConfig, 'development');

      expect(result.allowed).toBe(false);
      expect(result.suggestedCategorySlug).toBe('payouts_clearing');
    });

    test('routes payouts to shopify_payouts_clearing in legacy taxonomy', () => {
      const payoutTx = {
        ...mockTransaction,
        merchantName: 'Shopify',
        description: 'Payout to bank'
      };

      const result = checkPayoutGuardrails(payoutTx, 'payment_processing_fees', legacyConfig, 'development');

      expect(result.allowed).toBe(false);
      expect(result.suggestedCategorySlug).toBe('shopify_payouts_clearing');
    });
  });

  describe('Integration with guardrails', () => {
    test('applies multiple guardrails and returns correct category', () => {
      const complexTx = {
        ...mockTransaction,
        merchantName: 'Stripe',
        description: 'Payout transfer - refund processing',
        amountCents: '500'
      };

      const result = applyEcommerceGuardrails(complexTx, 'shipping_income', 0.9, twoTierConfig, 'development');

      expect(result.categorySlug).toBe('payouts_clearing');
      expect(result.guardrailsApplied).toContain('payout_redirect');
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('Taxonomy structure validation', () => {
    test('two-tier taxonomy has correct structure', () => {
      const revenueCategories = TWO_TIER_TAXONOMY.filter(c => c.type === 'revenue' && c.parentId !== null);
      const cogsCategories = TWO_TIER_TAXONOMY.filter(c => c.type === 'cogs' && c.parentId !== null);
      const opexCategories = TWO_TIER_TAXONOMY.filter(c => c.type === 'opex' && c.parentId !== null);

      // Revenue should have exactly 2 tier-2 categories
      expect(revenueCategories).toHaveLength(2);
      expect(revenueCategories.map(c => c.slug)).toEqual(['shipping_income', 'refunds_contra']);

      // COGS should have exactly 4 tier-2 categories
      expect(cogsCategories).toHaveLength(4);
      expect(cogsCategories.map(c => c.slug)).toEqual(['supplier_purchases', 'packaging', 'shipping_postage', 'returns_processing']);

      // OpEx should have exactly 7 tier-2 categories
      expect(opexCategories).toHaveLength(7);
      const opexSlugs = opexCategories.map(c => c.slug);
      expect(opexSlugs).toContain('marketing_ads');
      expect(opexSlugs).toContain('software_subscriptions');
      expect(opexSlugs).toContain('payment_processing_fees');
      expect(opexSlugs).toContain('operations_logistics');
      expect(opexSlugs).toContain('general_administrative');
      expect(opexSlugs).toContain('miscellaneous');
      expect(opexSlugs).toContain('labor');
    });
  });
});