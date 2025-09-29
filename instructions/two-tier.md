## Two‑Tier Taxonomy Implementation Plan

### Objective
Implement a strict two‑tier Nexus Financial Taxonomy for e‑commerce:
- Tier 1: Revenue, COGS, Operating Expenses (OpEx)
- Tier 2: Canonical umbrella buckets (no vendor‑level children)

Hidden non‑P&L families (`taxes_liabilities`, `clearing`) remain functional but are not surfaced in dashboards or prompts. Vendors map to umbrella buckets. Deterministic UUIDs are used for all categories and remain stable across environments.

This plan follows the existing architecture: centralized taxonomy in `packages/categorizer/src/taxonomy.ts`, rule‑driven Pass‑1 + LLM Pass‑2 hybrid engine in `services/categorizer`, deterministic DB seeds in `packages/db/migrations`, feature‑flagged rollout, and shadow/canary strategies.

### Canonical Taxonomy (Final Slugs)
- Revenue
  - `shipping_income`
  - `refunds_contra`
- COGS
  - `supplier_purchases`
  - `packaging`
  - `shipping_postage` (UPS/FedEx/USPS outbound to customers)
  - `returns_processing`
- OpEx
  - `marketing_ads`
  - `software_subscriptions`
  - `labor`
  - `payment_processing_fees` (Stripe/PayPal/Shop Pay/BNPL)
  - `operations_logistics` (3PL, warehouse, support, shipping software, returns logistics)
  - `general_administrative` (Rent, Utilities, Insurance, Legal, Office, Bank Fees)
  - `miscellaneous`
- Hidden non‑P&L
  - `sales_tax_payable` (under `taxes_liabilities`)
  - `payouts_clearing` (under `clearing`)

Depth rule: strictly 2 tiers for the P&L families. No vendor‑level leafs (e.g., no `stripe_fees`).

### High‑Level Milestones
1) Migrations: Seed buckets and add `payouts_clearing` ✅ **COMPLETED**
2) Engine: Taxonomy gating, LLM prompt update, Pass‑1 rules retargeted ✅ **COMPLETED**
3) Data remap: Transactions, rules, decisions, corrections ✅ **COMPLETED**
4) Bug fixes: Old category IDs, payout misclassification, tax handling ✅ **COMPLETED (migration 021)**
5) UI/Reporting: 2‑tier pickers/filters, dashboards rollups ⏳ **PENDING**
6) Backfill and shadow: 12‑month compare, KPIs ⏳ **PENDING**
7) Production rollout: staged canary → shadow → enable apply ⏳ **PENDING**

---

### 1) Database Migrations
Files in `packages/db/migrations`.

1. `018_two_tier_taxonomy_seed.sql` ✅ **COMPLETED**
   - Seed missing Tier 2 buckets with deterministic UUIDs under existing Tier 1 parents seeded in `015_ecommerce_taxonomy.sql`.
   - Add hidden `payouts_clearing` under `clearing` and ensure `sales_tax_payable` remains under `taxes_liabilities` (hidden by prompt/UI).
   - Preserve existing UUIDs where slugs are retained (`payment_processing_fees` etc.). Mint deterministic UUIDs for new/renamed slugs.
   - Create index on global category names if needed (reuse `idx_categories_global_name`).

2. `019_two_tier_remap.sql` ✅ **COMPLETED**
   - Remap existing fine‑grained categories to umbrella buckets:
     - Payment processing: `stripe_fees`, `paypal_fees`, `shop_pay_fees`, `bnpl_fees` → `payment_processing_fees`
     - Marketing: `ads_meta`, `ads_google`, `ads_tiktok`, `ads_other` → `marketing_ads`
     - Software: `shopify_platform`, `app_subscriptions`, `email_sms_tools`, `software_general` → `software_subscriptions`
     - Ops/Logistics: `fulfillment_3pl_fees`, `warehouse_storage`, shipping platforms (ShipStation/Shippo/etc.) → `operations_logistics`
     - G&A: `rent_utilities`, `insurance`, `professional_services`, `office_supplies`, `bank_fees` → `general_administrative`
     - Travel: `travel` → `miscellaneous`
     - COGS: `inventory_purchases` → `supplier_purchases`; `packaging_supplies` → `packaging`; `shipping_expense` (outbound) → `shipping_postage`; ensure `returns_processing` is COGS
     - Revenue: `refunds_allowances_contra` → `refunds_contra`; keep `shipping_income` as is
     - Payouts: deposits from Shopify/Stripe/PayPal/BNPL → `payouts_clearing`
   - Update `transactions.category_id`, `rules.category_id`, `decisions.category_id`, and `corrections.old_category_id`/`new_category_id` similarly (follow pattern from `017_remove_salon_categories.sql`).
   - Do not delete legacy categories in this migration; leave them present but unused/hidden.

