## Transactions Page Enhancements — Implementation Plan (Claude Code optimized)

### Goal
Elevate the Transactions page to support accurate merchant/account display, robust categorization with confidence warnings and manual corrections, and a comprehensive filter toolbar.

### Scope (What we’ll build)
- Table columns: Date, Description, Merchant, Account (bank account name), Category (with low-confidence warning + dropdown), Amount, Actions.
- Category confidence warning: show if confidence < 95% (confidence in 0–1). Highlight as “Low”.
- Category correction: inline dropdown to update `category_id` via existing `/api/transactions/correct` endpoint with optimistic update.
- Filters toolbar: search (description/merchant), merchant text, account (bank account name), category, date range, min/max amount, toggle “Only low-confidence (<95%)”.
- Replace “Source” with Account (bank account name via join).

### Non-goals
- No changes to server DB schema. We will rely on existing columns: `account_id`, `category_id`, `confidence`, `needs_review`.
- No back-end filtering/pagination changes in the first iteration (client-side filtering initially). We’ll outline optional follow-up for server-side filtering.

## Architecture Overview

### Data model and joins
- Table: `transactions` (already has `account_id`, `category_id`, `confidence`, `needs_review`).
- Join for display:
  - `accounts(name)` via `account_id` → shows bank account name under “Account”.
  - `categories(name)` via `category_id` → shows current category label.

### Key components and pages
- `apps/web/src/app/(app)/transactions/page.tsx`: The main Transactions table page. We will enhance this in-place.
- Reuse patterns from Review UI:
  - `/api/transactions/correct` endpoint already exists and is used in review flows.
  - Category listing is fetched from `categories` table (org-scoped or global).

### Feature flags
- Add a single feature flag to gate the entire enhanced UI: `TRANSACTIONS_ENHANCED_UI`.
  - Define once in a central enum/const (per workspace rules) and use in one callsite in the page to minimize scattering.
  - Validate flag values and fall back to existing UI when disabled.

### Analytics (PostHog)
- Use API key from `.env` (never hardcode). Centralized analytics helper already exists in `packages/analytics` (verify and reuse).
- Event names: define once in a const object (UPPERCASE_WITH_UNDERSCORE), e.g. `TRANSACTIONS_FILTER_CHANGED`, `TRANSACTION_CATEGORY_CORRECTED`, `TRANSACTION_CATEGORY_LOW_CONF_WARNING_SHOWN`.
- Properties:
  - `filter_keys` (array), `low_conf_only` (boolean), `results_count` (number)
  - `old_category_id`, `new_category_id`, `confidence` (number 0–1), `tx_amount_cents` (number)

## UX and Behavior Details

### Table columns
1) Date: localized short date.
2) Description: transaction description as-is.
3) Merchant: `merchant_name` when present; otherwise `-`. If both differ, optionally show secondary muted text with `description` (future polish).
4) Account: bank account display name from `accounts(name)` join. Badge-like pill.
5) Category:
   - Label = `categories.name` or `Uncategorized`.
   - If `confidence < 0.95`, show a visible badge `Low` (destructive/attention style).
   - Inline dropdown to pick a category. On select → call `/api/transactions/correct`, optimistic update `category_id` + label; clear `needs_review`.
6) Amount: formatted currency using existing util/local formatter.
7) Actions: keep “View Raw” modal button.

### Filters toolbar (top of page)
- Inputs:
  - Search (matches `description` or `merchant_name`)
  - Merchant (text)
  - Account (select from distinct `account_name` values)
  - Category (select from categories list)
  - Date range (from/to)
  - Amount min/max (decimal dollars)
  - Checkbox: Only low-confidence (<95%)
- Behavior: client-side filtering over the loaded set; `Refresh` to re-query latest.
- Clear resets all filters.

### Edge cases
- `confidence` null/undefined: do not show low badge.
- Missing `accounts(name)`: display `Unknown`.
- Missing category: show placeholder `Uncategorized`.
- Negative vs positive amounts: keep existing coloring if present (optional future enhancement).

## Implementation Steps

### 1) Add feature flag
- Add to shared flags enum/const (follow existing pattern). Example:
```ts
export const FEATURE_FLAGS = {
  TRANSACTIONS_ENHANCED_UI: 'TRANSACTIONS_ENHANCED_UI',
  // ...
} as const;
```
- Gate enhanced UI at the top-level of `transactions/page.tsx` once.

### 2) Update `transactions/page.tsx` query
- Change Supabase select to include joins and categorization fields:
```ts
.select(`
  id, date, amount_cents, currency, description, merchant_name, source, account_id, raw,
  category_id, confidence, needs_review,
  accounts(name),
  categories(name)
`)
```
- Normalize joined arrays/objects:
```ts
account_name: Array.isArray(t.accounts) ? t.accounts?.[0]?.name : t.accounts?.name,
category_name: Array.isArray(t.categories) ? t.categories?.[0]?.name : t.categories?.name,
```

### 3) Fetch categories for dropdown
- Query `categories` with org or global fallback:
```ts
.from('categories')
.select('id, name')
.or(`org_id.is.null,org_id.eq.${orgId}`)
```

