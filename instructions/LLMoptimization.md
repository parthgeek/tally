# LLM Categorization Optimization Plan

**Status**: Planning Phase
**Target**: Improve accuracy from 88% → 95%+
**Current Cost**: $0.000011/tx (Gemini 2.5 Flash)
**Last Updated**: 2025-10-09

---

## Executive Summary

The baseline LLM categorization achieves 88% accuracy with 97.9% confidence at $0.000011 per transaction. This plan outlines 8 optimization strategies to reach 95%+ accuracy while maintaining economic viability.

**Key Issues Identified:**
- Overconfident predictions (97.9% confidence vs 88% accuracy)
- 100% Pass 1 fallback rate (rules-based filtering ineffective)
- Three categories with 0% accuracy (401, 503, 308)
- Category confusion patterns (301 over-predicted)

---

## Phase 1: Quick Wins (Week 1)

### 1.1 Temperature Optimization ⭐ HIGHEST PRIORITY

**Rationale**: Already planned in ablation study, likely 2-5% accuracy gain with zero code changes.

**Implementation Steps:**
1. Update `bench/llm-ablation-study.ts` to support temperature parameter in `categorize()` function
2. Modify `packages/categorizer/src/pass2_llm.ts` to accept temperature config
3. Run ablation study for temperatures: 0.0, 0.2 (baseline), 0.5, 1.0
4. Compare F1 scores and select optimal temperature
5. Update production config with winning temperature

**Files to Modify:**
- `packages/categorizer/src/pass2_llm.ts` - Add temperature parameter
- `packages/categorizer/src/categorize.ts` - Pass temperature to LLM
- `bench/llm-ablation-study.ts` - Enable variant execution (currently disabled)

**Success Criteria:**
- All 7 temperature variants execute successfully
- Select temperature with highest F1 score (expect temp=0.0 to win)
- Accuracy improves by 2-5%

**Estimated Effort**: 4-6 hours
**Risk**: Low
**Expected Gain**: +2-5% accuracy

---

### 1.2 Few-Shot Learning for Problem Categories ⭐ HIGH PRIORITY

**Rationale**: Categories 401, 503, 308 have 0% accuracy - targeted examples should fix this immediately.

**Implementation Steps:**
1. Analyze labeled dataset to find ground truth examples for categories 401, 503, 308
2. Create few-shot example structure in prompt builder
3. Add 2-3 high-quality examples per problem category
4. Include negative examples for over-predicted category 301
5. Update prompt template with few-shot examples section
6. Re-run ablation study to measure impact

**Files to Modify:**
- `packages/categorizer/src/prompt.ts` - Add few-shot examples to prompt
- `packages/categorizer/src/taxonomy.ts` - Add example storage per category

**Few-Shot Example Structure:**
```typescript
interface CategoryExample {
  categoryId: CategoryId;
  positiveExamples: {
    description: string;
    merchantName: string | null;
    amountCents: number;
    reasoning: string;
  }[];
  negativeExamples: {
    description: string;
    wrongCategory: CategoryId;
    correctCategory: CategoryId;
    reasoning: string;
  }[];
}
```

**Example Implementation:**
```typescript
const fewShotExamples: CategoryExample[] = [
  {
    categoryId: '550e8400-e29b-41d4-a716-446655440401',
    positiveExamples: [
      {
        description: "SQUARE CAPITAL REPAYMENT",
        merchantName: "Square Capital",
        amountCents: -50000,
        reasoning: "Loan repayment - not operating expense"
      }
    ],
    negativeExamples: [
      {
        description: "SQUARE CAPITAL REPAYMENT",
        wrongCategory: '550e8400-e29b-41d4-a716-446655440106',
        correctCategory: '550e8400-e29b-41d4-a716-446655440401',
        reasoning: "This is loan repayment, not bank fees"
      }
    ]
  }
];
```

**Success Criteria:**
- Categories 401, 503, 308 achieve >80% accuracy
- Category 301 false positive rate decreases by 50%
- Overall accuracy improves by 5-10%

**Estimated Effort**: 6-8 hours
**Risk**: Low
**Expected Gain**: +5-10% accuracy

