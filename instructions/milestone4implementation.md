## Milestone 4 — Dashboard v0 (Days 10–12) — Implementation Plan

### Overview
Goal: Ship a v0 dashboard that surfaces cash on hand, safe-to-spend, recent inflow/outflow aggregates, top expense categories, a spend trend badge, and alert chips; wired to live data, responds to re-categorization, and is instrumented with PostHog.

Architecture alignment:
- Backend/API: We use Supabase PostgREST from Next.js API routes, not Kysely. We’ll compute aggregates with SQL where convenient and finish calculations in TypeScript for clarity and performance v0. We’ll scope by `orgId` using existing `withOrgFromRequest` helper.
- Data: Money remains integer cents end-to-end, represented as strings in TypeScript. DB stores existing `transactions.amount_cents` as bigint; new columns will be text, with casts in queries.
- UI: Next.js App Router; keep current client page pattern and fetch via TanStack Query to leverage the already-configured `QueryClientProvider`. Charts via `recharts`.
- Analytics: Use centralized `@nexus/analytics` PostHog clients already wired in providers.

---

### 1) Data surfaces (API)
Create `apps/web/src/app/api/dashboard/route.ts` (Edge-compatible RSC API route) returning one JSON payload per current org. Use `withOrgFromRequest(request)` for scoping and `createServerClient()` for Supabase access. Response type:

```ts
type DashboardDTO = {
  cashOnHandCents: string;
  safeToSpend14Cents: string;
  inflowOutflow: {
    d30: { inflowCents: string; outflowCents: string; dailyAvgInflowCents: string; dailyAvgOutflowCents: string };
    d90: { inflowCents: string; outflowCents: string };
  };
  topExpenses30: Array<{ categoryId: string; name: string; cents: string }>;
  trend: { outflowDeltaPct: number }; // + means higher spend vs prior 30d
  alerts: { lowBalance: boolean; unusualSpend: boolean; needsReviewCount: number };
  generatedAt: string;
};
```

Implementation details:
- A. Cash on hand
  - Sum `accounts.current_balance_cents::bigint` for active liquid accounts: `type in ('checking','savings','cash') AND is_active = true`. Default missing/NULL balances to `'0'` on write; still coalesce in query.

- B. In/Out aggregates (30d & 90d)
  - Fetch sums by window using sign from `transactions.amount_cents` (bigint). Convention: positive = inflow, negative = outflow.
  - 30d: compute `inflowCents`, `outflowCents` and divide by 30 for daily averages (use integer division to cents, keep string). 90d: same without daily averages.
  - Filter: `org_id = :orgId AND date BETWEEN :from AND :to` and exclude soft-deleted if applicable.

- C. Top 5 expense categories (30d)
  - Outflows only (amount negative), group by `category_id`, sum absolute cents, join `categories.name`, order desc, limit 5. Handle uncategorized with name `'Uncategorized'`.

- D. Trend vs last month
  - Compare total outflows for `curr_30` vs `prev_30` (previous 30 days window). Return `pctDelta(curr, prev)` as signed percent; positive means higher spend.

- E. Alerts
  - `low_balance`: `cash_on_hand < (orgs.low_balance_threshold_cents::bigint OR 100000)`.
  - `unusual_spend`: compute weekly outflow series for last ~12 weeks, exclude this week as baseline. z-score of latest full week against mean/stddev of previous 8–12 weeks.
  - `needs_review_count`: `count(*) FROM transactions WHERE org_id=:org AND needs_review = true`.

Notes:
- Keep all intermediate math in bigint where possible and convert to string at the boundary. For percent/z-score calculations, operate in numbers (JS), never floats for cents arithmetic; only convert to numbers for the final dimensionless statistics.
- v0 computes aggregates in the API handler with straightforward queries and in-process reductions. Optimize later if needed (e.g., RPC), guarded by tests.

Caching:
- Add a `Cache-Control: s-maxage=30, stale-while-revalidate=120` header on the API response. React Query also provides client caching.

Error handling:
- If any term missing, treat as 0. Never return NaN; default percentages to 0 when denominator=0; z-score falsey if not enough history (baseline < 4 samples).

---

### 2) Safe-to-Spend (14d)
Compute in API route after building base metrics:
`s2s14 = cashOnHand + 14*avgDailyInflow30 - 14*avgDailyOutflow30 - reservedFixed14`.
- `reservedFixed14` v0 = 0. If we later detect rules for Rent/Utilities/Software, subtract the average per 14 days. Guard NaN and allow negative results.

---

### 3) Keep balances fresh (Plaid)
Update Edge functions to upsert `accounts.current_balance_cents` from `/accounts/get` on both exchange and daily sync:
- Schema: new column (see Migrations below). Store cents as string `'0'` default when Plaid omits.
- Edit `apps/edge/_shared/account-service.ts`:
  - `NormalizedAccount` gains `current_balance_cents?: string`.
  - In `transformPlaidAccounts`, set `current_balance_cents` from `balances.current` (to cents string, default `'0'`).
  - `upsertAccounts` includes the new column.
- Ensure `/plaid/exchange` triggers `sync-accounts` (already does) and daily job triggers account sync before transaction sync:
  - Edit `apps/edge/jobs/plaid-daily-sync/index.ts` to POST `plaid/sync-accounts` per connection before `plaid/sync-transactions`.

---

