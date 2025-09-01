## Milestone 3 — Categorization v0 (Hybrid)

Days 7–10 implementation plan to add a hybrid categorization engine (deterministic heuristics + LLM scorer), decisioning, corrections→rules loop, embeddings memory, UI trust layer, and a batch queue. The plan aligns with the repo structure (apps/edge jobs, apps/web routes/UI, packages/* libs) and existing analytics wrappers.

## Goals and scope

- **Baseline accuracy**: ≥ 90% on salon taxonomy for seed data
- **Deterministic pass first**: Cheap and explainable (MCC, vendor alias, recurring patterns, embeddings neighbor boost)
- **LLM only when needed**: Secondary scorer with rationale logging
- **Decisioning**: Auto-apply ≥ 0.85; else requires review
- **Learning loop**: Corrections generate/upweight new rules
- **Observability**: Langfuse tracing, Sentry errors, PostHog events
- **Guardrails**: Amounts kept as cents strings, vendor normalization, token caps, no LLM override if Pass-1 is confident

## Directory and module changes

- `packages/categorizer/`
  - `src/pass1.ts`: `pass1Categorize(tx, ctx)` — deterministic heuristics + embeddings boost
  - `src/pass2_llm.ts`: `scoreWithLLM(tx, ctx)` — prompt, call via analytics wrapper, parse, clamp
  - `src/index.ts`: export public API and shared types
  - `package.json`, `tsconfig.json`, tests

- `services/categorizer/`
  - `apply.ts`: `decideAndApply(txId, result, source)` writes decisions and updates transaction

- `apps/web/src/app/api/transactions/correct/route.ts`
  - POST endpoint: accepts `{ tx_id, new_category_id }`, writes correction + upserts vendor rule

- `apps/edge/jobs/`
  - `categorize-queue/` — (re)categorize uncategorized or needs_review transactions
  - `embeddings-refresh/` — weekly vendor embeddings refresh

## Data model and SQL migrations

All migrations should live under `packages/db/migrations/` with incremental files. Use safe guards (`if not exists`) and indexes.

1) Transaction review flag

```sql
alter table transactions
  add column if not exists needs_review boolean default false;
```

2) Decisions audit table

```sql
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  tx_id uuid not null,
  source text not null check (source in ('pass1','llm')),
  confidence numeric not null,
  rationale jsonb not null,
  decided_by text not null default 'system',
  created_at timestamptz not null default now()
);
create index if not exists idx_decisions_tx on decisions(tx_id);
```

3) Corrections table

```sql
create table if not exists corrections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  tx_id uuid not null,
  old_category_id uuid,
  new_category_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_corrections_org on corrections(org_id);
create index if not exists idx_corrections_tx on corrections(tx_id);
```

4) Rules table (if not already present)

```sql
create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  pattern jsonb not null, -- {vendor: string, mcc?: string, desc_tokens?: string[]}
  category_id uuid not null,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists idx_rules_org on rules(org_id);
```

5) Embeddings store (pgvector)

```sql
create extension if not exists vector;
-- text-embedding-3-small has 1536 dims; keep configurable if needed
create table if not exists vendor_embeddings (
  org_id uuid not null,
  vendor text not null,
  embedding vector(1536) not null,
  last_refreshed timestamptz not null default now(),
  primary key (org_id, vendor)
);
```

6) Helpful indexes

```sql
create index if not exists idx_tx_org_date on transactions(org_id, date desc);
-- idx_rules_org already above
```

## Shared types and contracts

- `NormalizedTransaction` (existing M2): `id`, `org_id`, `raw`, `merchant_name`, `mcc`, `amount_cents` (string), `date`, `category_id?`, `confidence?`, `reviewed?`, `needs_review?`
- `CategorizationContext`: db client, org scoped caches, `analytics` (PostHog/Langfuse), logger, config
- `CategorizationResult`: `{ category_id?: string, confidence?: number, rationale: string[] }`

Where possible, import transaction types from `packages/types` to avoid duplication.

## Pass-1 (deterministic) — `packages/categorizer/src/pass1.ts`

Execution order and contribution to result (add to `rationale` for every hit):

1) **MCC mapping**
   - Static in-memory map or DB-backed table (prefer static map seeded from DB at startup + hot reload on change)
   - If `mcc` exists and maps to category, set candidate `{category_id, confidence≈0.9}`
   - Rationale: `mcc: 5812 → Restaurants`

2) **Vendor alias match**
   - Normalize vendor: trim, lowercase, strip punctuation/suffixes ("llc", "inc")
   - Exact or ILIKE matches against `rules.pattern->>'vendor'`
   - Confidence from weight bucket: e.g., `min(0.95, 0.7 + 0.05*log1p(weight))`
   - Rationale: `vendor: 'friendly cuts' matched rule → category 'salon_supplies'`

3) **Recurring patterns**
   - Regex/signature rules in `rules.pattern` (e.g., landlord, utilities, SaaS)
   - Rationale: `pattern: '/adobe|canva/' matched -> SaaS`

4) **Embeddings neighbor boost** (optional boost, not standalone decision)
   - Lookup `vendor_embeddings` kNN for the normalized vendor; take top-K (e.g., 5)
   - If majority matches same category, add +0.05..0.1 confidence boost
   - Rationale: `neighbors: 4/5 similar vendors map to 'supplies' (+0.08)`

5) **Aggregation and clamp**
   - Combine signals: take the strongest signal as base; apply small additive boosts; cap at 0.98
   - Do not set below 0.5 unless no matches; default `{confidence: 0.5}` only if truly no signal

Function signature (pure, side-effect-free):

```ts
export async function pass1Categorize(
  tx: NormalizedTransaction,
  ctx: CategorizationContext
): Promise<CategorizationResult> { /* ... */ }
```

Caching: LRU caches by `org_id` for MCC map and vendor rules; invalidate by TTL.

## Pass-2 (LLM scorer) — `packages/categorizer/src/pass2_llm.ts`

Only run if Pass-1 confidence < 0.85.

Behavior:

- Build compact prompt with fields: `{ merchant, description(≤160 chars), mcc, amount_cents (string), prior_category?, org_industry='salon' }`
- Use `packages/analytics/langfuse.ts` to call OpenAI/Claude (no API keys in code)
- Log prompt, latency, and model in Langfuse; capture Sentry on parse failures
- Parse model output to `{ category_slug, confidence(0..1), rationale }`
- Clamp confidence to [0, 1]; default to 0.5 on malformed output
- Map `category_slug` → `categories.id` (DB lookup); fallback to "Uncategorized"
- Never override a Pass-1 high-confidence decision

Function signature:

```ts
export async function scoreWithLLM(
  tx: NormalizedTransaction,
  ctx: CategorizationContext
): Promise<{ category_id: string; confidence: number; rationale: string[] }> { /* ... */ }
```

Token budget: trim `description` to ≤ 160 chars; keep `amount_cents` as a string; do not parse to float.

## Decisioning — `services/categorizer/apply.ts`

Policy: if `confidence ≥ 0.85` → auto-apply; else mark `needs_review=true`.

```ts
export async function decideAndApply(
  txId: string,
  result: CategorizationResult,
  source: 'pass1' | 'llm',
  ctx: CategorizationContext
): Promise<void> {
  // 1) Update transactions: category_id, confidence, reviewed=false
  // 2) If < 0.85 → needs_review=true
  // 3) Upsert decisions(tx_id, source, confidence, rationale, decided_by='system')
  // 4) Emit PostHog event 'categorization_auto_applied' w/ {confidence, source} when auto-applied
}
```

## Corrections → rules — API and upsert logic

Endpoint: `POST /api/transactions/correct`

- Input: `{ tx_id, new_category_id }`
- Steps:
  1) Load tx (with `org_id`) and previous `category_id`
  2) Update `transactions.category_id = new_category_id`, `reviewed=true`, `needs_review=false`
  3) Insert into `corrections(org_id, tx_id, old_category_id, new_category_id, user_id)`
  4) Generate rule signature: `{ vendor: normalized_merchant_name, mcc?: tx.mcc, desc_tokens?: top tokens }`
  5) Upsert into `rules(org_id, pattern, category_id)`; on conflict(vendor/category) increment `weight`
  6) Emit PostHog event `categorization_corrected` with `{confidence, source}` if available

Notes:

- Normalize vendor consistently (same logic as Pass-1)
- Keep rules simple and precise; avoid overfitting by only using vendor and optional mcc by default

## Embeddings — weekly refresh job

Edge function: `apps/edge/jobs/embeddings-refresh/`

- Query: distinct `merchant_name` per org with ≥ N occurrences (configurable, e.g., N=5)
- Normalize vendor; call OpenAI embeddings (via analytics wrapper) to create vector
- Upsert into `vendor_embeddings(org_id, vendor, embedding, last_refreshed)`
- Log summary metrics per org

SQL already provided above for `vendor_embeddings`. Ensure `vector` extension exists.

## Batch job — (re)categorize queue

Edge function: `apps/edge/jobs/categorize-queue/`

- Select recent transactions where `category_id is null OR needs_review=true`
- For each tx:
  1) `pass1Categorize`
  2) If not decisive (`<0.85`), run `scoreWithLLM`
  3) `decideAndApply(tx.id, result, source)`
- Emit Langfuse traces per tx and per-org summary metrics
- Rate limit per org; use small concurrency to control LLM usage

## UI trust layer — apps/web

Transactions table row changes (e.g., `/apps/web/src/app/(app)/transactions/*`):

- Show category with a confidence pill (e.g., `92%`)
- Add a "Why?" popover that lists `rationale[]` strings (Pass-1/LLM)
- If `needs_review=true`, visually highlight row and display "Accept / Change" actions
- On change: call the correction API; toast success/failure; optimistically update row
- Emit PostHog events for auto-apply and corrections

Minimal props/API required by the row component:

```ts
type TxRowProps = {
  id: string;
  category: { id?: string; name?: string };
  confidence?: number;
  needsReview?: boolean;
  rationale?: string[];
};
```

## Observability and analytics

- Use `packages/analytics` wrappers:
  - Langfuse: trace prompts, model, latency, token counts
  - PostHog: events `categorization_auto_applied`, `categorization_corrected` with `{confidence, source}`
  - Sentry: capture exceptions in jobs and API routes
- Do not hardcode API keys; read from `.env` via existing config util

## Feature flags (optional, centralized)

- Introduce a single flag `CATEGORIZATION_LLM_ENABLED` stored once (enum/const in shared config)
- Check the flag in the queue job and API-based recategorization flows only (avoid scattering checks)

## Guardrails and pitfalls

- Keep amounts as cents strings end-to-end; do not parse floats in prompts
- Normalize vendor names (trim, lowercase, strip punctuation and LLC/Inc)
- Do not let LLM override a high-confidence Pass-1 match
- Cap token usage; pre-trim descriptions; summarize if needed later
- Detect oscillations (flip-flop categories for same vendor); log and quarantine to manual review queue

## Testing and QA

- Unit tests (vitest):
  - Pass-1 signals aggregation and rationale composition (snapshots ok)
  - Vendor normalization and rules matching edge cases
  - LLM scorer parsing/clamping (mock LLM responses)

- Integration tests:
  - `decideAndApply` updates rows and writes decisions
  - Corrections route writes correction and upserts/increments rule weight

- E2E (Playwright):
  - Transactions list shows confidence pill and "Why?" popover
  - Review flow Accept/Change triggers API and updates UI

## Rollout plan

1) Ship migrations and `pass1` only; backfill existing tx with Pass-1 → low risk
2) Enable queue job to run Pass-1 exclusively; validate metrics
3) Enable LLM scorer behind feature flag for test orgs; monitor Langfuse and cost
4) Remove flag for general availability; keep the queue cadence conservative

## Acceptance criteria

- ≥ 90% baseline accuracy on salon taxonomy across seed data (`1 - error rate on first decision` computed via `corrections`)
- Every decision displays at least one rationale in the UI popover
- Auto-apply threshold works; review queue contains only `< 0.85` confidence
- Corrections generate rules and weight increases; future same-vendor tx auto-categorize
- Weekly embeddings job runs; nearest-neighbor boosts observable in logs
- Langfuse shows prompt/latency; PostHog shows correction funnel

## Implementation checklist (high level)

- Packages
  - [x] `packages/categorizer/src/pass1.ts`
  - [x] `packages/categorizer/src/pass2_llm.ts`
  - [x] `packages/categorizer/src/index.ts`
- Services
  - [x] `services/categorizer/apply.ts`
- Web
  - [x] `apps/web/src/app/api/transactions/correct/route.ts`
  - [ ] **UI: confidence pill, rationale popover, review actions** *(to be implemented)*
- Edge Jobs
  - [x] `apps/edge/jobs/categorize-queue`
  - [x] `apps/edge/jobs/embeddings-refresh`
- DB
  - [x] Migrations: `needs_review`, `decisions`, `corrections`, `vendor_embeddings`, indexes
- Analytics
  - [x] Langfuse traces, PostHog events, Sentry coverage

### Current Status (Database Migration Complete)

✅ **Backend Implementation: COMPLETE**
- All categorization modules, services, and jobs implemented
- Database schema applied with all required tables and indexes
- API endpoints ready for corrections and transaction listing
- Analytics integration in place

❌ **Frontend Implementation: PENDING**
- UI trust layer (confidence pills, rationale popovers, review actions) to be implemented
- Transaction table enhancements needed for categorization display
- Review workflow UI components required


