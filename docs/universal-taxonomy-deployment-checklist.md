# Universal Taxonomy Deployment Checklist

**Status:** Ready for Staging Deployment  
**Version:** 1.0  
**Date:** October 2025

## Pre-Deployment Validation

### ✅ Phase 1: Critical Items (COMPLETE)
- [x] Export universal functions from packages/categorizer/src/index.ts
- [x] Update apps/edge/jobs/categorize-queue/index.ts to use categorizeWithUniversalLLM
- [x] Update services/categorizer/pass2.ts to use universal LLM
- [x] Update services/categorizer/categorize.ts to handle attributes
- [x] Update apps/edge/jobs/recategorize-historical/index.ts
- [x] Set default model to gemini-2.5-flash-lite with temperature 1.0

### ✅ Phase 2: Nice-to-Have Items (COMPLETE)
- [x] Created test script: bench/test-labeled-dataset.ts
- [x] Added PostHog monitoring for category distribution and attributes
- [x] Created test script: bench/test-error-handling.ts
- [x] Updated README.md with universal taxonomy documentation
- [x] Created docs/universal-taxonomy-migration.md guide
- [x] Created packages/categorizer/README.md with usage examples
- [x] Added comprehensive structured logging to all entry points

### ✅ Phase 3: Testing & Validation (PARTIALLY COMPLETE)
- [x] Integration test passed (bench/test-universal-integration.ts)
- [ ] Run labeled dataset test and validate 85%+ accuracy (ready to run)
- [ ] Run error handling test (ready to run)
- [ ] Manual smoke test with real transaction (ready to test)

### ⏳ Phase 4: Final Prep (IN PROGRESS)
- [ ] Commit all changes with comprehensive message
- [ ] Push to GitHub
- [x] Create deployment checklist document

---

## Pre-Deployment Tests to Run

Before deploying to staging, run these tests:

### 1. Labeled Dataset Test (10-15 minutes)

```bash
pnpm exec tsx bench/test-labeled-dataset.ts
```

**Expected Results:**
- ✅ Accuracy: 85%+ (target met)
- ✅ Average confidence: 80-95%
- ✅ Attribute extraction: High coverage
- ✅ No errors or crashes

**If Test Fails:**
- Review incorrect predictions
- Check if specific categories are problematic
- Verify model and temperature settings
- Consider adjusting confidence calibration

### 2. Error Handling Test (2-3 minutes)

```bash
pnpm exec tsx bench/test-error-handling.ts
```

**Expected Results:**
- ✅ All error scenarios handled gracefully
- ✅ No unhandled exceptions
- ✅ Appropriate fallback behavior
- ✅ Attributes field never causes crashes

**If Test Fails:**
- Review specific failing test cases
- Check error handling in pass2_llm.ts
- Verify GeminiClient error handling
- Ensure fallback categories exist

### 3. Manual Smoke Test

**Step 1: Create Test Transaction**
```sql
INSERT INTO transactions (
  org_id, date, amount_cents, currency, description, 
  merchant_name, mcc, source, reviewed
) VALUES (
  'your-test-org-id',
  NOW()::date,
  350,
  'USD',
  'Stripe payment processing fee',
  'Stripe',
  '6513',
  'test',
  false
) RETURNING id;
```

**Step 2: Trigger Categorization**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/categorize-queue \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transactionId": "tx-id-from-step-1"}'
```

**Step 3: Verify Results**
```sql
SELECT 
  id,
  description,
  category_id,
  confidence,
  attributes,
  needs_review
