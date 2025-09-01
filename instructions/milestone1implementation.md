### Milestone 1 — Onboarding, Auth & Orgs (Days 2–4) — Implementation Plan

Goals
- Enable Supabase Auth end-to-end in `apps/web` with protected app surfaces.
- Implement org onboarding with minimal KYC, set current org, and route to `/(app)/dashboard`.
- Enforce org scoping across server actions and API routes with RLS.
- Ship an empty-state dashboard and identify users/orgs in PostHog.
- Cover core happy path with Playwright e2e; verify RLS isolation via a negative check.

Constraints and guidelines (from CLAUDE.md)
- TDD-first for API routes and helpers where practical (C-1, T-2, T-4).
- Use branded ID types from `@nexus/types` (C-5). Keep validation via Zod contracts in `packages/types/src/contracts.ts`.
- Scope all DB operations by `orgId` and rely on RLS (S-1). Prefer Supabase client types (S-2).
- Keep code small, composable functions; colocate simple route tests next to handlers when feasible.
- Lint, typecheck, and prettier must pass (G-1, G-2). Use Conventional Commits (GH-1).

Environment and config
- Supabase: ensure the following are configured in `apps/web` runtime:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (only for server environments where needed; not exposed to browser)
- PostHog: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (optional; defaults to `https://app.posthog.com`).
- Sentry: use existing `apps/web/sentry.*.ts` configs; set DSN via env.

Repo context (what already exists)
- Auth pages: `/(auth)/sign-in` and `/(auth)/sign-up` exist and call Supabase.
- Route protection: `apps/web/src/middleware.ts` already redirects unauthenticated users to `/sign-in` for key app pages.
- Org API (stub): `apps/web/src/app/api/auth/org/create/route.ts` validates payload and returns a stub `orgId`.
- Org guard: `apps/web/src/lib/api/with-org.ts` verifies the user belongs to an `orgId` passed by caller.
- Contracts: Zod schemas and branded types live in `packages/types/src/contracts.ts`.
- Analytics providers: `apps/web/src/providers.tsx` includes `PostHogProvider` but no identify on session.
- OrgSwitcher is a stub UI.

Workstream 1 — Supabase Auth wired end-to-end
1. Create Supabase client helpers
   - Add `apps/web/src/lib/supabase.ts`:
     - `createClient` for client components (`createClientComponentClient`).
     - `createServerClient` for server components/route handlers (`createServerComponentClient`).
     - `createMiddlewareClient` wrapper for `middleware.ts`.
   - Centralize imports to reduce duplication across routes and helpers.

2. Route protection via middleware
   - Update `apps/web/src/middleware.ts` to guard all `/(app)/**` and app-like paths by default:
     - Keep auth pages (`/sign-in`, `/sign-up`, `/reset-password`) public.
     - Unauthenticated → redirect to `/sign-in`.
     - Root `/` → redirect to `/dashboard` if signed in, else `/sign-in`.
   - Ensure matcher covers `/_next/*`, `public/*` exclusions as it already does.

3. Auth pages and actions
   - Keep existing `/(auth)/sign-in` and `/(auth)/sign-up` forms.
   - Add `/(auth)/reset-password/page.tsx`:
     - Step A: request reset link via `supabase.auth.resetPasswordForEmail`.
     - Step B: handle hash-based callback to set new password via `supabase.auth.updateUser`.
   - Add basic error toasts (shadcn `useToast`) on auth errors.

4. Post-sign-in redirect logic
   - On successful auth (sign in/up):
     - Server-side check in middleware or initial app layout load: query `user_org_roles` for user.
     - If no org: redirect to `/onboarding`.
     - Else: ensure `orgId` cookie is set to a valid membership; send to `/dashboard`.

Workstream 2 — Org creation flow (+ minimal KYC)
1. Onboarding wizard UI
   - Add `apps/web/src/app/(app)/onboarding/page.tsx`:
     - Single form capturing: `name`, `industry` (default “Salon/Beauty”), `timezone`, `taxYearStart`.
     - Client-side Zod validation mirroring `OrgCreateRequest`.
     - On submit, POST to `/api/auth/org/create`.

2. Implement POST /api/auth/org.create
   - File: `apps/web/src/app/api/auth/org/create/route.ts` (already exists; replace stub):
     - Auth: require session via `createServerComponentClient`.
     - Validate with `orgCreateRequestSchema` from `@nexus/types/contracts`.
     - Insert into `orgs` table and capture generated `org_id`.
     - Insert into `user_org_roles` with role `owner` for the user.
     - Seed org categories: copy global defaults into `org_categories` for the new `org_id`.
       - Use a single SQL statement (INSERT INTO ... SELECT FROM global defaults) to avoid roundtrips, or a small server-side loop if needed.
     - Return `{ orgId }` on success; JSON error on failure (400/401/500 via existing helpers).
     - Set `orgId` cookie on success using `cookies().set("orgId", orgId)` for subsequent requests.

