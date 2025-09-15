## Goals

- Fix over-reliance on a single category and uniform confidences.
- Reinstate/strengthen Pass‑1 rules; gate LLM by confidence.
- Add guardrails and observability to prevent obviously-wrong outputs.
- Keep changes aligned with existing layering: packages → services → web API → UI.

## Phase 1 — Stabilize Pass‑1 Rules (packages)

- **Consolidate rule inputs**: Normalize description, `merchantName`, `mcc`, amount sign, date, payment channel.
- **MCC mapping table**: Curate canonical MCC→category mapping with strengths (exact, family, unknown). Store as a data module.
- **Known merchant patterns**: Add vendor regex/prefix heuristics (Starbucks, Shell, Netflix, Verizon, Home Depot, etc.) with priority over generic keywords.
- **Keyword heuristics**: Carefully scoped keyword lists per domain (subscriptions, utilities, fuel, QSR, retail). Penalize overly generic tokens ("com", "bill").
- **Score model**: Return a continuous score per rule family, then combine via weighted aggregation; expose: category candidate, confidence, contributing signals.
- **Guardrails**: MCC/category incompatibility filter (e.g., `4900` utilities cannot yield Food), min-confidence threshold, fallback “uncertain”.

Targets:
- `packages/categorizer/src/rules/mcc.ts` (new)
- `packages/categorizer/src/rules/vendors.ts` (new)
- `packages/categorizer/src/rules/keywords.ts` (new)
- `packages/categorizer/src/engine/pass1.ts` (revamp with scorer and guardrails)
- Unit tests in `packages/categorizer/src/__tests__/...`

## Phase 2 — Hybrid Gating and Confidence (services)

- **Gating logic**: If Pass‑1 `confidence >= hybridThreshold` → accept; else call Pass‑2 (LLM).
- **Confidence shaping**: Calibrate combined score into [0,1] with a monotonic mapping; avoid uniform outputs.
- **Rationale**: Return structured rationale (top signals, MCC used, vendor match, keywords used) instead of generic strings.

Targets:
- `services/categorizer/apply.ts` (use new Pass‑1, produce structured rationale and calibrated confidence)
- `services/categorizer/apply.spec.ts` (add coverage for gating thresholds and guardrails)

## Phase 3 — LLM Path Quality (optional improvements)

- **Prompt hardening**: Provide MCC, vendor normalization, and top Pass‑1 signals to LLM as context; request category and short rationale.
- **Cost/perf controls**: Respect `timeoutMs`, `concurrency`, and backoff; short-circuit on obvious categories.
- **Sanity check post‑LLM**: Reapply guardrails; reject categories incompatible with MCC unless LLM provides strong justification flag.

Targets:
- `services/categorizer/pass2.ts` (or equivalent module)
- Tests for ambiguous cases (7‑Eleven, Amazon, generic “BILL”)

## Phase 4 — Web API integration (apps/web)

- **API run route**: Ensure lab route uses the service layer and hybrid gating, not mock shortcuts.
- **Progress streaming**: Maintain `runWithProgress` semantics; include per‑tx rationale and engine used.
- **Confidence distribution**: Return richer distribution for charts (not uniform bins).

Targets:
- `apps/web/src/app/api/dev/categorizer-lab/run/route.ts` (use services/categorizer)
- `apps/web/src/lib/categorizer-lab/client.ts` (no business logic; just transport)

## Phase 5 — UI upgrades (apps/web)

- **Rationale rendering**: Show structured rationale (signals table: MCC, vendor match, keywords).
- **Guardrail badges**: Indicate when guardrails overrode an LLM suggestion.
- **Confidence visualization**: Expect varied values; adjust charts to show long‑tail distributions.

Targets:
- `apps/web/src/components/categorizer-lab/results-table.tsx` (rationale popover)
- `apps/web/src/components/categorizer-lab/metrics-summary.tsx`, `apps/web/src/components/categorizer-lab/charts.tsx` (distribution updates)

## Phase 6 — Tests and Datasets

- **Rule unit tests**: MCC→category, vendor patterns, keyword disambiguation, guardrails.
- **Integration tests**: End‑to‑end lab run on mixed dataset (no `categoryId`), assert Pass‑1 hit rate, lower LLM usage, realistic confidence variance.
- **Ambiguity fixtures**: Amazon (retail vs subscription), 7‑Eleven (fuel vs convenience), “BILL” descriptors, generic merchants.

Targets:
- `services/categorizer/apply.spec.ts` (expand)
- `apps/web/tests/e2e/categorizer-lab.spec.ts` (assert metrics: pass1Only%, llmUsed%)

## Phase 7 — Observability and Safety

- **Metrics**: Count of Pass‑1 vs Pass‑2, average confidence by category, guardrail triggers, LLM timeout/fail rate.
- **Logging**: Structured logs per tx with signal strengths (sampled).
- **Feature flag rollout**: Gate new scorer/rules under a single flag; keep usage minimal and centralized; 0%→50%→100% rollout. Use a TypeScript enum for flag names and keep checks in one callsite.

Targets:
- `apps/edge/_shared/monitoring.ts` (extend)
- Centralized flags enum at the services boundary (single callsite)

## Phase 8 — Rollout

- Stage in dev lab → internal QA → canary (flagged) → full rollout.
- Backfill: optional job to re‑categorize recent transactions using new engine if needed.

## Acceptance Criteria

* Pass‑1 covers common merchants and MCCs; LLM usage decreases on mixed dataset by ≥50%.
* Confidence variance present; histogram shows spread across bins, not a single bucket.
* No obvious mismatches (utilities, subscriptions, fuel) categorized as Food.
* Rationale is specific (signals, MCC, vendor) and consistent.
* All tests passing; e2e shows improved accuracy and sensible metrics.
