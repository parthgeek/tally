import { describe, test, expect } from 'vitest';
import {
  checkRevenueGuardrails,
  checkSalesTaxGuardrails,
  checkPayoutGuardrails,
  applyEcommerceGuardrails,
  getCategoryIdWithGuardrails
} from './guardrails.js';

const createMockTransaction = (overrides: any = {}) => ({
  id: 'tx-123',
  orgId: 'org-456',
  date: '2024-01-15',
  amountCents: '2500',
  currency: 'USD',
  description: 'Test transaction',
  merchantName: 'Test Merchant',
  mcc: undefined,
  categoryId: undefined,
  confidence: undefined,
  reviewed: false,
  needsReview: false,
  source: 'plaid' as const,
  raw: {},
  ...overrides
});

describe('guardrails', () => {
  describe('checkRevenueGuardrails', () => {
    test('allows non-revenue categories without restriction when strict directionality disabled', () => {
      const tx = createMockTransaction();
      const result = checkRevenueGuardrails(tx, 'stripe_fees', {}, 'production');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('blocks positive amounts mapping to OpEx when strict directionality enabled', () => {
      const tx = createMockTransaction({
        description: 'GENERIC PAYMENT',
        amountCents: '5000' // Positive
      });
      const config = { categorizer_strict_revenue_directionality: true };
      const result = checkRevenueGuardrails(tx, 'software_subscriptions', config, 'development');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Positive amount (MONEY IN) cannot map to OpEx/COGS');
      expect(result.suggestedCategorySlug).toBe('miscellaneous');
      expect(result.confidencePenalty).toBe(0.6);
    });

    test('blocks positive amounts mapping to COGS when strict directionality enabled', () => {
      const tx = createMockTransaction({
        description: 'SUPPLIER PAYMENT',
        amountCents: '10000' // Positive
      });
      const config = { categorizer_strict_revenue_directionality: true };
      const result = checkRevenueGuardrails(tx, 'materials_supplies', config, 'development');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Positive amount (MONEY IN) cannot map to OpEx/COGS');
    });

    test('redirects positive amounts with refund keywords to refunds_contra', () => {
      const tx = createMockTransaction({
        description: 'REFUND FROM SUPPLIER',
        amountCents: '2500' // Positive
      });
      const config = { categorizer_strict_revenue_directionality: true };
      const result = checkRevenueGuardrails(tx, 'materials_supplies', config, 'development');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Refund pattern detected');
      expect(result.suggestedCategorySlug).toBe('refunds_contra');
      expect(result.confidencePenalty).toBe(0.4);
    });

    test('allows negative amounts to OpEx/COGS categories', () => {
      const tx = createMockTransaction({
        description: 'OFFICE SUPPLIES',
        amountCents: '-5000' // Negative (expense)
      });
      const config = { categorizer_strict_revenue_directionality: true };
      const result = checkRevenueGuardrails(tx, 'office_supplies', config, 'development');

      expect(result.allowed).toBe(true);
    });

    test('allows normal revenue transactions', () => {
      const tx = createMockTransaction({
        description: 'Customer purchase',
        amountCents: '5000'
      });
      const result = checkRevenueGuardrails(tx, 'dtc_sales');

      expect(result.allowed).toBe(true);
    });

    test('blocks refunds from mapping to positive revenue', () => {
      const tx = createMockTransaction({
        description: 'REFUND FOR ORDER #12345',
        amountCents: '-2500'
      });
      const result = checkRevenueGuardrails(tx, 'dtc_sales');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Refund/return cannot map to positive revenue');
      expect(result.suggestedCategorySlug).toBe('refunds_allowances_contra');
      expect(result.confidencePenalty).toBe(0.4);
    });

    test('blocks returns from mapping to positive revenue', () => {
      const tx = createMockTransaction({
        description: 'RETURN PROCESSING FEE'
      });
      const result = checkRevenueGuardrails(tx, 'dtc_sales');

      expect(result.allowed).toBe(false);
      expect(result.suggestedCategorySlug).toBe('refunds_allowances_contra');
    });

    test('allows refunds to map to contra-revenue accounts', () => {
      const tx = createMockTransaction({
        description: 'REFUND FOR ORDER #12345',
        amountCents: '-2500'
      });
      const result = checkRevenueGuardrails(tx, 'refunds_allowances_contra');

      expect(result.allowed).toBe(true);
    });

    test('blocks payment processors from mapping to revenue', () => {
      const tx = createMockTransaction({
        merchantName: 'Stripe Inc',
        description: 'Payment processing'
      });
      const result = checkRevenueGuardrails(tx, 'dtc_sales');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Payment processor cannot map to revenue');
      expect(result.suggestedCategorySlug).toBe('payment_processing_fees');
      expect(result.confidencePenalty).toBe(0.3);
    });

    test('detects various payment processors', () => {
      const processors = ['stripe', 'paypal', 'square', 'shopify payments', 'afterpay', 'affirm'];

      for (const processor of processors) {
        const tx = createMockTransaction({ merchantName: processor });
        const result = checkRevenueGuardrails(tx, 'dtc_sales');

        expect(result.allowed).toBe(false);
        expect(result.suggestedCategorySlug).toBe('payment_processing_fees');
      }
    });
  });

  describe('checkSalesTaxGuardrails', () => {
    test('allows normal transactions without tax keywords', () => {
      const tx = createMockTransaction();
      const result = checkSalesTaxGuardrails(tx, 'other_ops');

      expect(result.allowed).toBe(true);
    });

    test('redirects sales tax payments to liability account', () => {
      const tx = createMockTransaction({
        description: 'SALES TAX PAYMENT - Q4 2023',
        merchantName: 'State of California'
      });
      const result = checkSalesTaxGuardrails(tx, 'other_ops');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Sales tax payment should map to liability account');
      expect(result.suggestedCategorySlug).toBe('sales_tax_payable');
      expect(result.confidencePenalty).toBe(0.2);
    });

    test('detects tax authority merchants', () => {
      const authorities = [
        'State of Texas',
        'City of New York',
        'County of Los Angeles',
        'Department of Revenue',
        'Tax Collector Office'
      ];

      for (const authority of authorities) {
        const tx = createMockTransaction({ merchantName: authority });
        const result = checkSalesTaxGuardrails(tx, 'other_ops');

        expect(result.allowed).toBe(false);
        expect(result.suggestedCategorySlug).toBe('sales_tax_payable');
      }
    });

    test('allows sales tax transactions already mapped to liability', () => {
      const tx = createMockTransaction({
        description: 'SALES TAX PAYMENT',
        merchantName: 'State of California'
      });
      const result = checkSalesTaxGuardrails(tx, 'sales_tax_payable');

      expect(result.allowed).toBe(true);
    });
  });

  describe('checkPayoutGuardrails', () => {
    test('allows normal transactions without payout keywords', () => {
      const tx = createMockTransaction();
      const result = checkPayoutGuardrails(tx, 'other_ops');

      expect(result.allowed).toBe(true);
    });

    test('redirects payment processor payouts to clearing account', () => {
      const tx = createMockTransaction({
        merchantName: 'Shopify',
        description: 'SHOPIFY PAYOUT - WEEK OF 01/15'
      });
      const result = checkPayoutGuardrails(tx, 'dtc_sales');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Payment processor payouts should map to clearing account');
      expect(result.suggestedCategorySlug).toBe('shopify_payouts_clearing');
      expect(result.confidencePenalty).toBe(0.1);
    });

    test('detects various payout patterns', () => {
      const patterns = [
        { merchantName: 'Shopify', description: 'payout for sales' },
        { merchantName: 'Shopify Payments', description: 'weekly transfer' },
        { merchantName: 'SHOPIFY INC', description: 'deposit from sales' },
        { merchantName: 'Shopify', description: 'settlement payment' }
      ];

      for (const pattern of patterns) {
        const tx = createMockTransaction(pattern);
        const result = checkPayoutGuardrails(tx, 'other_ops');

        expect(result.allowed).toBe(false);
        expect(result.suggestedCategorySlug).toBe('shopify_payouts_clearing');
      }
    });

    test('allows payouts already mapped to clearing', () => {
      const tx = createMockTransaction({
        merchantName: 'Shopify',
        description: 'SHOPIFY PAYOUT'
      });
      const result = checkPayoutGuardrails(tx, 'shopify_payouts_clearing');

      expect(result.allowed).toBe(true);
    });

    test('detects extended payout keywords when enhanced mode enabled', () => {
      const config = { categorizer_enhanced_payout_guardrails: true };
      const patterns = [
        { description: 'MERCHANT DISBURSEMENT', merchantName: 'Stripe' },
        { description: 'BATCH PAYOUT 2024-01-15', merchantName: 'PayPal' },
        { description: 'NET PROCEEDS TRANSFER', merchantName: 'Square' },
        { description: 'FUNDS TRANSFER TO BANK', merchantName: 'Shopify' }
      ];

      for (const pattern of patterns) {
        const tx = createMockTransaction(pattern);
        const result = checkPayoutGuardrails(tx, 'product_sales', config, 'development');

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Payment processor payouts should map to clearing account');
        expect(result.suggestedCategorySlug).toBe('payouts_clearing');
      }
    });

    test('detects expanded payment processors when enhanced mode enabled', () => {
      const config = { categorizer_enhanced_payout_guardrails: true };
      const processors = ['Adyen', 'Braintree', 'Klarna', 'Affirm', 'Afterpay', 'Sezzle', 'Venmo'];

      for (const processor of processors) {
        const tx = createMockTransaction({
          merchantName: processor,
          description: 'PAYOUT FROM SALES'
        });
        const result = checkPayoutGuardrails(tx, 'product_sales', config, 'development');

        expect(result.allowed).toBe(false);
        expect(result.suggestedCategorySlug).toBe('payouts_clearing');
      }
    });

    test('uses basic keywords when enhanced mode disabled', () => {
      const config = { categorizer_enhanced_payout_guardrails: false };
      const tx = createMockTransaction({
        merchantName: 'Stripe',
        description: 'MERCHANT DISBURSEMENT' // Extended keyword
      });
      const result = checkPayoutGuardrails(tx, 'product_sales', config, 'production');

      // Should not match with enhanced disabled
      expect(result.allowed).toBe(true);
    });
  });

  describe('applyEcommerceGuardrails', () => {
    test('applies no changes for valid categorizations', () => {
      const tx = createMockTransaction({
        merchantName: 'Regular Customer',
        description: 'Product purchase'
      });
      const result = applyEcommerceGuardrails(tx, 'dtc_sales', 0.9);

      expect(result.categorySlug).toBe('dtc_sales');
      expect(result.confidence).toBe(0.9);
      expect(result.guardrailsApplied).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
    });

    test('applies multiple guardrails in sequence', () => {
      const tx = createMockTransaction({
        merchantName: 'Stripe',
        description: 'REFUND PROCESSING'
      });
      const result = applyEcommerceGuardrails(tx, 'dtc_sales', 0.9);

      expect(result.categorySlug).not.toBe('dtc_sales');
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.guardrailsApplied.length).toBeGreaterThan(0);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('compounds confidence penalties correctly', () => {
      const tx = createMockTransaction({
        merchantName: 'Stripe',
        description: 'REFUND for failed payment'
      });
      const result = applyEcommerceGuardrails(tx, 'dtc_sales', 1.0);

      // Should have penalties from both payment processor and refund guardrails
      expect(result.confidence).toBeLessThan(0.7); // 1.0 - 0.4 - 0.3 = 0.3, but max is applied
    });

    test('prevents confidence from going below zero', () => {
      const tx = createMockTransaction({
        merchantName: 'Stripe',
        description: 'REFUND CHARGEBACK REVERSAL'
      });
      const result = applyEcommerceGuardrails(tx, 'dtc_sales', 0.1);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCategoryIdWithGuardrails', () => {
    test('returns category ID with guardrails applied', () => {
      const tx = createMockTransaction({
        merchantName: 'Stripe',
        description: 'Payment processing fee'
      });
      const result = getCategoryIdWithGuardrails(tx, 'dtc_sales', 0.9);

      expect(result.categoryId).toBeDefined();
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.guardrailsApplied).toContain('revenue_block');
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('maps to correct category IDs', () => {
      const tx = createMockTransaction();
      const result = getCategoryIdWithGuardrails(tx, 'stripe_fees', 0.9);

      expect(result.categoryId).toBe('550e8400-e29b-41d4-a716-446655440311');
    });
  });
});