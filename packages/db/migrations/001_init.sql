-- 001_init.sql - Initial schema for Nexus financial automation platform

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    name text,
    created_at timestamptz DEFAULT now()
);

-- Organizations
CREATE TABLE orgs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    industry text,
    timezone text,
    owner_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- User organization roles
CREATE TABLE user_org_roles (
    user_id uuid REFERENCES auth.users(id),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    role text CHECK (role IN ('owner', 'admin', 'member')),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, org_id)
);

-- External service connections (Plaid, Square, etc.)
CREATE TABLE connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    provider text NOT NULL,
    status text NOT NULL,
    scopes text[],
    created_at timestamptz DEFAULT now()
);

-- Financial accounts (bank accounts, credit cards, etc.)
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

-- Transaction categories
CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NULL REFERENCES orgs(id) ON DELETE CASCADE, -- NULL for global categories
    name text NOT NULL,
    parent_id uuid NULL REFERENCES categories(id),
    created_at timestamptz DEFAULT now()
);

-- Categorization rules
CREATE TABLE rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    pattern jsonb NOT NULL,
    category_id uuid REFERENCES categories(id),
    weight numeric NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Receipt OCR data
CREATE TABLE receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    ocr_text text,
    vendor text,
    total_cents bigint,
    created_at timestamptz DEFAULT now()
);

-- Financial transactions
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

-- Data exports
CREATE TABLE exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    type text CHECK (type IN ('csv', 'qbo', 'xero')),
    params jsonb,
    status text NOT NULL,
    url text,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_orgs_owner_user_id ON orgs(owner_user_id);
CREATE INDEX idx_user_org_roles_user_id ON user_org_roles(user_id);
CREATE INDEX idx_user_org_roles_org_id ON user_org_roles(org_id);
CREATE INDEX idx_connections_org_id ON connections(org_id);
CREATE INDEX idx_accounts_org_id ON accounts(org_id);
CREATE INDEX idx_accounts_connection_id ON accounts(connection_id);
CREATE INDEX idx_categories_org_id ON categories(org_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE UNIQUE INDEX idx_categories_org_name ON categories(org_id, name);
CREATE INDEX idx_rules_org_id ON rules(org_id);
CREATE INDEX idx_receipts_org_id ON receipts(org_id);
CREATE INDEX idx_transactions_org_id ON transactions(org_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_org_date ON transactions(org_id, date);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_receipt_id ON transactions(receipt_id);
CREATE INDEX idx_exports_org_id ON exports(org_id);

-- Enable Row Level Security (RLS) on all business tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Seed global default categories for salon taxonomy
INSERT INTO categories (id, org_id, name) VALUES
    -- Revenue Categories
    ('550e8400-e29b-41d4-a716-446655440001', NULL, 'Revenue'),
    ('550e8400-e29b-41d4-a716-446655440002', NULL, 'Hair Services'),
    ('550e8400-e29b-41d4-a716-446655440003', NULL, 'Nail Services'), 
    ('550e8400-e29b-41d4-a716-446655440004', NULL, 'Skin Care Services'),
    ('550e8400-e29b-41d4-a716-446655440005', NULL, 'Massage Services'),
    ('550e8400-e29b-41d4-a716-446655440006', NULL, 'Product Sales'),
    ('550e8400-e29b-41d4-a716-446655440007', NULL, 'Gift Cards'),
    
    -- Expense Categories
    ('550e8400-e29b-41d4-a716-446655440010', NULL, 'Expenses'),
    ('550e8400-e29b-41d4-a716-446655440011', NULL, 'Rent & Utilities'),
    ('550e8400-e29b-41d4-a716-446655440012', NULL, 'Supplies & Inventory'),
    ('550e8400-e29b-41d4-a716-446655440013', NULL, 'Equipment & Maintenance'),
    ('550e8400-e29b-41d4-a716-446655440014', NULL, 'Staff Wages & Benefits'),
    ('550e8400-e29b-41d4-a716-446655440015', NULL, 'Marketing & Advertising'),
    ('550e8400-e29b-41d4-a716-446655440016', NULL, 'Professional Services'),
    ('550e8400-e29b-41d4-a716-446655440017', NULL, 'Insurance'),
    ('550e8400-e29b-41d4-a716-446655440018', NULL, 'Licenses & Permits'),
    ('550e8400-e29b-41d4-a716-446655440019', NULL, 'Training & Education'),
    ('550e8400-e29b-41d4-a716-446655440020', NULL, 'Software & Technology'),
    ('550e8400-e29b-41d4-a716-446655440021', NULL, 'Bank Fees & Interest'),
    ('550e8400-e29b-41d4-a716-446655440022', NULL, 'Travel & Transportation'),
    ('550e8400-e29b-41d4-a716-446655440023', NULL, 'Office Supplies'),
    ('550e8400-e29b-41d4-a716-446655440024', NULL, 'Other Operating Expenses');

-- Set up parent-child relationships for categories
UPDATE categories SET parent_id = '550e8400-e29b-41d4-a716-446655440001' WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440002', -- Hair Services
    '550e8400-e29b-41d4-a716-446655440003', -- Nail Services
    '550e8400-e29b-41d4-a716-446655440004', -- Skin Care Services
    '550e8400-e29b-41d4-a716-446655440005', -- Massage Services
    '550e8400-e29b-41d4-a716-446655440006', -- Product Sales
    '550e8400-e29b-41d4-a716-446655440007'  -- Gift Cards
);

UPDATE categories SET parent_id = '550e8400-e29b-41d4-a716-446655440010' WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440011', -- Rent & Utilities
    '550e8400-e29b-41d4-a716-446655440012', -- Supplies & Inventory
    '550e8400-e29b-41d4-a716-446655440013', -- Equipment & Maintenance
    '550e8400-e29b-41d4-a716-446655440014', -- Staff Wages & Benefits
    '550e8400-e29b-41d4-a716-446655440015', -- Marketing & Advertising
    '550e8400-e29b-41d4-a716-446655440016', -- Professional Services
    '550e8400-e29b-41d4-a716-446655440017', -- Insurance
    '550e8400-e29b-41d4-a716-446655440018', -- Licenses & Permits
    '550e8400-e29b-41d4-a716-446655440019', -- Training & Education
    '550e8400-e29b-41d4-a716-446655440020', -- Software & Technology
    '550e8400-e29b-41d4-a716-446655440021', -- Bank Fees & Interest
    '550e8400-e29b-41d4-a716-446655440022', -- Travel & Transportation
    '550e8400-e29b-41d4-a716-446655440023', -- Office Supplies
    '550e8400-e29b-41d4-a716-446655440024'  -- Other Operating Expenses
);