# Two-Tier Taxonomy Implementation

## Overview

This document provides a comprehensive overview of the two-tier taxonomy implementation for Nexus e-commerce transaction categorization. The implementation follows the plan outlined in `instructions/two-tier.md` and provides a simplified, more manageable categorization structure compared to the previous fine-grained approach.

## What Was Implemented

### 1. Database Migrations

#### Migration 018: Two-Tier Taxonomy Seed
**File**: `packages/db/migrations/018_two_tier_taxonomy_seed.sql`

- **Purpose**: Seeds new Tier 2 umbrella bucket categories with deterministic UUIDs
- **Key Changes**:
  - Added new umbrella buckets for Revenue, COGS, and OpEx
  - Added `payouts_clearing` for universal payout handling
  - Updated existing category names to match two-tier structure
  - Moved `returns_processing` from OpEx to COGS

#### Migration 019: Two-Tier Remap
**File**: `packages/db/migrations/019_two_tier_remap.sql`

- **Purpose**: Remaps existing transactions, rules, decisions, and corrections to use umbrella buckets
- **Key Changes**:
  - Payment processing: All processor fees → `payment_processing_fees`
  - Marketing: All ad platforms → `marketing_ads`
  - Software: All platforms/tools → `software_subscriptions`
  - Operations: 3PL/fulfillment → `operations_logistics`
  - General business: Rent, utilities, insurance → `general_administrative`
  - Miscellaneous: Travel and other → `miscellaneous`
  - COGS: Updated to new umbrella buckets
  - Revenue: Updated refund handling

#### Migration 020: Pass-1 Rules Update
**File**: `packages/db/migrations/020_two_tier_pass1_rules.sql`

- **Purpose**: Updates Pass-1 rules to target umbrella buckets instead of fine-grained categories
- **Key Changes**:
  - Consolidated vendor/keyword rules to point to umbrella buckets
  - Added enhanced refund detection rules
  - Added labor/payroll rules
  - Added universal payout detection for multiple processors
  - Improved shipping direction logic

### 2. Feature Flag Implementation

#### Centralized Feature Flag
**File**: `services/categorizer/feature-flags.ts`

- **Added**: `TWO_TIER_TAXONOMY_ENABLED` feature flag
- **Environment Configuration**:
  - Development: `true` (enabled for testing)
  - Staging: `true` (enabled for validation)
  - Production: `false` (start disabled for safety)

### 3. Taxonomy Engine Updates

#### Enhanced Taxonomy Module
**File**: `packages/categorizer/src/taxonomy.ts`

- **Added**: `TWO_TIER_TAXONOMY` constant with umbrella bucket definitions
- **Updated**: All helper functions to support feature flag-based taxonomy selection
- **Key Functions**:
  - `getActiveTaxonomy()`: Returns appropriate taxonomy based on feature flag
  - `getCategoryBySlug()`: Feature flag-aware category lookup
  - `mapCategorySlugToId()`: Intelligent fallback handling (miscellaneous vs other_ops)

#### Updated Prompt Construction
**File**: `packages/categorizer/src/prompt.ts`

- **Enhanced**: `buildCategorizationPrompt()` with two-tier specific rules
- **Key Changes**:
  - Different category suggestions based on taxonomy version
  - Two-tier specific guardrails in prompt text
  - Enhanced shipping direction guidance
  - Stricter miscellaneous usage rules

### 4. Enhanced Guardrails System

#### Updated Guardrails Module
**File**: `packages/categorizer/src/guardrails.ts`

- **Added**: `checkShippingDirectionGuardrails()` for two-tier taxonomy
- **Updated**: `checkRevenueGuardrails()` with dynamic refund category handling
- **Enhanced**: `checkPayoutGuardrails()` (renamed from `checkShopifyPayoutGuardrails()`) for universal payout handling
- **Key Improvements**:
  - Shipping direction detection (outbound vs inbound vs platform)
  - Enhanced refund detection with proper category routing
  - Universal payout detection across all payment processors

### 5. Comprehensive Testing

#### Unit Test Suite
**File**: `packages/categorizer/src/two-tier-taxonomy.spec.ts`

- **Coverage**: 17 comprehensive test cases
- **Test Areas**:
  - Taxonomy selection based on feature flags
  - Category filtering and prompt generation
  - Fallback category handling
  - Refund guardrails with proper category routing
  - Shipping direction guardrails
  - Payout guardrails for multiple processors
  - Integration between taxonomy and guardrails
  - Taxonomy structure validation

## Architecture Overview

### Two-Tier Structure