---

### 1.3 Confidence Calibration ⭐ HIGH PRIORITY

**Rationale**: 97.9% confidence with 88% accuracy indicates severe miscalibration.

**Implementation Steps:**
1. Collect 500+ labeled predictions with ground truth
2. Implement temperature scaling calibration
3. Find optimal calibration parameters (a, b) using validation set
4. Apply calibration to all confidence scores
5. Validate calibrated confidence matches actual accuracy

**Files to Modify:**
- `packages/categorizer/src/engine/scorer.ts` - Add `calibrateConfidence()` function
- `packages/categorizer/src/pass2_llm.ts` - Apply calibration to LLM confidence

**Calibration Implementation:**
```typescript
interface CalibrationParams {
  temperature: number;  // Scaling factor
  bias: number;        // Shift factor
}

/**
 * Temperature scaling calibration
 * Converts overconfident scores to calibrated probabilities
 */
export function calibrateConfidence(
  rawConfidence: number,
  params: CalibrationParams
): number {
  const logit = Math.log(rawConfidence / (1 - rawConfidence));
  const calibratedLogit = logit * params.temperature + params.bias;
  return 1 / (1 + Math.exp(-calibratedLogit));
}

/**
 * Learn calibration parameters from labeled dataset
 */
export function learnCalibrationParams(
  predictions: Array<{ confidence: number; correct: boolean }>
): CalibrationParams {
  // Use Platt scaling optimization
  // Minimize negative log likelihood
  // Return optimal temperature and bias
}
```

**Success Criteria:**
- Calibrated confidence within ±5% of actual accuracy
- High-confidence predictions (>95%) have >95% accuracy
- Low-confidence predictions (<70%) flagged for review

**Estimated Effort**: 8-10 hours
**Risk**: Medium (requires statistical optimization)
**Expected Gain**: Better confidence signals, improved UX

---

## Phase 2: Pass 1 Simplification (Week 2)

### 2.1 Simplify Pass 1 Rules ⭐ MEDIUM PRIORITY

**Rationale**: 100% LLM fallback means Pass 1 adds latency without benefit. Keep only deterministic high-confidence rules.

**Implementation Steps:**
1. Analyze which Pass 1 rules ever trigger (audit logs)
2. Remove vendor pattern matching (never reaches 0.95 threshold)
3. Remove regex pattern matching (low precision)
4. Keep only deterministic MCC mappings for compliance categories
5. Keep guardrails (revenue/expense validation)
6. Update Pass 1 threshold from 0.95 → 0.99 (only perfect matches)

**Files to Modify:**
- `packages/categorizer/src/pass1.ts` - Remove vendor/pattern logic
- `packages/categorizer/src/categorize.ts` - Update threshold logic

**Simplified Pass 1 Logic:**
```typescript
export async function pass1Categorize(
  tx: NormalizedTransaction,
  ctx: CategorizationContext
): Promise<CategorizationResult> {
  const rationale: string[] = [];

  // ONLY keep deterministic high-confidence rules

  // 1. Critical MCC mappings (compliance categories only)
  if (tx.mcc && CRITICAL_MCC_MAPPINGS[tx.mcc]) {
    const mapping = CRITICAL_MCC_MAPPINGS[tx.mcc];
    return {
      categoryId: mapping.categoryId,
      confidence: 0.99, // Deterministic
      rationale: [`mcc: ${tx.mcc} → ${mapping.categoryName} (deterministic)`]
    };
  }

  // 2. Guardrails only (validation, not categorization)
  const guardrailResult = applyGuardrails(tx);
  if (guardrailResult.violation) {
    return createUncertainResult(guardrailResult);
  }

  // Everything else goes to LLM
  return {
    categoryId: undefined,
    confidence: undefined,
    rationale: ['No high-confidence rule matched → LLM']
  };
}
```

**Critical MCC Mappings (Keep Only These):**
- Sales tax collection
- Payroll/wages
- Loan repayments
- Government fees
- Owner draws

