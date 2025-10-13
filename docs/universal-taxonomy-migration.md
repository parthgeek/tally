# Universal Taxonomy Migration Guide

**Status:** Production Ready  
**Version:** 1.0  
**Date:** October 2025

## Overview

The Nexus categorization system has been redesigned from a vendor-specific, e-commerce-only taxonomy to a universal, multi-vertical system that follows bookkeeping best practices. This guide explains what changed, why, and how to work with the new system.

---

## What Changed

### Category Count: 38 → 30

**Old System (E-commerce Specific):**
- 38 categories heavily focused on DTC e-commerce
- Separate categories for each payment processor (Stripe Fees, PayPal Fees, etc.)
- Separate categories for each shipping carrier (UPS Shipping, FedEx Shipping, etc.)
- Separate categories for each platform (Shopify Fees, Amazon Fees, etc.)

**New System (Universal):**
- 30 universal categories aligned with standard chart of accounts
- Consolidation of vendor-specific categories into universal categories + attributes
- Multi-industry support (e-commerce, SaaS, professional services, and beyond)

### Category Breakdown

**Parent Categories (5):**
1. Revenue
2. Cost of Goods Sold (COGS)
3. Operating Expenses
4. Taxes
5. Non-Operating

**Operational Categories (25):**

| Type | Categories | Count |
|------|-----------|-------|
| **Revenue** | Product Sales, Service Revenue, Shipping & Handling Income, Refunds & Returns, Discounts & Promotions | 5 |
| **COGS** | Materials & Inventory, Direct Labor, Packaging & Supplies, Freight & Inbound Shipping | 4 |
| **OpEx** | Marketing & Advertising, Software & SaaS Tools, Payment Processing Fees, Payroll & Benefits, Professional Services, Office & Supplies, Travel & Meals, Rent & Facilities, Utilities & Internet, Insurance, Bank Fees, Depreciation & Amortization, Interest Expense, Miscellaneous | 14 |
| **Non-P&L** | Sales Tax Collected, Payouts & Transfers | 2 |

---

## Why This Change?

### 1. Alignment with Bookkeeping Standards

The old system had categories like "Stripe Fees" and "PayPal Fees" which don't exist in standard accounting:
- **Old:** 5 separate payment processor categories
- **New:** 1 "Payment Processing Fees" category with `processor` attribute

This makes reports, tax filing, and accounting software integration much cleaner.

### 2. Multi-Vertical Scalability

The old system was tightly coupled to e-commerce:
- Hard-coded Shopify/Amazon/fulfillment logic
- No support for SaaS, professional services, or other industries
- Would require complete redesign for each new vertical

The new system is industry-agnostic:
- Core categories work across all business types
- Industry-specific details captured as attributes
- Easy to add new industries without changing categories

### 3. Reduced LLM Complexity

More categories = harder for LLM to learn:
- **Old:** 38 categories for LLM to distinguish between
- **New:** 30 categories with clearer boundaries
- Result: Better accuracy and confidence calibration

### 4. Maintainability

Vendor-specific categories created maintenance burden:
- Every new payment processor = new category
- Every new shipping carrier = new category
- Taxonomy constantly growing

Attribute-based system is maintainable:
- Add new processor without code changes
- LLM naturally extracts vendor names
- Taxonomy stays stable

---

## Breaking Changes

### Category IDs Changed

⚠️ **Important:** All category IDs changed in the migration. Old category IDs will not match new ones.

**Impact:**
- Historical transactions keep old category IDs (safe)
- New transactions get new category IDs
- Reports spanning pre/post migration need mapping

**Mitigation:**
- Run recategorization job for historical transactions if needed
- Use category slugs (not IDs) in application logic where possible

### New Database Schema

**Added to `categories` table:**
- `slug` - Human-readable identifier (e.g., "payment-processing")
- `industries` - Array of supported industries (e.g., ["ecommerce", "saas", "all"])
- `is_universal` - Boolean flag for universal categories
- `tier` - Category hierarchy level (1=parent, 2=operational)
- `type` - Category type (revenue, cogs, opex, tax, non_operating)
- `attribute_schema` - JSONB schema defining expected attributes
- `display_order` - Sort order for UI display
- `is_pnl` - Boolean for P&L vs non-P&L categories