3. After-create redirect
   - In onboarding page, upon 200 response, set router to `/dashboard` and refresh.

4. OrgSwitcher
   - Update `apps/web/src/components/org-switcher.tsx` to:
     - Fetch memberships from `user_org_roles` for the session user.
     - Display current org (from `orgId` cookie) and a dropdown of other orgs.
     - On selection: update `orgId` cookie and `router.refresh()` to re-scope the app.

Workstream 3 — Enforce org scoping everywhere
1. `withOrg` helper enhancements
   - File: `apps/web/src/lib/api/with-org.ts`:
     - Add `withOrgFromRequest(request: NextRequest)` that:
       - Reads session user (existing logic).
       - Resolves `orgId` from precedence: `x-org-id` header → `orgId` cookie → query param (`orgId`).
       - Verifies membership via `user_org_roles` as current helper does.
       - Returns `{ userId, orgId }` or 403 JSON on violation.
     - Keep existing `withOrg(orgId)` for routes that validate `orgId` via contracts to ensure equality with cookie/header when both present.

2. Wrap API handlers
   - Ensure these routes call `withOrg`/`withOrgFromRequest` before doing any work:
     - `apps/web/src/app/api/connections/**` (list/create)
     - `apps/web/src/app/api/transactions/**` (list)
     - `apps/web/src/app/api/exports/**` (create)
   - Return 403 JSON using `createErrorResponse` on scope violations.

3. RLS verification (quick negative test)
   - With two users A and B and orgs A1 and B1:
     - Sign in as A, set cookie to B1, call any scoped API with `orgId=B1` → expect 403.
     - Ensure DB RLS policies in `packages/db/migrations/002_rls.sql` align; adjust if needed.

Workstream 4 — Empty dashboard state + analytics
1. Empty dashboard
   - Update `apps/web/src/app/(app)/dashboard/page.tsx` to render an empty-state when there are 0 connections for the current `orgId`:
     - CTA: “Connect your bank to get started” → links to connections page (placeholder route).
     - Counts set to zero; chart placeholders remain.

2. PostHog identify on session
   - In `apps/web/src/app/(app)/layout.tsx` or `apps/web/src/providers.tsx` client context:
     - On mount, fetch session. If present, call `posthog.identify(user.id, { orgId })`.
     - Ensure `orgId` is read from cookie and passed as a PostHog person property.

3. Sentry
   - Confirm `sentry.client.config.ts`/`sentry.server.config.ts` are wired. Verify DSN present.

Testing strategy (Playwright e2e)
- Add `apps/web/tests/e2e/onboarding.spec.ts` covering:
  1) Visit `/sign-up` → create test user → redirect to `/onboarding`.
  2) Complete onboarding form → 201 → redirected to `/dashboard`.
  3) Assert org name is visible (from OrgSwitcher) and empty-state CTA present.
- Add a simple negative test for org scoping:
  - Manually set an `orgId` cookie not belonging to the user and call `/api/connections/list?orgId=...` → expect 403.

Files to add/update
- Add: `apps/web/src/lib/supabase.ts` (client/server/middleware helpers)
- Add: `apps/web/src/app/(auth)/reset-password/page.tsx`
- Add: `apps/web/src/app/(app)/onboarding/page.tsx`
- Update: `apps/web/src/middleware.ts` (matcher + redirects; onboarding redirect if no org)
- Update: `apps/web/src/app/api/auth/org/create/route.ts` (implement inserts + seeding + cookie)
- Update: `apps/web/src/lib/api/with-org.ts` (add `withOrgFromRequest`)
- Update: `apps/web/src/app/api/connections/*` `transactions/*` `exports/*` to call `withOrg` and return 403 JSON on violation
- Update: `apps/web/src/app/(app)/dashboard/page.tsx` (empty state)
- Update: `apps/web/src/app/(app)/layout.tsx` or `apps/web/src/providers.tsx` to add PostHog identify
- Update: `apps/web/src/components/org-switcher.tsx` (list memberships, select current org)
- Add: `apps/web/tests/e2e/onboarding.spec.ts`

Acceptance and Done
- New user can sign up → sees `/onboarding` on first run → creates org → lands on `/dashboard` empty state scoped to that org.
- RLS blocks cross-org access, verified via negative API call.
- PostHog identify fires with `{ distinct_id: user.id, orgId }`; Sentry captures errors.
- `pnpm run lint`, `pnpm run typecheck`, `pnpm -w exec playwright test` all pass.

Open questions / assumptions
- Category seeding: assume a `global_categories` or similar source exists; if not, add a small static set in `packages/db/seeds` and copy.
- Role naming: using `owner` for creator; confirm allowed values in DB.
- Connections page route is a future milestone; for CTA we can link to a placeholder or `/connections` stub.

Rollback plan
- Changes are mostly additive. If issues arise, revert UI changes and disable onboarding redirect in middleware to restore current behavior. API route can return the previous stub while investigating DB issues.