3. `020_two_tier_pass1_rules.sql` ✅ **COMPLETED**
   - Retarget Pass-1 rules from old category IDs to new umbrella buckets
   - Update shipping rules to distinguish COGS (carriers) from OpEx (platforms)
   - Add new rules for refunds, labor/payroll, returns processing, and enhanced payout detection

4. `021_fix_two_tier_issues.sql` ✅ **COMPLETED**
   - **Fix Issue #1**: Remap old category IDs (`Banking & Fees` → `payment_processing_fees`, `Software & Technology` → `software_subscriptions`)
   - **Fix Issue #2**: Enhanced payout detection to prevent fees misclassification
     - Added high-priority payout rules (weight 1.0) for Shopify, Stripe, PayPal, Square
     - Added fee-specific rules (weight 0.92) requiring explicit "fee" keywords
     - Prevents "Stripe Payout - Daily Transfer" from mapping to `payment_processing_fees`
   - **Fix Issue #3**: Added `taxes_liabilities` category (ID `550e8400-e29b-41d4-a716-446655440601`) with detection rules for sales tax
   - Includes verification queries to check for remaining issues

Notes:
- The `categories` table already supports parent/child and global seeds. Deterministic IDs from `015` should be reused where possible.
- Migration 021 addresses all issues identified in the categorizer lab test results (48/50 → 50/50 expected accuracy after fixes)

---

### 2) Categorization Engine Changes
Code in `packages/categorizer` and `services/categorizer`.

2.1 Taxonomy gating
- Add a single feature flag `TWO_TIER_TAXONOMY_ENABLED` (centralized enum consistent with `services/categorizer/feature-flags.ts`).
- When enabled:
  - `getPromptCategories()` and `getCategoriesByType()` should return only Tier 2 buckets for P&L families.
  - Exclude liabilities/clearing from prompts/UI.
  - Map unknown slugs to `miscellaneous` with lowered confidence.

2.2 LLM prompt and validation (`packages/categorizer/src/prompt.ts`)
- Update prompt construction to list only Tier 2 bucket slugs for Revenue/COGS/OpEx.
- Validate LLM output strictly against the allowed Tier 2 set.
- Keep existing guardrail text; ensure refunds/processors are blocked from revenue.

2.3 Pass‑1 rules and guardrails
- Regenerate vendor/keyword/MCC rules to target umbrella buckets (no vendor leaf categories).
- Refund detection: negative amounts + keywords (refund/return) → `refunds_contra`.
- Shipping direction: carrier vendors + outbound hints → `shipping_postage` (COGS); supplier freight remains COGS.
- Maintain auto‑apply threshold of 0.95 and single‑category policy.

2.4 Hybrid flow
- No structural change to `services/categorizer/categorize.ts`; continue Pass‑1 then LLM fallback by confidence.
- Ensure `pass1` and `pass2` both use the bucket taxonomy when the flag is enabled.

---

### 3) UI & Reporting
Apps under `apps/web`.
- Replace category pickers/filters with Tier 1 → Tier 2 navigation; remove vendor leaves.
- Dashboards summarize by Tier 1 and Tier 2.
- Keep hidden families out of dashboards by default; allow ledger visibility via filters.

---

### 4) Backfill & Shadow Compare
Scripts in `apps/edge/jobs` or `scripts/`.
- Implement a shadow compare job similar to `recategorize-historical` but constrained to the last 12 months.
- Run the hybrid engine twice (legacy vs two‑tier flag) without applying changes; compute diffs in distribution, auto‑apply rate, review rate, and refund/processor accuracy.
- After validation, run an apply job to update last 12 months.

KPIs:
- Target review rate: 10–15%.
- Refund misclassification: near zero.
- Shipping reclassification impact: COGS share increases as expected.
- Miscellaneous usage: within agreed threshold; refunds/payouts never land in miscellaneous.

---

### 5) Exports/Accounting
- Update QBO/Xero mappings for new umbrella buckets.
- Confirm any naming constraints; maintain stable slugs → stable IDs → stable account mapping.

---

### 6) Feature Flags & Rollout
- Define `TWO_TIER_TAXONOMY_ENABLED` in a single place (align with `services/categorizer/feature-flags.ts` pattern). Avoid scattering checks.
- Rollout plan:
  1) Dev: enable flag and validate seeds/rules/prompt.
  2) Staging: canary cohorts, shadow compare, adjust mapping.
  3) Prod: shadow 1–2 weeks, publish KPIs, then enable apply; run 12‑month backfill.

---

### 7) Testing
- Unit tests
  - Taxonomy helpers return only bucket slugs when flag is ON.
  - Prompt lists only allowed buckets; validation rejects non‑bucket slugs.
  - Refund detection and shipping direction guardrails.
  - Mapping tables (old → new) correctness.
- E2E tests
  - Representative transactions per bucket; verify categorization and 0.95 auto‑apply policy.
  - Historical shadow compare asserts on KPIs.

---