**Added to `transactions` table:**
- `attributes` - JSONB field for transaction metadata

### New Database Functions

**`get_attribute(jsonb, text)`**
- Safely extract attributes from transactions
- Returns NULL for missing attributes

**`validate_attributes_against_schema(jsonb, jsonb)`**
- Validates transaction attributes against category schema
- Returns boolean

**View: `transactions_with_attributes`**
- Flattens common attributes for easier querying
- Includes processor, platform, carrier, tool_name, service_type

---

## Attribute System

### What Are Attributes?

Attributes are transaction metadata that provide vendor/platform/processor detail without cluttering the chart of accounts.

**Example - Payment Processing:**

```json
{
  "category": "Payment Processing Fees",
  "categoryId": "550e8400-e29b-41d4-a716-446655440301",
  "attributes": {
    "processor": "stripe",
    "transaction_type": "payment"
  }
}
```

### Common Attributes

| Category | Attributes | Example Values |
|----------|-----------|---------------|
| Payment Processing | `processor`, `transaction_type` | stripe, paypal, square; payment, refund |
| Marketing & Ads | `platform`, `campaign_type` | facebook, google, tiktok; social, search, video |
| Shipping Expense | `carrier`, `service_type` | ups, fedex, usps; ground, express, overnight |
| Platform Fees | `platform`, `fee_type` | shopify, amazon, etsy; subscription, transaction |
| Software & SaaS | `tool_name`, `category` | zapier, aws, github; automation, hosting, development |

### Querying Attributes

**Direct JSONB query:**
```sql
SELECT *
FROM transactions
WHERE attributes->>'processor' = 'stripe';
```

**Using helper function:**
```sql
SELECT *
FROM transactions
WHERE get_attribute(attributes, 'processor') = 'stripe';
```

**Using flattened view:**
```sql
SELECT *
FROM transactions_with_attributes
WHERE processor = 'stripe';
```

---

## Migration Examples

### Old → New Mappings

**Payment Processors:**
```
Stripe Fees → Payment Processing Fees {processor: "stripe"}
PayPal Fees → Payment Processing Fees {processor: "paypal"}
Square Fees → Payment Processing Fees {processor: "square"}
Shop Pay Fees → Payment Processing Fees {processor: "shop_pay"}
Affirm/Afterpay/Klarna → Payment Processing Fees {processor: "bnpl"}
```

**Shipping:**
```
UPS Shipping → Freight & Shipping {carrier: "ups", type: "outbound"}
FedEx Shipping → Freight & Shipping {carrier: "fedex", type: "outbound"}
USPS Shipping → Freight & Shipping {carrier: "usps", type: "outbound"}
```

**Platform Fees:**
```
Shopify Subscription → Platform & Marketplace Fees {platform: "shopify", fee_type: "subscription"}
Amazon Fees → Platform & Marketplace Fees {platform: "amazon", fee_type: "transaction"}
Etsy Fees → Platform & Marketplace Fees {platform: "etsy", fee_type: "transaction"}
```

**Advertising:**
```
Facebook Ads → Marketing & Advertising {platform: "facebook", campaign_type: "social"}
Google Ads → Marketing & Advertising {platform: "google", campaign_type: "search"}
TikTok Ads → Marketing & Advertising {platform: "tiktok", campaign_type: "video"}
```

---

## Using the New System

### Categorizing Transactions

**Node/TypeScript:**
```typescript
import { categorizeWithUniversalLLM } from '@nexus/categorizer';
import { GeminiClient } from '@nexus/categorizer';

const geminiClient = new GeminiClient({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-2.5-flash-lite',
  temperature: 1.0,
});

const result = await categorizeWithUniversalLLM(
  transaction,
  {
    industry: 'ecommerce', // or 'saas', 'services'
    orgId: org.id,
    config: {
      model: 'gemini-2.5-flash-lite',
      temperature: 1.0,
    },
  },
  geminiClient
);

console.log(result.categoryId);       // "550e8400-e29b-41d4-a716-446655440301"
console.log(result.confidence);       // 0.95
console.log(result.attributes);       // {processor: "stripe", transaction_type: "payment"}
```

