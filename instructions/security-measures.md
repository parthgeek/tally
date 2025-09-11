## Security Hardening Plan (Implementation Guide for Claude Code)

This document specifies concrete, incremental edits to harden the Nexus project before connecting real bank accounts. Steps are grouped by concern and include exact files, suggested code shapes, and verifications. Execute in order. Keep changes small and test after each.

### Scope
- Apps: `apps/web` (Next.js) and `apps/edge` (Supabase Edge Functions)
- Packages: `packages/db` (SQL migrations), `packages/shared` (config)
- Third parties: Plaid, Supabase, Sentry, PostHog

---

## 1) Enforce Plaid Webhook Signature Verification (prod-required)

Goal: Ensure only authentic Plaid webhooks are processed. Reject unsigned webhooks in production.

Files to edit:
- `apps/edge/plaid/webhook/index.ts`

Edits:
1. Fail closed in production if `PLAID_WEBHOOK_SECRET` is missing.
   - Detect environment via `Deno.env.get('PLAID_ENV')` or separate `NODE_ENV`/`ENVIRONMENT` var if present.
   - In prod-like envs (`development`/`production`), immediately return `401` if secret is not set.

2. Keep current HMAC-SHA256 derivation but treat header name consistently.
   - Current header used: `plaid-verification` → keep it for consistency with existing code.
   - Compare computed `sha256=<hex>` against provided header.

3. Minimize logging on failures (no payload echo). Log only webhook_type/code and request_id if provided.

Verification:
- Unit/integration test to assert:
  - Missing secret in prod → 401
  - Invalid signature → 401
  - Valid signature → 200, and triggers downstream sync for expected webhook codes

---

## 2) Add Security Headers and CSP in Next.js

Goal: Add a strong baseline of browser hardening headers. Start strict, then tune as needed for integrations.

Files to edit:
- `apps/web/next.config.ts`

Edits:
1. Add `async headers()` returning a global header set:
   - `Content-Security-Policy` (initial, then refine):
     - default-src 'self';
     - connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://*.sentry.io;
     - script-src 'self' https://cdn.plaid.com https://us.i.posthog.com https://*.sentry.io 'unsafe-inline' 'unsafe-eval';
     - frame-ancestors 'self';
     - img-src 'self' data: blob: https://*.posthog.com;
     - style-src 'self' 'unsafe-inline';
     - frame-src https://cdn.plaid.com;
     - base-uri 'self'; form-action 'self';
     - upgrade-insecure-requests;
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (only enable when HTTPS everywhere)
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY` (redundant with CSP frame-ancestors; keep both for legacy)
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy` limiting camera/mic/geolocation/etc. to none by default

Notes:
- The initial CSP includes `'unsafe-inline'/'unsafe-eval'` to avoid breaking dev; migrate to nonces later. Keep entries for Plaid, Sentry, PostHog, Supabase endpoints used by the app.

Verification:
- Open app and check Network → Response Headers on any page. Confirm headers exist and site still functions (Plaid Link, analytics, Supabase calls).

---

## 3) Rate Limiting for Sensitive Endpoints

Goal: Prevent abuse/brute force against API routes and edge functions.

Files to add/edit:
- Add `apps/web/src/lib/rate-limit.ts`
- Edit these handlers to apply rate limits near the top:
  - `apps/web/src/app/api/plaid/link-token/route.ts`
  - `apps/web/src/app/api/plaid/exchange/route.ts`
  - Optionally: other POST endpoints under `/api/transactions/*`, `/api/rules/*`, `/api/receipts/*`

Implementation options:
1) In-memory token bucket (dev/testing): keyed by IP and/or userId; short burst, small window.
2) Production: Upstash Redis or Supabase RLS-backed counter. Prefer Redis to survive serverless restarts.

Recommended shape (library-free):
- `allow({ key: string, limit: number, windowMs: number }): Promise<boolean>` using Redis if available, else memory map.
- In each route: compute key (userId if auth’d else IP), call `allow()`, return 429 on exceed.

Verification:
- Unit test: exceed threshold returns 429 with `Retry-After` header.

---

## 4) Input Validation with Zod on API Routes

Goal: Validate and sanitize request payloads to reduce misuse and log noise.

Files to edit:
- `apps/web/src/app/api/plaid/exchange/route.ts` (validate body)
- Optionally add a common helper: `apps/web/src/lib/validation.ts`

Schemas (examples):
- Exchange body:
  - `public_token`: string().min(10).max(500)
  - `metadata`: object({ institution_id: string().optional() }).passthrough() (do not trust nested data)

Handler pattern:
- Parse with Zod → on error, return `createValidationErrorResponse()` (already exists) with 400.
- Only forward validated fields to Edge Function.

Verification:
- Tests: invalid types/empty tokens return 400; valid passes through.

---

## 5) Remove Legacy Token Fallback in Production

Goal: Ensure all stored Plaid access tokens use AES‑GCM; do not accept legacy base64 in prod.

Files to edit:
- `apps/edge/_shared/encryption.ts` (keep AES-GCM; gate fallback)
- `apps/edge/_shared/database.ts` (use strict decrypt in prod)