**Tier 1: High-Level Categories**
- Revenue
- Cost of Goods Sold (COGS)
- Operating Expenses (OpEx)
- Taxes & Liabilities (hidden)
- Clearing (hidden)

**Tier 2: Umbrella Buckets**

#### Revenue (2 buckets)
- `shipping_income`: Customer shipping charges
- `refunds_contra`: All refunds and returns

#### COGS (4 buckets)
- `supplier_purchases`: Inventory and wholesale purchases
- `packaging`: Packaging materials and supplies
- `shipping_postage`: Outbound shipping to customers (UPS, FedEx, etc.)
- `returns_processing`: Return handling and restocking

#### OpEx (7 buckets)
- `marketing_ads`: All advertising spend (Meta, Google, TikTok, etc.)
- `software_subscriptions`: All software and platform costs
- `labor`: Payroll, contractors, and labor costs
- `payment_processing_fees`: All payment processor fees
- `operations_logistics`: 3PL, fulfillment, shipping software
- `general_administrative`: Rent, utilities, insurance, legal, office
- `miscellaneous`: Travel and other miscellaneous expenses

#### Hidden Categories
- `sales_tax_payable`: Sales tax liabilities
- `payouts_clearing`: Payment processor payouts and transfers

### Feature Flag-Driven Architecture

The implementation uses a feature flag-driven approach that allows:

1. **Gradual Rollout**: Enable for development/staging while keeping production on legacy
2. **A/B Testing**: Compare legacy vs two-tier performance
3. **Safe Migration**: Rollback capability if issues arise
4. **Environment-Specific**: Different behavior per environment

### Key Design Decisions

#### 1. Deterministic UUIDs
- All category IDs are deterministic across environments
- Enables consistent data migration and testing
- Follows existing pattern from `015_ecommerce_taxonomy.sql`

#### 2. Shipping Direction Intelligence
- **Outbound shipping** (to customers): COGS category `shipping_postage`
- **Inbound freight** (from suppliers): COGS category `supplier_purchases`
- **Shipping software/platforms**: OpEx category `operations_logistics`

#### 3. Enhanced Guardrails
- Prevents misclassification of refunds as positive revenue
- Routes payment processor fees correctly
- Handles shipping direction based on context
- Universal payout detection across all processors

#### 4. Intelligent Fallbacks
- Two-tier taxonomy: Unknown categories → `miscellaneous`
- Legacy taxonomy: Unknown categories → `other_ops`
- Refunds never go to miscellaneous (enforced by guardrails)

## Integration Points

### 1. Database Layer
- All existing data gets remapped via migrations
- New transactions use umbrella buckets when flag enabled
- Legacy data remains accessible for comparison

### 2. Categorization Engine
- `packages/categorizer/src/taxonomy.ts`: Core taxonomy logic
- `packages/categorizer/src/prompt.ts`: LLM prompt construction
- `packages/categorizer/src/guardrails.ts`: Business rule enforcement
- `services/categorizer/categorize.ts`: Main categorization flow (uses updated functions)

### 3. Pass-1 Rules Engine
- Database rules updated to target umbrella buckets
- Enhanced vendor/keyword patterns
- Improved MCC mapping for umbrella categories

### 4. UI Components (Future Work)
- Category pickers need updating for two-tier navigation
- Dashboard groupings need Tier 1/Tier 2 summaries
- Filters need umbrella bucket support

### 5. Export Systems (Future Work)
- QBO/Xero mappings need updating for umbrella buckets
- CSV exports need new category names
- API responses need umbrella bucket compatibility

## Configuration

### Environment Variables
No new environment variables required. The feature flag system uses the existing categorizer feature flag infrastructure.

### Feature Flag Configuration

```typescript
// Enable two-tier taxonomy
const config = {
  [CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED]: true
};

// Usage in categorization
const categories = getPromptCategories(config, environment);
const result = applyEcommerceGuardrails(tx, categorySlug, confidence, config, environment);
```

## Performance Considerations

### Benefits
- **Reduced Complexity**: Fewer categories to train LLM on
- **Better Accuracy**: Broader targets reduce over-fitting
- **Easier Maintenance**: Simpler rule management
- **Faster Categorization**: Fewer decision points

### Migration Impact
- **One-time Cost**: Historical data remapping
- **Minimal Runtime**: Feature flag checks are lightweight
- **Backward Compatible**: Legacy taxonomy remains functional

## Rollout Strategy

### Phase 1: Development (Current)
- Feature flag enabled in development
- All tests passing
- Ready for staging validation