**Success Criteria:**
- Pass 1 latency reduced by 50%+ (eliminate DB queries)
- Pass 1 only triggers for 5-10% of transactions (critical categories)
- Overall accuracy unchanged or improved
- No performance regression

**Estimated Effort**: 6-8 hours
**Risk**: Medium (need to ensure critical categories still work)
**Expected Gain**: -400ms latency, cleaner architecture

---

## Phase 3: Prompt Engineering (Week 3)

### 3.1 Chain-of-Thought Prompting

**Rationale**: Structured reasoning improves complex categorization decisions.

**Implementation Steps:**
1. Add reasoning steps to prompt template
2. Instruct LLM to output step-by-step analysis
3. Parse reasoning from LLM response
4. Store reasoning in `rationale` field for debugging
5. A/B test with and without CoT

**Prompt Template:**
```typescript
const chainOfThoughtPrompt = `
Analyze this transaction step by step:

Transaction:
- Description: ${tx.description}
- Merchant: ${tx.merchantName}
- Amount: ${formatAmount(tx.amountCents)}
- MCC: ${tx.mcc}

Step 1: What type of business is this merchant?
Step 2: What is the business purpose of this transaction?
Step 3: Which accounting category best fits?
Step 4: What is your confidence level?

Output your final answer as JSON:
{
  "categoryId": "...",
  "confidence": 0.95,
  "reasoning": "..."
}
`;
```

**Success Criteria:**
- Accuracy improves by 1-3%
- Reasoning helps debug misclassifications
- No significant latency increase

**Estimated Effort**: 4-6 hours
**Risk**: Low
**Expected Gain**: +1-3% accuracy, better debugging

---

### 3.2 Improved Category Descriptions

**Rationale**: Better category definitions reduce confusion between similar categories.

**Implementation Steps:**
1. Audit current category descriptions in taxonomy
2. Add negative examples to each category
3. Add boundary clarifications for similar categories
4. Include industry-specific guidance
5. Test with ablation study

**Enhanced Category Structure:**
```typescript
interface EnhancedCategory {
  id: CategoryId;
  name: string;
  description: string;
  positiveIndicators: string[];
  negativeIndicators: string[];
  similarCategories: {
    categoryId: CategoryId;
    distinction: string;
  }[];
  examples: string[];
}
```

**Example Enhancement:**
```typescript
{
  id: '550e8400-e29b-41d4-a716-446655440301',
  name: 'Marketing & Advertising',
  description: 'Expenses for promoting the business and attracting customers',
  positiveIndicators: [
    'Social media ads',
    'Google Ads',
    'Print advertising',
    'Promotional materials'
  ],
  negativeIndicators: [
    'NOT website design (that is Professional Services)',
    'NOT logo creation (that is Professional Services)',
    'NOT business cards printing (that is Office Supplies)'
  ],
  similarCategories: [
    {
      categoryId: '550e8400-e29b-41d4-a716-446655440307',
      distinction: 'Marketing promotes; Professional Services creates business assets'
    }
  ],
  examples: [
    'Facebook Ads payment',
    'Instagram promotion',
    'Local newspaper ad'
  ]
}
```

**Success Criteria:**
- Category confusion rate decreases by 30%
- Category 301 false positive rate decreases
- Human review time decreases

**Estimated Effort**: 8-12 hours
**Risk**: Low
**Expected Gain**: +2-4% accuracy

---

## Phase 4: Advanced Optimizations (Week 4)

### 4.1 Structured Output Enforcement

**Rationale**: JSON schema mode eliminates invalid outputs and hallucinations.

**Implementation Steps:**
1. Define JSON schema for categorization output
2. Update Gemini API call to use schema mode
3. Add schema validation
4. Handle schema validation errors gracefully

**Files to Modify:**
- `packages/categorizer/src/pass2_llm.ts` - Add schema parameter
- `packages/categorizer/src/gemini-client.ts` - Support JSON schema mode

**Schema Definition:**
```typescript
const categorizationSchema = {
  type: "object",
  properties: {
    categoryId: {
      type: "string",
      enum: validCategoryIds, // All valid category IDs
      description: "The selected category ID"
    },
    confidence: {
      type: "number",
      minimum: 0.0,
      maximum: 1.0,
      description: "Confidence score between 0 and 1"
    },
    reasoning: {
      type: "string",
      description: "Explanation for the categorization decision"
    }
  },
  required: ["categoryId", "confidence", "reasoning"]
};
```

