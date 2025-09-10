### Goal
- Restore successful Vercel deployments for `apps/web` by addressing lint errors and build warnings reported in the Vercel logs.
- Keep quality high: fix critical issues in code, and tune ESLint to avoid blocking on tests. Provide optional remediation for warnings.

### Root Causes (from Vercel logs)
- **Blocking ESLint errors**:
  - React hooks called conditionally (`react-hooks/rules-of-hooks`) in `src/components/review/bulk-action-bar.tsx`.
  - Many `@typescript-eslint/no-explicit-any` errors across app and tests.
  - `react/no-unescaped-entities` in `src/app/(app)/settings/thresholds/page.tsx`.
  - `@typescript-eslint/no-empty-object-type` in `src/components/ui/command.tsx`.
  - `react/display-name` in a test: `src/hooks/use-dashboard.spec.ts`.
- **Non-blocking warnings**:
  - Turbopack externals: `import-in-the-middle` / `require-in-the-middle` due to Sentry/Otel.
  - pnpm “Ignored build scripts” (Sentry CLI, sharp, etc.).

### Implementation Strategy
- Prioritize code fixes that improve correctness and pass strict rules.
- Use ESLint overrides to relax rules in test files only.
- Optionally add Next.js `eslint.ignoreDuringBuilds` to unblock quickly (toggleable if needed), but prefer fixing core issues.

---

## Step 1: Fix conditional hooks in bulk-action-bar
File: `apps/web/src/components/review/bulk-action-bar.tsx`

- Problem: Early return before hooks causes conditional hook execution.
- Fix: Move all `useQuery`, `useMutation`, `useState`, etc. calls above any early returns. Replace early return with conditional render of `null`.

Edits:
- Ensure the top of the component initializes:
  - `const selectedCount = selectedTransactions.size;`
  - `useQuery` to fetch categories
  - `useMutation` for bulk correct
- Then later, render `if (selectedCount === 0) return null;` as a conditional JSX return at the top-level (no early return before hooks).

Acceptance:
- ESLint no longer reports `react-hooks/rules-of-hooks` for this file.

## Step 2: Escape apostrophe in thresholds page
File: `apps/web/src/app/(app)/settings/thresholds/page.tsx`

- Problem: `react/no-unescaped-entities` in JSX.
- Fix: Replace `You'll` with `You&apos;ll` in the offending string.

Acceptance:
- ESLint no longer reports `react/no-unescaped-entities` for this file.

## Step 3: Replace empty interface with alias
File: `apps/web/src/components/ui/command.tsx`

- Problem: `interface CommandDialogProps extends DialogProps {}` triggers `@typescript-eslint/no-empty-object-type`.
- Fix: Replace with a type alias: `type CommandDialogProps = DialogProps;`

Acceptance:
- ESLint no longer reports `@typescript-eslint/no-empty-object-type` for this file.

## Step 4: Remove (or narrow) explicit `any` in app code
Target files (non-test):
- `apps/web/src/lib/plaid/client.ts`
  - Change `catch (error: any)` → `catch (error: unknown)` and narrow via type guards.
  - Replace `const linkTokenRequest: any` with the Plaid SDK type (`LinkTokenCreateRequest`) or a precise structural type.
- `apps/web/src/lib/analytics/review-events.ts`
  - Change `properties: Record<string, any>` → `Record<string, unknown>`.
  - Tighten payload types where easy; avoid `any` in signatures.
  - In `createTimingTracker`, change `additionalProps: any` → `Record<string, unknown>`.
- `apps/web/src/lib/services/dashboard-service.ts`
  - Replace constructor param `supabase: any` with a minimal interface for methods we call, or `unknown` + explicit casts where used.
  - Replace inline `any` in array operations with precise transient types.
- `apps/web/src/hooks/use-error-boundary.ts`
  - `errorInfo?: any` → `unknown` (and pass through to analytics as metadata),
  - `wrapAsync<T extends (...args: any[]) => Promise<any>>` → use generic params for args/return, or `(…args: unknown[]) => Promise<unknown>` inside while preserving external type inference.

Acceptance:
- No `@typescript-eslint/no-explicit-any` errors remain in these app files.

## Step 5: Scope ESLint rules for tests
File: `apps/web/eslint.config.mjs`

- Problem: Test files under `src/**` are linted with production rules, causing errors.
- Fix: Add an override for test globs to relax strict rules that are noisy in tests.

Suggested override block to append:
```js
{
  files: [
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**",
    "src/test/**",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "react/display-name": "off",
  },
}
```

Optional (if needed):
- Add `ignores` for paths like `src/app/api/**/*.spec.ts` if tests live within route directories.

Acceptance:
- ESLint errors from test files no longer block builds.

## Step 6 (optional): Quick unblock via Next.js config
File: `apps/web/next.config.ts`

- If immediate deploy is required before code + ESLint changes land, add:
```ts
eslint: { ignoreDuringBuilds: true },
```
- Place it in `nextConfig` root. Remove later once code and ESLint are fixed.

Acceptance:
- Build no longer fails due to ESLint in CI (temporary measure).

## Step 7: Address server externals warnings (optional but recommended)
- Add dependencies to `apps/web/package.json`:
  - `import-in-the-middle`, `require-in-the-middle` (versions compatible with Sentry/Otel in use).
- Alternatively, configure Next 15 to not externalize these packages if they should be bundled.
- Verify warnings are gone and Sentry/Otel runtime works on Vercel.

## Step 8: pnpm postinstall approvals (optional)
- If you want Sentry source map upload and other binaries:
  - Configure CI to run `pnpm approve-builds` for `@sentry/cli`, `sharp`, etc., or preapprove in a `.npmrc`/`.pnpmfile.cjs` policy.

---

## Verification Checklist
- `pnpm -w i` (workspace install) completes.
- Run locally in `apps/web`:
  - `pnpm run lint` → no errors.
  - `pnpm run typecheck` → no TS errors.
  - `pnpm run build` → compiles without ESLint failures.
- Navigate main flows:
  - Review page loads, category dropdown works.
  - Thresholds page renders (apostrophe fixed).
  - Command dialog component functions normally.
- Vercel build succeeds end-to-end.

## Rollback / Toggle
- If CI remains blocked, enable Step 6 (`ignoreDuringBuilds`) to ship, and track a follow-up to revert it after Steps 1–5 are merged.

## Notes
- Keep the `react-hooks/rules-of-hooks` as error; do not disable it.
- Prefer eliminating `any` in app code; isolate any unavoidable looseness to tests or narrow to `unknown` with guards.
- PostHog/Sentry rules: do not introduce API keys in code; rely on env vars; keep feature flags centralized if added later.
