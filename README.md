# Nexus

> **AI-Powered Financial Automation for SMBs**  
> Starting with salons, Nexus helps small business owners automate bookkeeping, manage cash flow, and export tax-ready data — without the complexity of traditional accounting software.

---

## 🚀 Vision

Small and medium-sized businesses (SMBs) run on thin margins and lack financial visibility. Bookkeeping is expensive, time-consuming, and reactive. Nexus solves this by delivering:

- **Automated bookkeeping**: Transactions ingested from bank/POS feeds and categorized automatically.  
- **Cash flow intelligence**: Predictive dashboards designed for non-financial owners.  
- **Industry-specific insights**: Salon-focused reporting (commissions, inventory, product sales).  
- **Tax-ready exports**: One-click QuickBooks/Xero push or CSV reports.  

💡 **Wedge:** Start with salons (fragmented, underserved, highly active online communities).  
🌍 **Long-term:** Expand across service SMBs → become the “Financial OS” for small businesses:contentReference[oaicite:3]{index=3}.

---

## 📦 MVP Scope (8–10 weeks)

**A salon owner can:**
1. Connect bank accounts/POS (Plaid, Square).  
2. View a simple cashflow + P&L dashboard.  
3. Correct low-confidence categorizations.  
4. Export tax-ready data (CSV or QuickBooks/Xero).  

**Out of scope for MVP:** invoicing, payroll, inventory, multi-currency, accrual accounting:contentReference[oaicite:4]{index=4}.

---

## 🛠️ Tech Stack

**Frontend**
- [Next.js](https://nextjs.org/) + React (SSR for auth/webhooks; deployed on Vercel)  
- [TailwindCSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (UI components)  
- [TanStack Query](https://tanstack.com/query/latest) (data fetching/caching)

**Backend & Data**
- [Supabase](https://supabase.com/) (Postgres, Auth, RLS, Storage, Realtime)  
- Supabase Edge Functions (secure webhooks for Plaid, Merge.dev, Stripe)  
- JSONB storage for raw payloads

**Integrations**
- [Plaid](https://plaid.com/) — bank/card transactions  
- [Merge.dev](https://merge.dev/) — QuickBooks/Xero exports  
- [Square](https://squareup.com/) — POS sales (later Vagaro/Fresha)  
- [Mindee](https://mindee.com/) or Veryfi — OCR for receipts  
- [OpenAI](https://openai.com/) or Claude — categorization/summary + embeddings  
- [Stripe](https://stripe.com/) — billing/payments  
- [PostHog](https://posthog.com/) — product analytics  
- [Sentry](https://sentry.io/) — error monitoring  
- [Langfuse](https://langfuse.com/) — LLM observability:contentReference[oaicite:5]{index=5}  

**DevOps/Sec**
- Deploys via Vercel + Supabase (minimal ops)  
- Secrets in Vercel Env / Supabase Vault  
- GitHub Actions CI (lint, typecheck, tests, Playwright e2e)

---

## 🗂 Repo Structure

```bash
nexus/
├─ apps/
│  ├─ web/           # Next.js app (UI + API routes)
│  └─ edge/          # Supabase Edge Functions (Plaid, Stripe, OCR, jobs)
├─ packages/
│  ├─ db/            # SQL migrations, seeders, typed queries
│  ├─ types/         # Shared TS types & API contracts
│  ├─ connectors/    # Plaid, Square, Merge, OCR SDKs
│  ├─ analytics/     # PostHog, Sentry, Langfuse clients
│  └─ categorizer/   # Hybrid rules + LLM categorization engine
├─ services/
│  ├─ ingestion/     # Normalize raw → canonical
│  ├─ exports/       # CSV + QBO/Xero mapping
│  ├─ auth/          # Org scoping, RLS helpers
│  └─ billing/       # Stripe plans, trial logic
├─ docs/             # ADRs, API contracts, runbooks
├─ scripts/          # One-off ops: rotate keys, restore backups
└─ .github/workflows # CI pipelines
