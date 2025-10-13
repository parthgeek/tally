# Nexus

> **AI-Powered Financial Automation for E-commerce Businesses**  
> Nexus helps direct-to-consumer (DTC) brands automate bookkeeping, manage cash flow, and export tax-ready data — without the complexity of traditional accounting software.

---

## 🚀 Vision

E-commerce businesses face unique financial challenges: payment processor fees, marketplace reconciliation, COGS tracking, and complex revenue streams. Traditional accounting software isn't built for modern DTC brands. Nexus solves this by delivering:

- **Automated bookkeeping**: Transactions ingested from bank/POS feeds and categorized automatically using AI.
- **E-commerce intelligence**: Revenue, COGS, and operating expense tracking designed for Shopify-first DTC brands.
- **Cash flow visibility**: Predictive dashboards with real-time insights into unit economics and margins.
- **Tax-ready exports**: One-click QuickBooks/Xero push or CSV reports.

### 🧠 **AI-Powered Categorization**

- **Google Gemini 2.5 Flash-Lite** for intelligent transaction categorization
- **67% cost savings** compared to traditional AI solutions
- **95%+ accuracy** with e-commerce-specific category intelligence
- **Rule learning** system that improves over time
- **38 e-commerce categories** covering revenue, COGS, and operating expenses
- **84+ automated rules** for common e-commerce transactions

💡 **Wedge:** Start with Shopify-first DTC brands (fragmented market, complex financials, underserved by traditional tools).  
🌍 **Long-term:** Expand across multi-channel e-commerce → become the "Financial OS" for online retailers.

---

## 📦 MVP Scope (8–10 weeks)

**A DTC brand owner can:**

1. Connect bank accounts and Shopify via Plaid/Square.
2. View a simple cashflow + P&L dashboard with revenue, COGS, and margin analysis.
3. Correct low-confidence categorizations with AI learning.
4. Export tax-ready data (CSV or QuickBooks/Xero).

**E-commerce-specific features:**

- Payment processor fee tracking (Stripe, PayPal, Shop Pay, BNPL)
- Shipping income vs. shipping expense separation
- Refunds and discounts as contra-revenue
- Inventory purchase and COGS tracking
- Advertising spend by channel (Meta, Google, TikTok)
- 3PL and fulfillment cost categorization
- Shopify payout reconciliation

**Out of scope for MVP:** Multi-marketplace (Amazon, eBay, Etsy), invoicing, payroll, inventory management, accrual accounting.

---

## 🛠️ Tech Stack

**Frontend**