FROM transactions
WHERE id = 'tx-id-from-step-1';
```

**Expected:**
- ✅ Category assigned correctly (Payment Processing Fees)
- ✅ Confidence > 0.8
- ✅ Attributes extracted: `{processor: "stripe", transaction_type: "payment"}`
- ✅ needs_review = false (if confidence >= 0.95)

**Step 4: Check PostHog Events**
- Navigate to PostHog dashboard
- Search for events: `universal_categorization_completed`, `attributes_extracted`
- Verify event properties contain expected data

---

## Staging Deployment

### Prerequisites

- [ ] All pre-deployment tests passed
- [ ] Changes committed and pushed to GitHub
- [ ] Environment variables configured in staging
- [ ] Database migrations applied to staging

### Deployment Steps

#### 1. Apply Database Migrations

```bash
# Connect to staging database
export SUPABASE_DB_URL="your-staging-db-url"

# Apply migrations
psql "$SUPABASE_DB_URL" -f packages/db/migrations/038_universal_taxonomy_schema.sql
psql "$SUPABASE_DB_URL" -f packages/db/migrations/039_attribute_validation.sql
psql "$SUPABASE_DB_URL" -f packages/db/migrations/040_seed_universal_categories.sql
```

**Verify:**
```sql
-- Check categories seeded correctly
SELECT COUNT(*) FROM categories WHERE is_universal = true AND is_active = true;
-- Expected: 30

-- Check attributes column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name = 'attributes';
-- Expected: 1 row

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('get_attribute', 'validate_attributes_against_schema');
-- Expected: 2 rows
```

#### 2. Deploy Edge Functions

```bash
# From project root
cd apps/edge

# Deploy categorize-queue job
supabase functions deploy categorize-queue --project-ref your-staging-ref

# Deploy recategorize-historical job
supabase functions deploy recategorize-historical --project-ref your-staging-ref

# Verify deployment
supabase functions list --project-ref your-staging-ref
```

#### 3. Deploy Web Application

```bash
# Deploy to Vercel staging
vercel --env staging

# Or trigger via GitHub (if CI/CD configured)
git push origin main
```

#### 4. Verify Deployment

**A. Check Edge Functions:**
```bash
# Health check
curl https://your-staging-project.supabase.co/functions/v1/health

# Test categorize-queue (with test transaction)
curl -X POST https://your-staging-project.supabase.co/functions/v1/categorize-queue \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transactionId": "test-tx-id"}'
```

**B. Check Web Application:**
- Navigate to staging URL
- Log in with test account
- Connect test Plaid account
- Verify transactions load correctly
- Verify categories display correctly
- Check transaction detail shows attributes

**C. Check Database:**
```sql
-- Verify new transactions have attributes
SELECT 
  COUNT(*) as total,
  COUNT(attributes) as with_attributes,
  COUNT(attributes) * 100.0 / COUNT(*) as percentage
FROM transactions
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Monitoring (24-48 Hours)

### Key Metrics to Watch

#### 1. Categorization Accuracy
- Monitor `universal_categorization_completed` events in PostHog
- Track confidence distribution
- Alert if average confidence < 0.75

#### 2. Attribute Extraction
- Monitor `attributes_extracted` events
- Track extraction rate (should be 60%+)
- Alert if extraction rate < 40%

#### 3. Error Rates
- Monitor edge function error logs
- Track LLM API failures
- Alert if error rate > 5%

#### 4. Performance
- Monitor categorization latency
- Track edge function duration
- Alert if p95 latency > 3000ms

#### 5. Category Distribution
```sql
-- Daily category distribution
SELECT 
  c.name,
  COUNT(*) as transaction_count,
  AVG(t.confidence) as avg_confidence
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
GROUP BY c.name
ORDER BY transaction_count DESC;
```