Edits:
1. Introduce an environment toggle `ALLOW_LEGACY_TOKEN_FALLBACK` (default false in prod).
2. In `decryptAccessTokenWithFallback`, short‑circuit to strict decrypt when flag is false.
3. Replace imports/usages in `database.ts` with a small wrapper that enforces the flag.

One-time cleanup (optional):
- Add a maintenance script (Edge function or admin script) that scans `connection_secrets` and re-encrypts any legacy tokens (if any) using AES‑GCM.

Verification:
- In prod-like env, legacy tokens cause explicit error (none expected for fresh installs). In dev with flag true, legacy still works.

---

## 6) Database Function Hardening (search_path & security)

Goal: Remove DB lints and reduce risk of function hijacking/privilege confusion.

Artifacts:
- `sb-security.md` flags:
  - SECURITY DEFINER view on `public.review_queue`
  - Mutable `search_path` on: `public.normalize_vendor`, `public.bulk_correct_transactions`, `public.update_normalized_vendors`, `public.user_in_org`

Files to add/edit:
- Create a migration: `packages/db/migrations/012_security_hardening.sql`

Edits in migration:
1. Ensure functions are `SECURITY INVOKER` unless a definers’ context is required.
2. Explicitly set `search_path`:
   - `ALTER FUNCTION public.normalize_vendor(...) SET search_path = public, pg_temp;`
   - Repeat for the listed functions.
3. For `review_queue` view:
   - Keep `security_barrier = true` (already set in prior migrations) and ensure no unintended privilege escalation. If SECURITY DEFINER is required, document why; otherwise, redefine as standard view.

Verification:
- Re-run Supabase lints. Expect removal of security_definer and search_path warnings.

---

## 7) Logging Hygiene and Secrets Handling

Goal: Prevent sensitive data leakage via logs.

Files to review/edit:
- Server/API routes under `apps/web/src/app/api/**`
- Edge functions under `apps/edge/**`

Actions:
- Ensure no Plaid access tokens, session JWTs, or secrets are logged.
- In error paths printing Axios/Fetch errors, redact response bodies when they may contain PII; log only status, error_code, request_id.

Verification:
- Grep for `console.*(` additions; ensure redaction helpers are used.

---

## 8) Configuration Guardrails

Goal: Fail fast when critical env vars are missing/malformed.

Files to edit:
- `apps/web/src/lib/plaid/client.ts`
- `packages/shared/src/config.ts`

Actions:
- Confirm guards already exist for `PLAID_CLIENT_ID`, `PLAID_SECRET`, `NEXT_PUBLIC_SITE_URL`. Keep them strict.
- Add explicit length check for `ENCRYPTION_KEY` ≥ 32 chars in Edge runtime; throw with precise message.

Verification:
- Unit tests: deleting each required env produces a helpful error.

---

## 9) Tests to Add/Update

Add coverage for the new controls:
- Webhook signature: valid/invalid/missing-secret cases
- Rate limiting: 429 after threshold; includes `Retry-After`
- Zod validation: 400 on invalid exchange body
- CSP headers present on a sample route
- Strict decrypt path when legacy fallback disabled
- DB migration assertions (smoke) to verify function properties

Suggested locations:
- `apps/edge/plaid/webhook/webhook.test.ts` (extend)
- `apps/web/src/test/` for API route tests
- `packages/db/scripts/` to run lint checks in CI after migrations

---

## 10) Rollout Plan

1. Implement and test locally.
2. Deploy to staging with:
   - `PLAID_WEBHOOK_SECRET` set
   - Strong `ENCRYPTION_KEY` (≥32 chars)
   - Updated Plaid Dashboard: redirect URI and webhook URL exact matches
3. Validate web/app functionality (Plaid Link flow, webhook ingestion, sync jobs).
4. Enable HSTS preload only after confirming HTTPS everywhere.
5. Promote to production.

---

## Checklists

### Code changes
- [ ] Webhook: fail closed if missing secret in prod; verify HMAC header
- [ ] Security headers & CSP returned on all routes
- [ ] Rate limiting applied to sensitive API routes & edge functions
- [ ] Zod validation on `POST /api/plaid/exchange`
- [ ] Legacy token fallback disabled in prod (strict AES‑GCM)
- [ ] DB migration for `search_path` and view/function security
- [ ] Logging redaction in error paths

### Config-only
- [ ] `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`
- [ ] `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ENCRYPTION_KEY` (≥ 32 chars, randomized)
- [ ] `PLAID_WEBHOOK_SECRET` set in Supabase Edge Functions env
- [ ] Plaid Dashboard: Allowed redirect URIs & webhook URL

---

## Notes for Claude Code
- Prefer small, targeted edits. Do not refactor unrelated code.
- Preserve existing logging style but redact PII/secrets.
- Keep feature flags minimal and centralized; do not spread the same flag across multiple files.
- For CSP, start with the provided policy; if something breaks, whitelist with the narrowest domain/protocol needed.
- For rate limiting, implement a small utility first; wire it into the two Plaid endpoints; expand later if required.