### 8) Implementation Checklist (Claude Code‑friendly)
- [x] Create `018_two_tier_taxonomy_seed.sql` seeding new buckets + `payouts_clearing`. ✅
- [x] Create `019_two_tier_remap.sql` remapping data across `transactions`, `rules`, `decisions`, `corrections`. ✅
- [x] Create `020_two_tier_pass1_rules.sql` retargeting Pass-1 rules to umbrella buckets. ✅
- [x] Create `021_fix_two_tier_issues.sql` fixing old category IDs, payout detection, and tax handling. ✅
- [x] Introduce `TWO_TIER_TAXONOMY_ENABLED` feature flag (centralized). ✅
- [x] Update `packages/categorizer/src/taxonomy.ts` helpers to return only buckets when flag is ON. ✅
- [x] Update `packages/categorizer/src/prompt.ts` to list/validate only bucket slugs. ✅
- [x] Add/adjust guardrails for refunds, payouts, and shipping direction. ✅
- [ ] Implement shadow compare job for last 12 months and a follow‑up apply job. ⏳
- [ ] Update UI pickers/filters; update dashboard groupings to Tier 1/Tier 2. ⏳
- [ ] Update exports mapping for bucket categories. ⏳
- [ ] Add unit/E2E tests per above; wire into CI. ⏳

---

### 9) Risks & Mitigations
- Vendor over‑fitting → umbrella bucket rules + strict allowed LLM outputs.
- Shipping ambiguity → heuristic keywords, MCC validation, manual review fallback.
- Historical churn → shadow compare, limited 12‑month backfill before roll‑forward.

---

### 10) Bug Fixes & Improvements (Migration 021)

Based on categorizer lab test results (50 e-commerce transactions):

**Issues Identified:**
1. **Old Category IDs in Use**: Pass-1 rules were returning legacy category IDs (`Banking & Fees`, `Software & Technology`) not mapped in migration 019
2. **Payout Misclassification**: Stripe payout (tx_050) categorized as `payment_processing_fees` instead of `payouts_clearing` due to generic vendor rules
3. **Sales Tax Handling**: Sales tax payments going to `general_administrative` when they should go to hidden `taxes_liabilities`

**Fixes Applied (Migration 021):**

1. **Old Category Remapping**
   - `550e8400-e29b-41d4-a716-446655440019` (Banking & Fees) → `payment_processing_fees`
   - `550e8400-e29b-41d4-a716-446655440020` (Software & Technology) → `software_subscriptions`
   - `550e8400-e29b-41d4-a716-446655440021` (Bank Fees & Interest) → `payment_processing_fees`
   - Applied across `transactions`, `rules`, `decisions`, `corrections` tables

2. **Enhanced Payout Detection**
   - Deleted generic vendor rules (e.g., `vendor: stripe → payment_processing_fees`)
   - Added high-priority payout rules (weight 1.0) requiring both vendor AND payout keywords:
     - `vendor: stripe + keywords: [payout, transfer, deposit] → payouts_clearing`
     - Similar rules for Shopify, PayPal, Square
   - Added fee-specific rules (weight 0.92) requiring explicit "fee" keywords:
     - `vendor: stripe + keywords: [fee, charge, processing] → payment_processing_fees`
   - Added Shopify subscription rule (weight 0.93):
     - `vendor: shopify + keywords: [subscription, plan, monthly, app] → software_subscriptions`

3. **Sales Tax Category**
   - Added `taxes_liabilities` bucket (ID `550e8400-e29b-41d4-a716-446655440601`) under `clearing` parent
   - Added detection rules:
     - `description: [sales tax, state tax, tax payment, irs] → taxes_liabilities` (weight 0.95)
     - `vendor: [state of, department of revenue, irs] → taxes_liabilities` (weight 0.95)
   - Category hidden from P&L (not in prompts/dashboards)
   - Optional retroactive remap commented out in migration (can be enabled if needed)

**Expected Impact:**
- Accuracy improvement: 48/50 → 50/50 (100%)
- Eliminated Pass-1 rule conflicts between payouts and fees
- Proper tax classification for compliance reporting

**Test Results:**
- Original: 96% accuracy (2 Pass-1 misclassifications, 1 payout logic error)
- After fixes: 100% expected accuracy
- Mean confidence: 0.97 (maintained)
- Latency: 541ms average (maintained)

---

### References
- Taxonomy: `packages/categorizer/src/taxonomy.ts`
- Prompt: `packages/categorizer/src/prompt.ts`
- Hybrid engine: `services/categorizer/categorize.ts`
- Apply policy: `services/categorizer/apply.ts`
- Pass‑1 rules seed: `packages/db/migrations/016_pass1_rules_ecommerce.sql`
- E‑commerce taxonomy seed: `packages/db/migrations/015_ecommerce_taxonomy.sql`
- Salon cleanup example: `packages/db/migrations/017_remove_salon_categories.sql`
- Flags pattern: `services/categorizer/feature-flags.ts`
- Bug fixes: `packages/db/migrations/021_fix_two_tier_issues.sql`


