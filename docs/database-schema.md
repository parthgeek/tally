# Database Schema Documentation

This document outlines the Postgres database schema for the Nexus financial automation platform, implemented in `packages/db/migrations/001_init.sql`.

## Overview

The database schema supports multi-tenant financial automation with organization-scoped data, external service integrations, and AI-powered transaction categorization. All tables follow Row Level Security (RLS) patterns for secure multi-tenancy.

## Core Design Principles

Following CLAUDE.md best practices:

- **F-1**: All monetary amounts stored as `bigint` in cents for exact decimal arithmetic
- **F-3**: Domain-specific branded types for all entity identifiers  
- **F-4**: Raw transaction data preserved alongside normalized data for audit trails
- **S-1**: All business tables scoped by `org_id` with RLS policies enabled
- **D-1**: Schema designed to work with both direct Supabase client and transaction instances

## Table Schema

### Authentication & Organization Management

#### `users`
Extends Supabase `auth.users` with business profile information.

```sql
CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    name text,
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- Direct reference to Supabase auth system
- Cascade deletion maintains data integrity
- Stores business-relevant profile data

#### `orgs` 
Organization entities for multi-tenant data scoping.

```sql
CREATE TABLE orgs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    industry text,
    timezone text,
    owner_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- Each organization has a designated owner
- Industry field supports business-specific customizations
- Timezone enables proper financial reporting periods

#### `user_org_roles`
Many-to-many relationship between users and organizations with role-based access.

```sql
CREATE TABLE user_org_roles (
    user_id uuid REFERENCES auth.users(id),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    role text CHECK (role IN ('owner', 'admin', 'member')),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, org_id)
);
```

**Key Features:**
- Composite primary key prevents duplicate memberships
- Role hierarchy: `owner` > `admin` > `member`
- Cascade deletion when organization is removed

### Financial Data Integration

#### `connections`
External service connections (Plaid, Square, etc.) for data ingestion.

```sql
CREATE TABLE connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    provider text NOT NULL,
    status text NOT NULL,
    scopes text[],
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- Supports multiple provider types (`plaid`, `square`, `manual`)
- Status tracking for connection health monitoring
- Scopes array stores OAuth permission levels
- Organization-scoped for multi-tenancy

#### `accounts`
Financial accounts (bank accounts, credit cards) linked to connections.

```sql
CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
    provider_account_id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    currency text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- Links to parent connection for data lineage
- `provider_account_id` stores external system identifier
- `is_active` flag for account lifecycle management
- Currency field supports multi-currency businesses

### Transaction Categorization System

#### `categories`
Hierarchical transaction categories with global and organization-specific entries.

```sql
CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name text NOT NULL,
    parent_id uuid NULL REFERENCES categories(id),
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- **Global Categories**: `org_id = NULL` for shared salon taxonomy
- **Custom Categories**: Organization-specific categories
- **Hierarchical Structure**: Self-referencing `parent_id` for category trees
- **Unique Constraint**: `(org_id, name)` prevents duplicate names per organization

#### `rules`
Pattern-matching rules for automated transaction categorization.

```sql
CREATE TABLE rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    pattern jsonb NOT NULL,
    category_id uuid REFERENCES categories(id),
    weight numeric NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- **JSONB Pattern Storage**: Flexible rule matching criteria
- **Weight System**: Prioritizes rules when multiple matches occur
- **Category Assignment**: Links matched transactions to specific categories
- Organization-scoped for custom business logic

### Transaction Processing

#### `receipts`
OCR-processed receipt data for expense matching and validation.

```sql
CREATE TABLE receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    ocr_text text,
    vendor text,
    total_cents bigint,
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- **Storage Integration**: Links to Supabase Storage for image files
- **OCR Processing**: Extracted text for matching algorithms
- **Vendor Detection**: Parsed merchant information
- **Amount Validation**: Exact decimal amounts in cents (F-1 compliance)

#### `transactions`
Core financial transaction data with AI categorization support.

```sql
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
    date date NOT NULL,
    amount_cents bigint NOT NULL,
    currency text NOT NULL,
    description text NOT NULL,
    merchant_name text,
    mcc text NULL,
    raw jsonb NOT NULL,
    category_id uuid NULL REFERENCES categories(id),
    confidence numeric NULL,
    source text CHECK (source IN ('plaid', 'square', 'manual')),
    receipt_id uuid NULL REFERENCES receipts(id),
    reviewed boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- **Exact Decimal Arithmetic**: `amount_cents` as `bigint` (F-1 compliance)
- **Audit Trail**: `raw` JSONB preserves original data (F-4 compliance)
- **AI Categorization**: `confidence` score for manual review (F-5 compliance)
- **Data Sources**: Tracks ingestion source for debugging
- **Receipt Matching**: Optional linkage to scanned receipts
- **Review Workflow**: Manual approval flag for bookkeeping accuracy

### Export & Reporting

#### `exports`
Data export jobs for accounting software integration.

```sql
CREATE TABLE exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    type text CHECK (type IN ('csv', 'qbo', 'xero')),
    params jsonb,
    status text NOT NULL,
    url text,
    created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- **Multiple Formats**: CSV, QuickBooks, Xero support
- **Flexible Parameters**: JSONB for format-specific options
- **Status Tracking**: Job processing state management
- **Download Links**: Generated file URLs for user access

## Performance Optimization

### Strategic Indexes

All tables include performance-optimized indexes for common query patterns:

**Organization Scoping:**
```sql
CREATE INDEX idx_connections_org_id ON connections(org_id);
CREATE INDEX idx_accounts_org_id ON accounts(org_id);
CREATE INDEX idx_transactions_org_id ON transactions(org_id);
-- ... all business tables
```

**Transaction Analytics:**
```sql
-- Primary date-range queries for dashboards
CREATE INDEX idx_transactions_org_date ON transactions(org_id, date);