**Success Criteria:**
- Zero invalid category outputs
- Zero parsing errors
- Confidence scores always in [0, 1] range

**Estimated Effort**: 4-6 hours
**Risk**: Low
**Expected Gain**: Better reliability, fewer errors

---

### 4.2 Ensemble Voting (Optional)

**Rationale**: Multiple predictions with voting can improve accuracy at higher cost.

**Implementation Steps:**
1. Add ensemble mode to categorization config
2. Run 3 parallel LLM calls with temp=0
3. Implement majority voting logic
4. Handle ties with confidence scores
5. Measure cost vs accuracy tradeoff

**Implementation:**
```typescript
export async function categorizeWithEnsemble(
  tx: NormalizedTransaction,
  ctx: CategorizationContext,
  numVotes: number = 3
): Promise<CategorizationResult> {
  // Run N predictions in parallel
  const predictions = await Promise.all(
    Array(numVotes).fill(null).map(() =>
      scoreWithLLM(tx, { ...ctx, temperature: 0.0 })
    )
  );

  // Count votes for each category
  const votes = new Map<CategoryId, number>();
  for (const pred of predictions) {
    if (pred.categoryId) {
      votes.set(pred.categoryId, (votes.get(pred.categoryId) || 0) + 1);
    }
  }

  // Find majority winner
  let maxVotes = 0;
  let winner: CategoryId | undefined;
  for (const [categoryId, count] of votes) {
    if (count > maxVotes) {
      maxVotes = count;
      winner = categoryId;
    }
  }

  // Calculate ensemble confidence
  const confidence = maxVotes / numVotes;

  return {
    categoryId: winner,
    confidence,
    rationale: [`Ensemble vote: ${maxVotes}/${numVotes} agreement`]
  };
}
```

**Cost Analysis:**
- 3-vote ensemble: $0.000033/tx (3x baseline)
- 5-vote ensemble: $0.000055/tx (5x baseline)
- Still economical: 1M tx/month = $33-55/month

**Success Criteria:**
- Accuracy improves by 3-7%
- Cost remains economically viable
- Latency acceptable (parallel execution)

**Estimated Effort**: 6-8 hours
**Risk**: Medium (cost increase)
**Expected Gain**: +3-7% accuracy (if enabled)

---

### 4.3 Active Learning Loop

**Rationale**: Flag uncertain predictions for human review and model retraining.

**Implementation Steps:**
1. Define uncertainty thresholds
2. Flag transactions for human review when confidence < 0.90
3. Store human corrections in learning database
4. Build retraining pipeline
5. Periodically update few-shot examples from corrections

**Files to Modify:**
- `packages/categorizer/src/engine/learning-loop.ts` - Already exists!
- `packages/db/schema.sql` - Add human review tables (may exist)
- `apps/web/` - Add review UI

**Review Flagging Logic:**
```typescript
export function shouldFlagForReview(
  result: CategorizationResult
): boolean {
  // Flag uncertain predictions
  if (!result.confidence || result.confidence < 0.90) {
    return true;
  }

  // Flag high-value transactions
  if (Math.abs(parseInt(result.transaction.amountCents)) > 100000) {
    return true;
  }

  // Flag categories with known issues
  const problematicCategories = new Set([
    '550e8400-e29b-41d4-a716-446655440401', // Loan repayment
    '550e8400-e29b-41d4-a716-446655440503', // Problem category
    '550e8400-e29b-41d4-a716-446655440308', // Problem category
  ]);

  if (result.categoryId && problematicCategories.has(result.categoryId)) {
    return true;
  }

  return false;
}
```

**Success Criteria:**
- 10-15% of transactions flagged for review
- Human corrections stored and tracked
- Retraining pipeline functional
- Accuracy improves over time with corrections

**Estimated Effort**: 12-16 hours
**Risk**: Medium (requires UI changes)
**Expected Gain**: Continuous improvement over time