### Phase 2: Staging Validation
- Enable feature flag in staging
- Run shadow compare job (planned)
- Validate KPIs and accuracy metrics
- A/B test against legacy taxonomy

### Phase 3: Production Rollout
- Start with shadow mode (feature flag disabled)
- Gradual rollout with percentage-based flag
- Monitor KPIs: 10-15% review rate target
- Full rollout after validation

## Testing Strategy

### Unit Tests ✅
- Comprehensive test suite with 17 test cases
- Feature flag behavior validation
- Guardrails testing for all scenarios
- Taxonomy structure validation

### Integration Tests (Future)
- End-to-end categorization flow
- Database migration validation
- API endpoint testing

### Performance Tests (Future)
- Shadow compare job for 12-month historical data
- Accuracy metrics vs legacy taxonomy
- Review rate validation

## Known Limitations

### Current Implementation
1. **UI Not Updated**: Category pickers still show fine-grained categories
2. **Dashboard Groupings**: Not yet updated for two-tier display
3. **Export Mappings**: QBO/Xero mappings need umbrella bucket support
4. **Shadow Compare**: Historical validation job not yet implemented

### Business Rules
1. **Shipping Ambiguity**: Some edge cases in shipping direction detection
2. **Vendor Over-fitting**: Some vendor patterns may need adjustment
3. **Miscellaneous Usage**: Need to monitor to prevent overuse

## Future Enhancements

### Immediate (Next Sprint)
1. **Shadow Compare Job**: Implement 12-month historical comparison
2. **UI Updates**: Update category pickers for two-tier navigation
3. **Dashboard Updates**: Implement Tier 1/Tier 2 groupings
4. **Export Mappings**: Update QBO/Xero for umbrella buckets

### Medium Term
1. **Enhanced Shipping Detection**: More sophisticated direction logic
2. **Advanced Guardrails**: Machine learning-based validation
3. **Dynamic Categories**: Category suggestions based on merchant type

### Long Term
1. **Industry-Specific Taxonomies**: Extend beyond e-commerce
2. **Auto-Category Creation**: ML-driven taxonomy expansion
3. **Real-time Optimization**: Category performance monitoring

## Troubleshooting

### Common Issues

#### 1. Categories Not Found
**Problem**: Unknown category slugs not mapping correctly
**Solution**: Check feature flag configuration and fallback logic

#### 2. Guardrails Not Applied
**Problem**: Transactions not following two-tier rules
**Solution**: Verify feature flag is enabled and guardrails are being called with config

#### 3. Migration Failures
**Problem**: Database migration conflicts
**Solution**: Check deterministic UUID consistency and category references

#### 4. Test Failures
**Problem**: Type errors with branded types
**Solution**: Use `as any` for test mocks as shown in test file

### Debugging Tips

1. **Check Feature Flag**: Verify `TWO_TIER_TAXONOMY_ENABLED` is set correctly
2. **Validate Taxonomy**: Use `getActiveTaxonomy()` to confirm correct taxonomy loaded
3. **Test Guardrails**: Use individual guardrail functions to isolate issues
4. **Migration Status**: Verify migrations 018, 019, 020 have run successfully

## Files Modified/Created

### Database Migrations
- `packages/db/migrations/018_two_tier_taxonomy_seed.sql` ✅
- `packages/db/migrations/019_two_tier_remap.sql` ✅
- `packages/db/migrations/020_two_tier_pass1_rules.sql` ✅

### Core Implementation
- `services/categorizer/feature-flags.ts` ✅ (updated)
- `packages/categorizer/src/taxonomy.ts` ✅ (enhanced)
- `packages/categorizer/src/prompt.ts` ✅ (enhanced)
- `packages/categorizer/src/guardrails.ts` ✅ (enhanced)
- `packages/categorizer/src/index.ts` ✅ (updated exports)

### Testing
- `packages/categorizer/src/two-tier-taxonomy.spec.ts` ✅ (new)

### Documentation
- `docs/two-tier-taxonomy-implementation.md` ✅ (this file)

## Success Metrics

### Implementation Complete ✅
- [x] Database migrations created and tested
- [x] Feature flag system implemented
- [x] Taxonomy engine updated
- [x] Guardrails enhanced
- [x] Comprehensive test suite (17/17 tests passing)
- [x] Code quality checks passed
- [x] Documentation complete

### Next Phase Targets (Future)
- [ ] Shadow compare job implemented
- [ ] UI components updated
- [ ] Dashboard groupings updated
- [ ] Export mappings updated
- [ ] Production rollout initiated

The two-tier taxonomy implementation is now complete and ready for staging validation and eventual production rollout.