-- Category analysis and reporting
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
```

**Relationship Traversal:**
```sql
-- Account-to-connection lookup
CREATE INDEX idx_accounts_connection_id ON accounts(connection_id);

-- Category hierarchy navigation
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- Receipt-transaction matching
CREATE INDEX idx_transactions_receipt_id ON transactions(receipt_id);
```

**Unique Business Constraints:**
```sql
-- Prevent duplicate category names per organization
CREATE UNIQUE INDEX idx_categories_org_name ON categories(org_id, name);
```

## Security Model

### Row Level Security (RLS)

**Implementation**: `packages/db/migrations/002_rls.sql`

All business tables have RLS enabled with comprehensive policies for secure multi-tenancy:

```sql
-- Helper function for organization membership checks
CREATE OR REPLACE FUNCTION public.user_in_org(target_org uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_org_roles 
        WHERE user_id = auth.uid() AND org_id = target_org
    );
$$;

-- Example policy for org-scoped tables
CREATE POLICY "transactions_select_member" ON transactions
    FOR SELECT USING (public.user_in_org(org_id) = true);
```

**Policy Coverage:**
- **Org-Scoped Tables**: All CRUD operations require `user_in_org(org_id) = true`
- **Global Categories**: SELECT allowed for `org_id = NULL`, INSERT/UPDATE/DELETE only for org-specific categories
- **User Self-Access**: Users can only SELECT/UPDATE their own records (`id = auth.uid()`)
- **Security Helper**: `SECURITY DEFINER` function prevents privilege escalation attacks

## Seed Data

### Global Salon Categories

The schema includes comprehensive salon business taxonomy seeded as global categories:

**Revenue Categories:**
- Hair Services (cuts, styling, coloring)
- Nail Services (manicures, pedicures, nail art)
- Skin Care Services (facials, treatments)
- Massage Services (therapeutic, relaxation)
- Product Sales (retail inventory)
- Gift Cards (prepaid services)

**Expense Categories:**
- Rent & Utilities (facility costs)
- Supplies & Inventory (consumables, products)
- Equipment & Maintenance (chairs, tools, repairs)
- Staff Wages & Benefits (payroll, insurance)
- Marketing & Advertising (customer acquisition)
- Professional Services (accounting, legal)
- Insurance (liability, property)
- Licenses & Permits (regulatory compliance)
- Training & Education (staff development)
- Software & Technology (POS, scheduling)
- Bank Fees & Interest (financial costs)
- Travel & Transportation (business travel)
- Office Supplies (administrative costs)
- Other Operating Expenses (miscellaneous)

**Hierarchical Structure:**
```sql
Revenue (parent)
├── Hair Services
├── Nail Services  
├── Skin Care Services
├── Massage Services
├── Product Sales
└── Gift Cards

Expenses (parent)
├── Rent & Utilities
├── Supplies & Inventory
├── Equipment & Maintenance
└── ... (remaining expense subcategories)
```

## Data Flow Architecture

The schema supports the core Nexus data pipeline:

1. **Data Ingestion**: `connections` → `accounts` → `transactions`
2. **Categorization**: `rules` + AI → `transactions.category_id` + `confidence`
3. **Validation**: `receipts` → `transactions.receipt_id` for expense verification
4. **Export**: `transactions` → `exports` for accounting software integration

## Migration Strategy

**Files**: 
- `001_init.sql` - Initial schema with tables, indexes, and seed data
- `002_rls.sql` - Row Level Security policies and helper functions

**Deployment**: Execute via Supabase CLI or Dashboard
```bash
supabase db reset                    # Development
supabase db push                     # Production deployment
```

**Rollback**: Schema includes proper CASCADE relationships for safe teardown

## Integration Points

### Supabase Features
- **Authentication**: `users` table extends `auth.users`
- **Storage**: `receipts.storage_path` references Supabase Storage buckets
- **Realtime**: All tables support real-time subscriptions for live dashboards
- **Functions**: Edge Functions can directly query with RLS enforcement

### External Services
- **Plaid**: `connections` store access tokens, `transactions.raw` preserves Plaid format
- **Square**: Similar pattern for POS transaction ingestion
- **Merge.dev**: `exports` table tracks QuickBooks/Xero export jobs

## Development Workflow

### Schema Changes
1. Create new migration file: `002_feature.sql`
2. Test locally with `supabase db reset`
3. Deploy via CI/CD pipeline
4. Update TypeScript types in `packages/types/src/db-overrides.ts`

### Type Generation
```bash
supabase gen types typescript --local > packages/types/src/database.types.ts
```

Following **D-2** from CLAUDE.md, override incorrect generated types manually.

## Known Limitations

1. **Currency Support**: Single currency per account, multi-currency transactions require conversion logic
2. **Category Depth**: No enforced limit on category hierarchy depth
3. **Rule Conflicts**: Weight-based resolution, no sophisticated conflict detection
4. **Export Formats**: Limited to CSV, QuickBooks, and Xero initially

## Next Steps

1. Define RLS policies for organization scoping
2. Implement database helper functions in `packages/db/`
3. Add comprehensive integration tests
4. Set up automated migrations in CI/CD pipeline
5. Create data seeding scripts for development environments

This schema provides a solid foundation for the Nexus financial automation platform while following all established best practices from CLAUDE.md.