---

## Phase 5: Testing & Validation (Week 5)

### 5.1 Comprehensive Ablation Study

**Implementation Steps:**
1. Ensure all 7 variants execute successfully
2. Expand dataset to 500+ labeled transactions
3. Run full ablation matrix:
   - Temperature variants (0.0, 0.2, 0.5, 1.0)
   - Prompt variants (system-heavy, user-heavy, balanced)
   - With/without Pass1 context
   - With/without few-shot examples
   - With/without chain-of-thought
4. Generate statistical significance tests
5. Select optimal configuration

**Success Criteria:**
- All variants complete successfully
- Statistical significance (p < 0.05) for improvements
- Winning configuration identified
- Results exported to `bench/ablation-results.json`

**Estimated Effort**: 8-12 hours (mostly compute time)
**Risk**: Low

---

### 5.2 Production Canary Testing

**Implementation Steps:**
1. Deploy winning configuration to 5% of traffic
2. Monitor accuracy metrics in production
3. Compare against baseline (A/B test)
4. Gradually roll out to 25%, 50%, 100%
5. Monitor for regressions

**Metrics to Track:**
- Accuracy (sampled human review)
- Confidence calibration
- Latency (p50, p95, p99)
- Cost per transaction
- Error rate
- User feedback (if available)

**Rollback Criteria:**
- Accuracy drops by >2%
- Latency increases by >500ms
- Error rate increases by >5%
- User complaints increase

**Success Criteria:**
- Production accuracy matches or exceeds test results
- No performance regressions
- Successful rollout to 100%

**Estimated Effort**: 4-6 hours + monitoring time
**Risk**: Low (with gradual rollout)

---

## Phase 6: Documentation & Monitoring (Week 6)

### 6.1 Documentation

**Create/Update:**
1. `/docs/categorization-system.md` - Architecture overview
2. `/docs/llm-optimization-results.md` - Ablation study findings
3. `/docs/confidence-calibration.md` - Calibration methodology
4. `/docs/categorization-debugging.md` - How to debug misclassifications
5. Update `CLAUDE.md` with new categorization guidelines

**Success Criteria:**
- Complete documentation for all optimizations
- Runbooks for troubleshooting
- Examples and best practices

**Estimated Effort**: 6-8 hours
**Risk**: Low

---

### 6.2 Monitoring & Alerting

**Implementation Steps:**
1. Set up PostHog events for categorization metrics
2. Create dashboard for accuracy monitoring
3. Set up alerts for:
   - Accuracy drops below 85%
   - Cost per transaction exceeds $0.00002
   - Latency exceeds 2000ms
   - Error rate exceeds 5%
4. Set up weekly accuracy reports

**Metrics Dashboard:**
- Overall accuracy (daily, weekly, monthly)
- Per-category accuracy
- Confidence distribution
- Cost per transaction
- Latency distribution
- LLM vs Pass1 rate
- Review flag rate
- Top misclassified categories

**Success Criteria:**
- Real-time monitoring in place
- Alerts configured and tested
- Weekly reports automated

**Estimated Effort**: 6-8 hours
**Risk**: Low

---

## Implementation Timeline

| Phase | Duration | Effort | Risk | Expected Gain |
|-------|----------|--------|------|---------------|
| **Phase 1: Quick Wins** | Week 1 | 18-24h | Low | +7-15% accuracy |
| - Temperature optimization | 4-6h | 4-6h | Low | +2-5% |
| - Few-shot learning | 6-8h | 6-8h | Low | +5-10% |
| - Confidence calibration | 8-10h | 8-10h | Medium | Better UX |
| **Phase 2: Pass 1 Simplification** | Week 2 | 6-8h | Medium | -400ms latency |
| **Phase 3: Prompt Engineering** | Week 3 | 12-18h | Low | +3-7% accuracy |
| - Chain-of-thought | 4-6h | 4-6h | Low | +1-3% |
| - Category descriptions | 8-12h | 8-12h | Low | +2-4% |
| **Phase 4: Advanced Optimizations** | Week 4 | 22-30h | Medium | +3-7% (optional) |
| - Structured output | 4-6h | 4-6h | Low | Better reliability |
| - Ensemble voting | 6-8h | 6-8h | Medium | +3-7% (if enabled) |
| - Active learning | 12-16h | 12-16h | Medium | Long-term gains |
| **Phase 5: Testing & Validation** | Week 5 | 12-18h | Low | Validation |
| **Phase 6: Documentation & Monitoring** | Week 6 | 12-16h | Low | Operational |
| **TOTAL** | 6 weeks | 82-114h | - | +13-29% accuracy |