### 4) Shared helpers
Add `packages/shared/src/finance.ts` that composes existing `money.ts` utilities:
- `sumCents(strings: string[]): string` — reduce with bigint; ignore non-numeric by treating as 0.
- `pctDelta(curr: number, prev: number): number` — return 0 if `prev===0`, else `((curr - prev) / prev) * 100`, round to 1 decimal.
- `zScore(value: number, samples: number[]): number` — compute mean/stddev; if `samples.length < 4` or `stddev===0`, return 0.
- `toUSD(cents: string): string` — thin wrapper over `money.formatCurrency`.
Export from `packages/shared/src/index.ts`.

---

### 5) Dashboard API route
File: `apps/web/src/app/api/dashboard/route.ts`
- Runtime: default (works on Edge too). Use `withOrgFromRequest` for auth/org.
- Steps:
  1) Resolve windows: `today`, `d30_from`, `d90_from`, `prev30_from`, `prev30_to`, `week windows`.
  2) Queries:
     - Accounts sum for cash on hand (coalesce to 0). Cast text→bigint.
     - Transactions in windows (select minimal fields: amount_cents, date, category_id). Compute inflow/outflow splits and sums in TS.
     - Top-5 categories (either SQL `group by` with join or reduce in TS after selecting `category_id` and a small categories map).
     - Weekly outflows series: `date_trunc('week', date)` SQL group or TS bucketing; exclude current week for baseline.
     - Needs-review count.
  3) Build `DashboardDTO`, ensure all cents are strings and booleans/number stats are sane.
  4) Add cache headers.

---

### 6) UI: Dashboard page
File: `apps/web/src/app/(app)/dashboard/page.tsx`
- Replace placeholder cards with live data sourced via React Query from `/api/dashboard`.
- Header cards (shadcn Cards):
  - Cash on Hand, Safe-to-Spend (14d), Needs Review.
  - Use `toUSD` for amounts; show `—` and tooltip if missing.
- Charts row:
  - Bar chart (recharts): cash-in vs cash-out, with toggle between 30d and 90d.
  - Donut: top 5 expense categories (30d).
  - Sparkline: weekly outflow trend with Δ% badge from API’s `trend.outflowDeltaPct`.
- Alerts row:
  - Chips for low balance / unusual spend; click-through to `/settings/thresholds` and `/review` respectively.
- Accessibility: `aria-label` on charts and alert chips, focus styles, color-contrast friendly palette.

Dependencies:
- Add `recharts` to `apps/web` and basic chart primitives.

Caching & refresh:
- React Query key: `['dashboard', orgId]`, default `staleTime` from `Providers` (60s). The API also sets 30s s-maxage; duplicated cache is acceptable v0.

---

### 7) Live updates after re-categorization
- When user corrects a transaction (existing `POST /api/transactions/correct`), after success, invalidate the dashboard query: `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` in the correction flow component.
- Server-driven: also revalidate path `/dashboard` if using server actions later.

---

### 8) PostHog instrumentation
- On dashboard mount: `dashboard_viewed { orgId }`.
- Range toggle: `dashboard_toggle_range { range: '30d'|'90d' }`.
- Alert clicked: `dashboard_alert_clicked { type: 'low_balance'|'unusual_spend'|'needs_review' }`.
- Chart hover (throttled): `dashboard_chart_hover { chart: 'inout'|'top5'|'trend' }`.
Use `@nexus/analytics` browser client via `usePostHog()` from provider.

---

### 9) Migrations
Add a new migration in `packages/db/migrations/`:
- `alter table accounts add column if not exists current_balance_cents text default '0';`
- `alter table orgs add column if not exists low_balance_threshold_cents text default '100000';`
- Optional: materialized view for weekly outflows for performance; refresh in daily job.

Indexing:
- Ensure `idx_accounts_org_id`, `idx_transactions_date`, and `idx_transactions_org_id` exist. Add date index if missing.

---

### 10) Acceptance checklist mapping
- Cash on hand and Safe-to-Spend sourced live from DB via API; cards render.
- In/Out bar charts populate for 30d/90d; donut shows top 5 expense categories (30d).
- Trend badge shows Δ% vs prior 30d (positive => higher spend).
- Alerts: low balance toggles using threshold; unusual spend uses weekly z-score; needs-review count matches `/review` filter.
- After re-categorization, metrics reflect updated categories after query invalidation/refresh.
- PostHog events fired on view and interactions.

---

### 11) Pitfalls & guardrails
- Cents remain strings at the edges; cast to bigint only inside queries; never use floats for money arithmetic.
- Do not block on LLM; use stored data only.
- Degrade gracefully for missing data (show `—`, tooltips).
- Cache API for ~30s; always bust on mutation via query invalidation.
- Unusual spend baseline excludes the most recent week.
- For text columns used in sums, always cast to bigint in SQL to avoid type errors.

---

### 12) Testing
- Unit tests in `packages/shared` for `finance.ts`: `sumCents`, `pctDelta`, `zScore`, `toUSD`.
- API route tests: validate DTO shape and edge cases (no data, only inflow/outflow, missing balances).
- UI tests (Playwright): cards render with data; toggle range updates bars; alert chips navigate; PostHog capture mocked.
- E2E happy path: connect Plaid (seeded), sync, dashboard displays numbers; change category in `/review`, dashboard updates after invalidate.

---

### Implementation Steps (sequenced)
1) DB migration for new columns and indexes.
2) Edge functions: update account transform/upsert; daily sync to call `sync-accounts` prior to transactions.
3) Shared helpers: add `finance.ts`, export from `index.ts`.
4) API: implement `/api/dashboard` route with org scoping, queries, computations, cache headers.
5) UI: install `recharts`, refactor dashboard page to fetch DTO via React Query, render cards + charts + alerts with accessibility.
6) Wire PostHog events.
7) Hook invalidation after re-categorization success.
8) Tests: shared utilities, API, and UI.