### Filtering by Attributes

**Get all Stripe transactions:**
```typescript
const stripeTransactions = await supabase
  .from('transactions')
  .select('*')
  .eq('attributes->>processor', 'stripe');
```

**Get all Facebook ad spend:**
```typescript
const facebookAds = await supabase
  .from('transactions')
  .select('*')
  .eq('category_id', MARKETING_CATEGORY_ID)
  .eq('attributes->>platform', 'facebook');
```

### Reporting by Attributes

**Payment processor breakdown:**
```sql
SELECT 
  attributes->>'processor' as processor,
  COUNT(*) as transaction_count,
  SUM(amount_cents) / 100 as total_amount
FROM transactions
WHERE category_id = '550e8400-e29b-41d4-a716-446655440301' -- Payment Processing
GROUP BY attributes->>'processor'
ORDER BY total_amount DESC;
```

---

## Recategorization

If you need to recategorize historical transactions:

**Via Edge Function:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/recategorize-historical \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-id-here",
    "daysBack": 180,
    "batchSize": 50
  }'
```

**Via SQL (bulk update):**
```sql
-- This would need to be customized based on your mapping needs
UPDATE transactions
SET 
  category_id = '550e8400-e29b-41d4-a716-446655440301',
  attributes = jsonb_build_object('processor', 'stripe')
WHERE 
  category_id = 'old-stripe-category-id'
  AND date > '2025-01-01';
```

---

## FAQ

**Q: Will my old transactions still work?**  
A: Yes, old transactions keep their original category IDs. The old categories are deactivated (`is_active = false`) but data remains intact.

**Q: Do I need to recategorize everything?**  
A: Not required. New transactions use the new system automatically. Recategorize historical data only if you need consistent reporting.

**Q: What if I need a category that doesn't exist?**  
A: Check if it can be represented as an attribute first. If it's truly a new bookkeeping category needed across multiple businesses, we can add it.

**Q: Can I query by processor/platform/carrier?**  
A: Yes! Use the `transactions_with_attributes` view or query the `attributes` JSONB field directly.

**Q: Will this work for my SaaS/services business?**  
A: Yes! The universal taxonomy was designed to support multiple industries. Set `industry: 'saas'` or `industry: 'services'` when categorizing.

**Q: What about industry-specific categories?**  
A: Some categories are industry-specific (e.g., "Fulfillment & Warehousing" for e-commerce). The LLM only sees categories relevant to your industry.

---

## Support

**Issues or Questions:**  
- Check `docs/categorizer-lab-debugging-guide.md` for troubleshooting
- Review `docs/categorizer-improvements-summary.md` for technical details
- Open an issue in the repo for bugs or feature requests

**Performance Monitoring:**  
- Category distribution tracked via PostHog events
- Attribute extraction metrics available in analytics dashboard
- Confidence scores logged for all categorizations

---

## Technical Reference

**Database Migrations:**
- `038_universal_taxonomy_schema.sql` - Schema changes
- `039_attribute_validation.sql` - Validation functions and views
- `040_seed_universal_categories.sql` - Universal category seed data

**Source Files:**
- `packages/categorizer/src/taxonomy.ts` - Universal taxonomy definitions
- `packages/categorizer/src/prompt.ts` - Industry-aware prompt builder
- `packages/categorizer/src/pass2_llm.ts` - Universal LLM categorization
- `packages/categorizer/src/rules/vendors.ts` - Universal vendor patterns

**Test Files:**
- `bench/test-labeled-dataset.ts` - 100 transaction accuracy test
- `bench/validate-attributes.ts` - Attribute extraction validation
- `bench/test-error-handling.ts` - Error resilience tests