- [Next.js 15](https://nextjs.org/) + React 19 (App Router for server components)
- [TailwindCSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (UI components)
- [TanStack Query](https://tanstack.com/query/latest) (data fetching/caching)

**Backend & Data**

- [Supabase](https://supabase.com/) (Postgres, Auth, RLS, Storage, Realtime)
- Supabase Edge Functions (secure webhooks for Plaid, Stripe, job processing)
- JSONB storage for raw payloads

**Integrations**

- [Plaid](https://plaid.com/) — bank/card transactions
- [Merge.dev](https://merge.dev/) — QuickBooks/Xero exports
- [Square](https://squareup.com/) — POS sales
- [Mindee](https://mindee.com/) or Veryfi — OCR for receipts
- [Google Gemini](https://ai.google.dev/) — AI categorization with 67% cost savings
- [Stripe](https://stripe.com/) — billing/payments
- [PostHog](https://posthog.com/) — product analytics
- [Sentry](https://sentry.io/) — error monitoring
- [Langfuse](https://langfuse.com/) — LLM observability

**DevOps/Sec**

- Deploys via Vercel + Supabase (minimal ops)
- Secrets in Vercel Env / Supabase Vault
- GitHub Actions CI (lint, typecheck, tests, Playwright e2e)

**Testing & Quality**

- [Playwright](https://playwright.dev/) — E2E testing across Chrome, Firefox, Safari
- [Vitest](https://vitest.dev/) — Unit testing with property-based testing
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) — Code quality
- Comprehensive test coverage: 218 unit tests, integration tests, and E2E tests

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
│  ├─ categorizer/   # Hybrid rules + LLM categorization engine (Gemini 2.5 Flash-Lite)
│  └─ shared/        # Shared utilities and helpers
├─ services/
│  ├─ ingestion/     # Normalize raw → canonical
│  ├─ exports/       # CSV + QBO/Xero mapping
│  ├─ auth/          # Org scoping, RLS helpers
│  ├─ billing/       # Stripe plans, trial logic
│  └─ categorizer/   # Categorization service layer
├─ docs/             # ADRs, API contracts, runbooks, testing guide
├─ scripts/          # One-off ops: rotate keys, restore backups
└─ .github/workflows # CI pipelines
```

---

## 🆕 Recent Updates

### 🛍️ **E-commerce Switch Complete** (Latest)

- **Migrated from salon to e-commerce focus** with industry-specific taxonomy
- **38 e-commerce categories** covering DTC revenue, COGS, and operating expenses
- **84+ automated rules** for Shopify, payment processors, shipping, ads, and fulfillment
- **Industry-aware prompts** with e-commerce-specific business logic
- **Comprehensive guardrails** preventing payment processor/refund mis-categorization
- **Historical recategorization** for industry switches
- **Edge functions deployed** with full e-commerce support

📖 **[View E-commerce Implementation Details](./docs/ecommerce-switch-implementation.md)**

### 🌍 **Universal Multi-Vertical Categorization** (Latest - Production Ready)

**Status:** Phase 1-5 Complete | Ready for Deployment

The categorization system has been redesigned with a universal, multi-vertical taxonomy that supports expansion across industries while maintaining bookkeeping best practices.

**Key Features:**
- **30 Universal Categories** (5 parent + 25 operational) aligned with standard chart of accounts
- **Attribute-Based Tracking** - Vendor/platform/processor data stored as transaction metadata instead of categories
- **Multi-Industry Support** - Designed for e-commerce, SaaS, professional services, and beyond
- **100% Attribute Extraction Accuracy** - Validated with Gemini 2.5 Flash Lite
- **Improved LLM Performance** - Temperature 1.0 with confidence calibration

**Category Structure:**
- **Revenue (5):** Product Sales, Service Revenue, Shipping Income, Refunds, Discounts
- **COGS (4):** Materials, Labor, Packaging, Freight  
- **OpEx (14):** Marketing, Software, Payment Processing, Labor, Professional Services, etc.
- **Non-P&L (2):** Sales Tax, Payouts Clearing
- **Industry-Specific (5):** Fulfillment, Platform Fees, Hosting, etc.

**Why Attributes?**
Instead of creating "Stripe Fees" and "PayPal Fees" categories, transactions are categorized as "Payment Processing" with `{processor: "stripe"}` or `{processor: "paypal"}` attributes. This keeps the chart of accounts clean while preserving vendor-level detail for reporting.

📖 **[View Universal Taxonomy Migration Guide](./docs/universal-taxonomy-migration.md)**

### 🚀 **Gemini Migration** (Previously Completed)

- **Migrated from OpenAI to Google Gemini 2.5 Flash-Lite** for transaction categorization
- **67% cost reduction** while maintaining 95%+ accuracy  
- **15-30% performance improvement** (483-676ms response times)
- **100% test coverage** with comprehensive E2E validation
- **Production ready** with robust error handling and fallbacks

📖 **[View Gemini Migration Details](./docs/gemini-migration.md)**

---

## 🧪 Testing & Development

### Quick Start

```bash
# Install dependencies
pnpm install

# Set up database and seed with sample data
pnpm run migrate  # Apply database schema
pnpm run seed     # Generate realistic e-commerce transaction data

# Start development
pnpm run dev      # Start Next.js dev server

# Run tests
pnpm run test                    # Unit tests across all packages
pnpm run test:categorization     # Categorizer unit tests (218/218 passing)  
pnpm run test:integration        # Gemini API integration tests
pnpm run test:e2e               # End-to-end categorization pipeline
pnpm run lint     # ESLint + Prettier
pnpm run typecheck # TypeScript compilation
```

### Testing Strategy

**🎭 End-to-End Testing (Playwright)**

- Tests across Chrome, Firefox, and Safari
- Automatic dev server management
- Visual debugging and trace collection
- Comprehensive e-commerce transaction scenarios

**⚡ Unit Testing (Vitest)**

- Fast, isolated component and function tests
- Property-based testing for financial calculations
- 218 tests covering categorization, rules, and business logic

**🔧 Integration Testing**

- API endpoint validation
- Database transaction testing
- Real Supabase connection testing
- Gemini API integration verification

### E-commerce Test Coverage

- ✅ Shopify payout processing and reconciliation
- ✅ Payment processor fee categorization (Stripe, PayPal, Shop Pay, BNPL)
- ✅ Advertising spend tracking (Meta, Google, TikTok)
- ✅ Shipping income vs. shipping expense separation
- ✅ Refund and discount handling as contra-revenue
- ✅ Inventory purchase and COGS tracking
- ✅ 3PL and fulfillment fee categorization
- ✅ Warehouse storage costs
- ✅ App subscription and SaaS tool tracking

### Test Commands

```bash
# Run specific test types
pnpm run e2e                    # All E2E tests
pnpm run e2e --project=chromium # Chrome only
pnpm run test                   # All unit tests
pnpm --filter @nexus/db test    # Database package tests
pnpm --filter @nexus/categorizer test # Categorizer tests

# Debugging
pnpm --filter web exec playwright test --ui     # Visual test runner
pnpm --filter web exec playwright test --debug  # Step-by-step debugging

# CI/CD pipeline
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run e2e
```

---

## 🎯 E-commerce Features

### Automated Transaction Categorization

**Revenue Categories:**
- DTC Sales
- Shipping Income
- Discounts (Contra-Revenue)
- Refunds & Allowances (Contra-Revenue)

**Cost of Goods Sold:**
- Inventory Purchases
- Inbound Freight
- Packaging Supplies
- Manufacturing Costs

**Operating Expenses:**
- Payment Processing Fees (Stripe, PayPal, Shop Pay, BNPL)
- Marketing & Advertising (Meta, Google, TikTok)
- Shopify Platform Fees
- App Subscriptions
- Email/SMS Tools
- Fulfillment & 3PL Fees
- Warehouse Storage
- Shipping Expense
- Returns Processing
- Professional Services
- And more...

### Intelligent Guardrails

- **Refund Protection**: Prevents refunds/returns from mapping to revenue
- **Processor Detection**: Blocks payment processors from revenue categorization
- **Sales Tax Handling**: Routes sales tax to liability accounts (not P&L)
- **Shopify Payouts**: Automatically maps to clearing account with detailed breakdown
- **Confidence Scoring**: AI provides 0-1 confidence scores for manual review thresholds

---

## 📖 Documentation

### Core Documentation

- **[Testing Guide](./docs/testing.md)** - Comprehensive testing documentation including setup, best practices, and troubleshooting
- **[Database Package](./docs/database-package.md)** - Database migrations, seeding, and client configuration
- **[Database Schema](./docs/database-schema.md)** - Complete schema documentation with relationships
- **[Analytics Package](./docs/analytics-package.md)** - Observability and monitoring setup

### E-commerce Specific

- **[E-commerce Switch Implementation](./docs/ecommerce-switch-implementation.md)** - Complete guide to e-commerce feature implementation
- **[Categorization Guide](./docs/3-categorization.md)** - Deep dive into AI categorization system
- **[Categorizer Lab Architecture](./docs/categorizer-lab-architecture.md)** - Testing platform for categorization
- **[Categorizer Lab Implementation](./docs/categorizer-lab-implementation.md)** - Implementation details and usage

### Technical Details

- **[Foundations & Contracts](./docs/0-foundationsandcontracts.md)** - Platform architecture and API contracts
- **[Gemini Migration](./docs/gemini-migration.md)** - AI model migration details
- **[Security Implementation](./docs/security-implementation-guide.md)** - Security best practices and implementation
- **[Deployment Guide](./docs/plaid-integration-deployment.md)** - Production deployment instructions

---

## 🏗️ Architecture Highlights

### AI Categorization Engine

**Hybrid Approach:**
1. **Pass-1 Rules Engine**: 84+ vendor/keyword/MCC patterns for instant categorization
2. **Pass-2 LLM Engine**: Google Gemini 2.5 Flash-Lite for complex transactions
3. **Hybrid Orchestrator**: Auto-apply at 0.85 confidence threshold, escalate to LLM when needed

**Industry-Specific Intelligence:**
- E-commerce taxonomy with 38 categories
- Shopify-first business logic
- Payment processor fee detection
- Shipping income vs. expense separation
- COGS tracking and gross margin calculation

### Multi-Tenant Architecture

- **Organization Scoping**: Every query scoped by `org_id` using RLS
- **Role-Based Access**: Owner, admin, and member roles
- **Secure API Keys**: Supabase Vault for sensitive credentials
- **Industry Switching**: Automatic recategorization when switching industries

### Data Flow

1. Financial data ingested from Plaid (banks) and Square (POS)
2. Raw transactions normalized by ingestion service
3. Categorizer service applies hybrid rules + LLM approach
4. Web app displays dashboards with revenue, COGS, margin, and expense insights
5. Export service formats data for accounting software or CSV

---

## 🚢 Deployment

### Production Environment

- **Frontend**: Vercel (automatic deployments from `main`)
- **Backend**: Supabase (Postgres + Edge Functions)
- **Edge Functions**: Deployed via `pnpm run functions:deploy`
- **Monitoring**: PostHog (analytics) + Sentry (errors) + Langfuse (LLM observability)

### Environment Variables

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI/LLM
GEMINI_API_KEY=your_gemini_api_key

# Integrations
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Observability
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
```

---

## 🎓 Development Guidelines

This project follows strict development best practices documented in [CLAUDE.md](./CLAUDE.md):

- **TDD Approach**: Write tests before implementation
- **Type Safety**: Branded types for domain IDs, strict TypeScript
- **Financial Precision**: Exact decimal arithmetic (integer cents)
- **Code Quality**: ESLint, Prettier, comprehensive testing
- **Security First**: RLS policies, input validation, secure API design

---

## 🗺️ Roadmap

### ✅ Phase 1: E-commerce MVP (Completed)
- Shopify-first DTC brand support
- Google Gemini AI categorization
- Basic P&L and cash flow dashboards
- Tax-ready exports (CSV, QuickBooks, Xero)

### 🚧 Phase 2: Multi-Channel Expansion (In Progress)
- Amazon Seller Central integration
- eBay and Etsy marketplace support
- WooCommerce connector
- Multi-channel revenue reconciliation

### 📋 Phase 3: Advanced Analytics (Planned)
- Predictive cash flow forecasting
- Customer acquisition cost (CAC) tracking
- Lifetime value (LTV) analysis
- Unit economics dashboards
- Inventory COGS tracking

### 🔮 Phase 4: Financial OS (Future)
- Accounts payable automation
- Vendor bill management
- Multi-currency support
- Accrual accounting
- Financial statement generation

---

## 🤝 Contributing

This is a private repository. For questions or support, contact the development team.

---

## 📄 License

Private and Confidential. All rights reserved.

---

_Built with ❤️ for e-commerce entrepreneurs who deserve better financial tools._