---

## Success Metrics

### Target Metrics (End of Phase 5)

| Metric | Baseline | Target | Stretch Goal |
|--------|----------|--------|--------------|
| **Overall Accuracy** | 88% | 95% | 97% |
| **Precision** | 73.2% | 92% | 95% |
| **Recall** | 75.7% | 92% | 95% |
| **F1 Score** | 74.4% | 92% | 95% |
| **Confidence Calibration** | 97.9% (overconfident) | ±5% of accuracy | ±2% of accuracy |
| **Cost per Transaction** | $0.000011 | <$0.000020 | <$0.000015 |
| **Latency (p95)** | 792ms | <800ms | <600ms |
| **Categories with 100% Accuracy** | 9/15 | 12/15 | 14/15 |
| **Categories with 0% Accuracy** | 3/15 | 0/15 | 0/15 |

### Per-Category Targets

**Problem Categories (Currently 0% accuracy):**
- Category 401 (Loan Repayment): → 85%+
- Category 503: → 85%+
- Category 308: → 85%+

**Over-Predicted Category:**
- Category 301 (Marketing): Reduce false positive rate by 50%

**High-Performing Categories (Maintain):**
- Categories 301, 303, 304, 207, 205, 206, 307, 306, 305: Maintain 100%

---

## Risk Mitigation

### Risk: Accuracy Regression
- **Mitigation**: Comprehensive ablation testing, gradual rollout, automatic rollback
- **Monitoring**: Real-time accuracy tracking, alerts for drops

### Risk: Cost Increase
- **Mitigation**: Ensemble voting is optional, keep using Gemini Flash (cheapest model)
- **Monitoring**: Cost per transaction alerts

### Risk: Latency Increase
- **Mitigation**: Parallel execution for ensemble, simplify Pass 1
- **Monitoring**: p95 latency alerts

### Risk: Breaking Changes
- **Mitigation**: Comprehensive test suite, canary deployment
- **Monitoring**: Error rate tracking

---

## Future Enhancements (Post-Phase 6)

### Model Fine-Tuning
- Fine-tune Gemini on salon-specific categorization data
- Requires 1000+ high-quality labeled examples
- Expected gain: +5-10% accuracy
- Effort: 2-3 weeks

### Multi-Model Ensemble
- Combine Gemini + GPT-4 + Claude predictions
- Higher cost but potentially higher accuracy
- Expected gain: +2-5% accuracy

### Domain-Specific Embeddings
- Train custom embeddings for vendor/category matching
- Improve Pass 1 rules effectiveness
- Expected gain: +2-4% accuracy, faster Pass 1

### Real-Time Learning
- Update few-shot examples in real-time from human corrections
- Continuous model improvement
- Expected gain: Ongoing accuracy improvements

---

## Appendix A: Key Files Reference

### Core Categorization Files
- `packages/categorizer/src/categorize.ts` - Main entry point
- `packages/categorizer/src/pass1.ts` - Rules-based categorization
- `packages/categorizer/src/pass2_llm.ts` - LLM categorization
- `packages/categorizer/src/prompt.ts` - Prompt builder
- `packages/categorizer/src/taxonomy.ts` - Category definitions
- `packages/categorizer/src/engine/scorer.ts` - Confidence scoring
- `packages/categorizer/src/engine/guardrails.ts` - Validation rules
- `packages/categorizer/src/gemini-client.ts` - LLM API client

### Benchmarking Files
- `bench/llm-ablation-study.ts` - Ablation study runner
- `bench/labeled-dataset.json` - Ground truth dataset
- `bench/ablation-results.json` - Latest results
- `bench/threshold-optimizer.ts` - Confidence threshold tuning

