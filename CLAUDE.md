# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

The project uses pnpm as the package manager. Key commands:

- `pnpm install` - Install all dependencies
- `pnpm run lint` - Run ESLint across all packages
- `pnpm run typecheck` - Run TypeScript type checking
- `pnpm run test` - Run test suite
- `pnpm -w exec playwright test` - Run end-to-end tests with Playwright
- `pnpm -w exec playwright install --with-deps` - Install Playwright browsers and dependencies

## Architecture Overview

Nexus is an AI-powered financial automation platform for SMBs, starting with salons. The system automates bookkeeping, provides cash flow insights, and exports tax-ready data.

### Repository Structure

This is a monorepo with the following structure:

- **apps/web/** - Next.js frontend application (React + TailwindCSS + shadcn/ui)
- **apps/edge/** - Supabase Edge Functions for secure webhooks and background jobs
- **packages/db/** - Database schema, migrations, and typed queries
- **packages/types/** - Shared TypeScript types and API contracts
- **packages/connectors/** - Integration SDKs (Plaid, Square, Merge.dev, OCR)
- **packages/analytics/** - Observability clients (PostHog, Sentry, Langfuse)
- **packages/categorizer/** - Hybrid rules + LLM transaction categorization engine
- **services/ingestion/** - Data normalization pipeline (raw → canonical format)
- **services/exports/** - Export functionality (CSV, QuickBooks/Xero)
- **services/auth/** - Organization scoping and RLS helpers
- **services/billing/** - Stripe integration and subscription logic

### Key Integrations

- **Supabase**: Primary backend (Postgres, Auth, RLS, Storage, Realtime)
- **Plaid**: Bank and card transaction ingestion
- **Merge.dev**: Unified API for accounting software exports (QuickBooks, Xero)
- **Square**: POS transaction data
- **OpenAI/Claude**: Transaction categorization and financial insights
- **Stripe**: Billing and subscription management

### Data Flow

1. Financial data ingested from Plaid (banks) and Square (POS)
2. Raw transactions normalized by ingestion service
3. Categorizer service applies rules + LLM for transaction classification
4. Web app displays dashboards with cash flow and P&L insights
5. Export service formats data for accounting software or CSV

### TypeScript Configuration

The project uses strict TypeScript settings with:
- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"exactOptionalPropertyTypes": true`
- Module resolution set to "nodenext"

### Testing Strategy

- Unit tests via `pnpm run test`
- End-to-end tests with Playwright
- CI pipeline runs lint, typecheck, tests, and e2e tests on main branch

### Development Workflow

The CI pipeline (.github/workflows/ci.yml) runs on all PRs and includes:
1. Lint check with ESLint + Prettier
2. TypeScript type checking
3. Unit test execution
4. E2E tests with Playwright (main branch only)

# Claude Code Guidelines by Arrish Bhandal

## Implementation Best Practices

### 0 — Purpose  

These rules ensure maintainability, safety, and developer velocity. 
**MUST** rules are enforced by CI; **SHOULD** rules are strongly recommended.

---

### 1 — Before Coding

- **BP-1 (MUST)** Ask the user clarifying questions.
- **BP-2 (SHOULD)** Draft and confirm an approach for complex work.  
- **BP-3 (SHOULD)** If ≥ 2 approaches exist, list clear pros and cons.

---

### 2 — While Coding

- **C-1 (MUST)** Follow TDD: scaffold stub -> write failing test -> implement.
- **C-2 (MUST)** Name functions with existing domain vocabulary for consistency.  
- **C-3 (SHOULD NOT)** Introduce classes when small testable functions suffice.  
- **C-4 (SHOULD)** Prefer simple, composable, testable functions.
- **C-5 (MUST)** Prefer branded `type`s for IDs
  ```ts
  type UserId = Brand<string, 'UserId'>   // ✅ Good
  type UserId = string                    // ❌ Bad
  ```  
- **C-6 (MUST)** Use `import type { … }` for type-only imports.
- **C-7 (SHOULD NOT)** Add comments except for critical caveats; rely on self‑explanatory code.
- **C-8 (SHOULD)** Default to `type`; use `interface` only when more readable or interface merging is required. 
- **C-9 (SHOULD NOT)** Extract a new function unless it will be reused elsewhere, is the only way to unit-test otherwise untestable logic, or drastically improves readability of an opaque block.

---

### 3 — Testing

- **T-1 (MUST)** For a simple function, colocate unit tests in `*.spec.ts` in same directory as source file.
- **T-2 (MUST)** For any API change, add/extend integration tests in `apps/web/test/*.spec.ts` for Next.js API routes, or `apps/edge/test/*.spec.ts` for Supabase Edge Functions.
- **T-3 (MUST)** ALWAYS separate pure-logic unit tests from DB-touching integration tests.
- **T-4 (SHOULD)** Prefer integration tests over heavy mocking.  
- **T-5 (SHOULD)** Unit-test complex algorithms thoroughly.
- **T-6 (SHOULD)** Test the entire structure in one assertion if possible
  ```ts
  expect(result).toBe([value]) // Good

  expect(result).toHaveLength(1); // Bad
  expect(result[0]).toBe(value); // Bad
  ```

---

### 4 — Database

- **D-1 (MUST)** Type DB helpers to accept both direct Supabase client and transaction instances, so they work in both contexts.  
- **D-2 (SHOULD)** Override incorrect generated types in `packages/types/src/db-overrides.ts`. e.g. autogenerated types show incorrect BigInt values – so we override to `string` manually.

---

### 5 — Code Organization

- **O-1 (MUST)** Place code in `packages/types` for shared types, or other packages only if used by ≥ 2 apps/packages.

---

### 6 — Tooling Gates

- **G-1 (MUST)** `prettier --check` passes.  
- **G-2 (MUST)** `pnpm run typecheck` and `pnpm run lint` pass.  

---

### 7 - Git

- **GH-1 (MUST**) Use Conventional Commits format when writing commit messages: https://www.conventionalcommits.org/en/v1.0.0
- **GH-2 (SHOULD NOT**) Refer to Claude or Anthropic in commit messages.

---

### 8 — Financial Domain

- **F-1 (MUST)** Use exact decimal arithmetic for all financial calculations. Never use floating point for money.
- **F-2 (MUST)** Validate transaction amounts are positive for income, negative for expenses before categorization.
- **F-3 (SHOULD)** Use domain-specific types for financial entities: `TransactionId`, `AccountId`, `CategoryId`, etc.
- **F-4 (MUST)** Store raw transaction data alongside normalized data for audit trails.
- **F-5 (SHOULD)** Include confidence scores for AI-generated categorizations to enable manual review.

---

### 9 — Supabase & RLS

- **S-1 (MUST)** Always scope database queries by organization ID using RLS policies.
- **S-2 (MUST)** Use Supabase client types for database operations, not raw SQL when possible.
- **S-3 (SHOULD)** Leverage Supabase realtime for live dashboard updates.
- **S-4 (MUST)** Store sensitive API keys (Plaid, Stripe) in Supabase Vault, not environment variables.

---

## Writing Functions Best Practices

When evaluating whether a function you implemented is good or not, use this checklist:

1. Can you read the function and HONESTLY easily follow what it's doing? If yes, then stop here.
2. Does the function have very high cyclomatic complexity? (number of independent paths, or, in a lot of cases, number of nesting if if-else as a proxy). If it does, then it's probably sketchy.
3. Are there any common data structures and algorithms that would make this function much easier to follow and more robust? Parsers, trees, stacks / queues, etc.
4. Are there any unused parameters in the function?
5. Are there any unnecessary type casts that can be moved to function arguments?
6. Is the function easily testable without mocking core features (e.g. sql queries, redis, etc.)? If not, can this function be tested as part of an integration test?
7. Does it have any hidden untested dependencies or any values that can be factored out into the arguments instead? Only care about non-trivial dependencies that can actually change or affect the function.
8. Brainstorm 3 better function names and see if the current name is the best, consistent with rest of codebase.

IMPORTANT: you SHOULD NOT refactor out a separate function unless there is a compelling need, such as:
  - the refactored function is used in more than one place
  - the refactored function is easily unit testable while the original function is not AND you can't test it any other way
  - the original function is extremely hard to follow and you resort to putting comments everywhere just to explain it

## Writing Tests Best Practices

When evaluating whether a test you've implemented is good or not, use this checklist:

1. SHOULD parameterize inputs; never embed unexplained literals such as 42 or "foo" directly in the test.
2. SHOULD NOT add a test unless it can fail for a real defect. Trivial asserts (e.g., expect(2).toBe(2)) are forbidden.
3. SHOULD ensure the test description states exactly what the final expect verifies. If the wording and assert don’t align, rename or rewrite.
4. SHOULD compare results to independent, pre-computed expectations or to properties of the domain, never to the function’s output re-used as the oracle.
5. SHOULD follow the same lint, type-safety, and style rules as prod code (prettier, ESLint, strict types).
6. SHOULD express invariants or axioms (e.g., commutativity, idempotence, round-trip) rather than single hard-coded cases whenever practical. Use `fast-check` library e.g.
```
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { getCharacterCount } from './string';

describe('properties', () => {
  test('concatenation functoriality', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (a, b) =>
          getCharacterCount(a + b) ===
          getCharacterCount(a) + getCharacterCount(b)
      )
    );
  });
});
```

7. Unit tests for a function should be grouped under `describe(functionName, () => ...`.
8. Use `expect.any(...)` when testing for parameters that can be anything (e.g. variable ids).
9. ALWAYS use strong assertions over weaker ones e.g. `expect(x).toEqual(1)` instead of `expect(x).toBeGreaterThanOrEqual(1)`.
10. SHOULD test edge cases, realistic input, unexpected input, and value boundaries.
11. SHOULD NOT test conditions that are caught by the type checker.

## Code Organization

- `apps/web/` - Next.js frontend application (React + TailwindCSS + shadcn/ui)
- `apps/edge/` - Supabase Edge Functions for secure webhooks and background jobs
- `packages/db/` - Database schema, migrations, and typed queries
- `packages/types/` - Shared TypeScript types and API contracts
- `packages/connectors/` - Integration SDKs (Plaid, Square, Merge.dev, OCR)
- `packages/analytics/` - Observability clients (PostHog, Sentry, Langfuse)
- `packages/categorizer/` - Hybrid rules + LLM transaction categorization engine
- `services/ingestion/` - Data normalization pipeline (raw → canonical format)
- `services/exports/` - Export functionality (CSV, QuickBooks/Xero)
- `services/auth/` - Organization scoping and RLS helpers
- `services/billing/` - Stripe integration and subscription logic

## Remember Shortcuts

Remember the following shortcuts which the user may invoke at any time.

### QNEW

When I type "qnew", this means:

```
Understand all BEST PRACTICES listed in CLAUDE.md.
Your code SHOULD ALWAYS follow these best practices.
```

### QPLAN
When I type "qplan", this means:
```
Analyze similar parts of the codebase and determine whether your plan:
- is consistent with rest of codebase
- introduces minimal changes
- reuses existing code
```

## QCODE

When I type "qcode", this means:

```
Implement your plan and make sure your new tests pass.
Always run tests to make sure you didn't break anything else.
Always run `prettier` on the newly created files to ensure standard formatting.
Always run `pnpm run typecheck` and `pnpm run lint` to make sure type checking and linting passes.
```

### QCHECK

When I type "qcheck", this means:

```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR code change you introduced (skip minor changes):

1. CLAUDE.md checklist Writing Functions Best Practices.
2. CLAUDE.md checklist Writing Tests Best Practices.
3. CLAUDE.md checklist Implementation Best Practices.
```

### QCHECKF

When I type "qcheckf", this means:

```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR function you added or edited (skip minor changes):

1. CLAUDE.md checklist Writing Functions Best Practices.
```

### QCHECKT

When I type "qcheckt", this means:

```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR test you added or edited (skip minor changes):

1. CLAUDE.md checklist Writing Tests Best Practices.
```

### QUX

When I type "qux", this means:

```
Imagine you are a human UX tester of the feature you implemented. 
Output a comprehensive list of scenarios you would test, sorted by highest priority.
```

### QGIT

When I type "qgit", this means:

```
Add all changes to staging, create a commit, and push to remote.

Follow this checklist for writing your commit message:
- SHOULD use Conventional Commits format: https://www.conventionalcommits.org/en/v1.0.0
- SHOULD NOT refer to Claude or Anthropic in the commit message.
- SHOULD structure commit message as follows:
<type>[optional scope]: <description>
[optional body]
[optional footer(s)]
- commit SHOULD contain the following structural elements to communicate intent: 
fix: a commit of the type fix patches a bug in your codebase (this correlates with PATCH in Semantic Versioning).
feat: a commit of the type feat introduces a new feature to the codebase (this correlates with MINOR in Semantic Versioning).
BREAKING CHANGE: a commit that has a footer BREAKING CHANGE:, or appends a ! after the type/scope, introduces a breaking API change (correlating with MAJOR in Semantic Versioning). A BREAKING CHANGE can be part of commits of any type.
types other than fix: and feat: are allowed, for example @commitlint/config-conventional (based on the Angular convention) recommends build:, chore:, ci:, docs:, style:, refactor:, perf:, test:, and others.
footers other than BREAKING CHANGE: <description> may be provided and follow a convention similar to git trailer format.