### 4) Build filters state + derived list
- Local state: `search, merchant, account, categoryId, dateFrom, dateTo, minAmount, maxAmount, lowConfidenceOnly`.
- Derived `filteredTransactions` via `useMemo`.
- Distinct accounts: from `transactions.map(t => t.account_name)`.

### 5) Render new columns
- Replace “Source” with “Account” (bank account pill).
- Add “Category” column containing:
  - `Low` badge when `confidence < 0.95`.
  - Category `<Select>` bound to `category_id` with placeholder from `category_name`.
  - On change: POST `/api/transactions/correct` with `{ txId, newCategoryId }`.
  - Optimistic update: set `category_id`, `category_name`, `needs_review=false`.

### 6) Instrument analytics
- Fire on:
  - Filter changed (debounced): `TRANSACTIONS_FILTER_CHANGED` with current filter keys and results count.
  - Category corrected: `TRANSACTION_CATEGORY_CORRECTED` with old/new ids, confidence, amount.
  - Low badge shown (first render per tx): `TRANSACTION_CATEGORY_LOW_CONF_WARNING_SHOWN`.

### 7) Error handling & UX
- Disable category select while saving per-row; show subtle “Saving…” badge if desired.
- On failure, revert optimistic update and show toast.

### 8) Tests
- Unit: filter utility function(s) for correctness of date/amount/confidence logic.
- Integration/E2E: 
  - Filters reflect in table rows.
  - Low-confidence badge renders under threshold.
  - Category correction updates cell and persists after refresh.

### 9) Accessibility
- Ensure inputs have labels or `aria-label`.
- Focus states for dropdowns and buttons.
- Badges include accessible text (e.g., title="Low confidence").

### 10) Performance & future iteration
- Initial: client-side filtering, `limit(200)`.
- Next: server-side filtering and pagination/infinite scroll; leverage `tx_needs_review_idx` and existing transaction indexes. Provide API route or RPC view for parameterized queries.

## Acceptance Criteria
- Account column displays bank account name from `accounts(name)` for all rows (no raw “Plaid”).
- Category column shows current category or `Uncategorized`.
- For transactions with `confidence < 0.95`, a visible “Low” badge appears.
- Dropdown successfully changes category and persists on refresh.
- Filter bar supports: search, merchant, account, category, date range, min/max, low-confidence toggle.
- Clear resets all filters; Refresh re-fetches data.
- All gated behind `TRANSACTIONS_ENHANCED_UI` and can be toggled off.

## Risks & Mitigations
- Missing joins (accounts/categories): show safe fallbacks; do not break rendering.
- Large datasets: initial load limited; follow-up for server-side filtering.
- Over-scattered flags: keep a single UI gate as per workspace rules.
- Analytics noise: debounce filter-changed tracking; guard flag values.

## Rollout Plan
1) Ship behind `TRANSACTIONS_ENHANCED_UI` disabled.
2) Enable for internal org(s), validate analytics events and UX.
3) Gradually enable for more orgs; monitor error rates and engagement.
4) Make the feature default; optionally remove flag after bake-in.

## Implementation Checklist (copy/paste friendly)
- [ ] Add `TRANSACTIONS_ENHANCED_UI` enum/const.
- [ ] Wire feature flag in `transactions/page.tsx`.
- [ ] Extend Supabase select with `accounts(name)`, `categories(name)`, `category_id`, `confidence`, `needs_review`.
- [ ] Normalize joined fields to `account_name`, `category_name`.
- [ ] Fetch categories list (org/global), store in state.
- [ ] Build filters state and derived list; render toolbar UI.
- [ ] Replace “Source” with “Account” column (bank account pill).
- [ ] Add Category column: low badge + dropdown, POST to `/api/transactions/correct`, optimistic update.
- [ ] Hook up analytics events with centralized helper; guard with env key.
- [ ] Add unit tests for filter logic; write E2E for filters and correction.
- [ ] QA, accessibility pass, copy tweaks.
- [ ] Rollout via feature flag.

## Snippets (reference)

### Supabase select with joins
```ts
.from('transactions')
.select(`
  id, date, amount_cents, currency, description, merchant_name, source, account_id, raw,
  category_id, confidence, needs_review,
  accounts(name),
  categories(name)
`)
.eq('org_id', orgId)
.order('date', { ascending: false })
.limit(200);
```

### Low confidence check
```ts
const LOW_CONFIDENCE_THRESHOLD = 0.95;
const isLow = typeof tx.confidence === 'number' && tx.confidence < LOW_CONFIDENCE_THRESHOLD;
```

### Category correction request
```ts
await fetch('/api/transactions/correct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ txId, newCategoryId }),
});
```

### Analytics constants example
```ts
export const ANALYTICS_EVENTS = {
  TRANSACTIONS_FILTER_CHANGED: 'TRANSACTIONS_FILTER_CHANGED',
  TRANSACTION_CATEGORY_CORRECTED: 'TRANSACTION_CATEGORY_CORRECTED',
  TRANSACTION_CATEGORY_LOW_CONF_WARNING_SHOWN: 'TRANSACTION_CATEGORY_LOW_CONF_WARNING_SHOWN',
} as const;
```

## Notes on Chart of Accounts
- Ensure categories exist in the `categories` table for: utilities, marketing, food and bev, salary, revenue, misc.
- If absent, add seeds/migrations or an admin UI step prior to rollout.