### Configuration
- `packages/categorizer/src/config.ts` - Industry/org config
- `packages/categorizer/src/feature-flags.ts` - Feature flags

---

## Appendix B: Category Confusion Matrix Analysis

**From ablation study results:**

### Categories with Perfect Accuracy (100%)
- 301, 303, 304, 207, 205, 206, 307, 306, 305

### Categories with Issues
1. **Category 401** (0% accuracy, n=3)
   - Misclassified as: 106 (2x), 307 (1x)
   - Root cause: Loan repayment confused with bank fees or professional services

2. **Category 503** (0% accuracy, n=2)
   - Misclassified as: 301 (2x)
   - Root cause: Unknown category confused with marketing

3. **Category 308** (0% accuracy, n=2)
   - Misclassified as: 307 (2x)
   - Root cause: Similar category confusion

4. **Category 106** (75% accuracy, n=8)
   - Correct: 6, Wrong: 2
   - False positives FROM: 401 (2x)
   - False negatives TO: 301 (1x), 205 (1x)

5. **Category 105** (85.7% accuracy, n=7)
   - Correct: 6, Wrong: 1
   - False negatives TO: 301 (1x)

6. **Category 208** (75% accuracy, n=4)
   - Correct: 3, Wrong: 1
   - False negatives TO: 105 (1x)

7. **Category 102** (75% accuracy, n=4)
   - Correct: 3, Wrong: 1
   - False negatives TO: 207 (1x)

### Over-Predicted Categories (False Positives)
- **Category 301**: Predicted 11 times, 7 correct, 4 false positives
  - False positives FROM: 106 (1x), 105 (1x), 503 (2x)

---

## Appendix C: Cost Analysis

### Current Costs (Gemini 2.5 Flash)
- Input: $0.00001 per 1K tokens (~800 tokens/tx)
- Output: $0.00003 per 1K tokens (~100 tokens/tx)
- **Total**: $0.000011 per transaction

### Projected Costs After Optimization

| Configuration | Cost/tx | 10K tx/mo | 100K tx/mo | 1M tx/mo |
|--------------|---------|-----------|------------|----------|
| **Baseline (current)** | $0.000011 | $0.11 | $1.10 | $11.00 |
| **Optimized (single)** | $0.000011 | $0.11 | $1.10 | $11.00 |
| **With 3-vote ensemble** | $0.000033 | $0.33 | $3.30 | $33.00 |
| **With 5-vote ensemble** | $0.000055 | $0.55 | $5.50 | $55.00 |

### Cost vs Accuracy Tradeoff

All costs remain economically viable even with ensemble voting. Recommend:
- **Production**: Single LLM call (best cost)
- **High-value transactions**: 3-vote ensemble (best accuracy)
- **Compliance categories**: 5-vote ensemble (maximum confidence)

---

## Questions & Answers

### Q: Why not use GPT-4 instead of Gemini?
**A**: Gemini 2.5 Flash is 10-50x cheaper than GPT-4 with similar accuracy. Cost matters at scale.

### Q: Can we achieve 99% accuracy?
**A**: Possible but requires:
- Fine-tuned model on domain data
- Human-in-the-loop for edge cases
- Multi-model ensemble
- Significantly higher cost

### Q: What about completely removing Pass 1?
**A**: Keep minimal Pass 1 for:
- Compliance categories (audit trail requirements)
- Deterministic high-confidence rules (faster than LLM)
- Guardrails (validation before LLM)

### Q: How to handle new categories?
**A**:
- Add category to taxonomy
- Add 3-5 few-shot examples
- Test with ablation study
- Deploy with canary rollout

---

## Sign-off

**Plan Author**: Claude Code
**Date**: 2025-10-09
**Status**: Ready for Implementation

**Approvals Needed**:
- [ ] Technical Lead
- [ ] Product Manager
- [ ] Engineering Manager

**Next Steps**:
1. Review and approve plan
2. Begin Phase 1 (Week 1) implementation
3. Schedule weekly progress reviews
4. Update this document with actual results