#### 6. Attribute Coverage
```sql
-- Attribute extraction coverage
SELECT 
  c.name as category,
  COUNT(*) as total,
  COUNT(t.attributes) as with_attributes,
  COUNT(t.attributes) * 100.0 / COUNT(*) as percentage
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
GROUP BY c.name
ORDER BY percentage DESC;
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Average Confidence | < 0.75 | < 0.65 | Review LLM prompts |
| Error Rate | > 5% | > 10% | Check API keys, quotas |
| Latency (p95) | > 2000ms | > 3000ms | Investigate bottlenecks |
| Attribute Extraction | < 50% | < 30% | Review attribute logic |

---

## Production Deployment

### Go/No-Go Checklist

Only proceed to production if:

- [ ] Staging deployed successfully for 24-48 hours
- [ ] No critical issues found during monitoring
- [ ] Accuracy metrics meet targets (85%+)
- [ ] Attribute extraction working correctly (60%+)
- [ ] Error rates acceptable (< 5%)
- [ ] Performance acceptable (p95 < 2000ms)
- [ ] Team sign-off obtained

### Production Deployment Steps

1. **Repeat Staging Steps for Production**
   - Apply database migrations
   - Deploy edge functions
   - Deploy web application

2. **Gradual Rollout (Optional)**
   - Enable for 10% of orgs first
   - Monitor for 24 hours
   - Gradually increase to 100%

3. **Post-Deployment Verification**
   - Run smoke tests
   - Check key metrics
   - Verify attributes storing correctly
   - Test with real user transactions

4. **Communication**
   - Notify team of deployment
   - Update status page if applicable
   - Prepare support for potential issues

---

## Rollback Plan

If critical issues arise:

### Quick Rollback (< 5 minutes)

**Revert Edge Functions:**
```bash
# Redeploy previous version from git history
git checkout <previous-commit-hash>
cd apps/edge
supabase functions deploy categorize-queue --project-ref your-project-ref
supabase functions deploy recategorize-historical --project-ref your-project-ref
```

### Full Rollback (< 30 minutes)

1. **Revert Edge Functions** (see above)

2. **Revert Web Application**
   ```bash
   # Revert to previous deployment in Vercel
   vercel rollback
   ```

3. **Database Rollback (if needed)**
   ```bash
   # Run rollback script
   psql "$SUPABASE_DB_URL" -f scripts/rollback-migrations-038-039.sql
   ```

**Note:** Database rollback only needed if schema changes are causing issues. Existing data is safe - old transactions keep their original category IDs.

---

## Success Criteria

Deployment is considered successful if:

✅ **Functionality:**
- All transactions being categorized correctly
- Attributes extracting as expected
- No blocking errors

✅ **Performance:**
- Latency within acceptable ranges
- No significant performance degradation
- API rate limits not exceeded

✅ **Accuracy:**
- Accuracy meets or exceeds 85% target
- Confidence scores well-calibrated
- Category distribution reasonable

✅ **Monitoring:**
- All metrics being tracked correctly
- Alerts configured and working
- Dashboard showing relevant data

✅ **User Experience:**
- No user-reported issues
- UI displaying data correctly
- Transactions processing smoothly

---

## Post-Deployment Tasks

### Week 1
- [ ] Monitor metrics daily
- [ ] Review any user feedback
- [ ] Address any minor issues
- [ ] Document any learnings

### Week 2-4
- [ ] Analyze category distribution trends
- [ ] Review attribute extraction patterns
- [ ] Identify potential improvements
- [ ] Plan next iteration

### Month 1+
- [ ] Comprehensive accuracy review
- [ ] User satisfaction survey
- [ ] Performance optimization if needed
- [ ] Plan multi-vertical expansion

---

## Support & Escalation

**Issues During Deployment:**
- Check edge function logs: Supabase Dashboard → Edge Functions → Logs
- Check database logs: Supabase Dashboard → Database → Logs
- Check application logs: Vercel Dashboard → Logs

**Critical Issues:**
- Execute rollback plan immediately
- Notify team via Slack
- Create incident report
- Schedule post-mortem

**Non-Critical Issues:**
- Document issue with reproduction steps
- Create GitHub issue
- Assign to appropriate team member
- Track in project board

---

## Contacts

**Technical Lead:** [Name]  
**DevOps:** [Name]  
**On-Call:** [Rotation Schedule]  
**Slack Channel:** #nexus-deployments

---

## Sign-Off

**Prepared By:** _____________________  
**Reviewed By:** _____________________  
**Approved By:** _____________________  
**Date:** _____________________

