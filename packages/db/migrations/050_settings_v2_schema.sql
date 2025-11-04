-- 050_settings_v2_schema.sql
-- Add tables and columns for Settings v2 redesign
-- Supports Account (Profile, Security, Preferences), Workspace (Basics, Integrations), and Billing

-- Add user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme text DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
    locale text DEFAULT 'en-US',
    date_format text DEFAULT 'MM/DD/YYYY',
    number_format text DEFAULT 'en-US',
    reduced_motion boolean DEFAULT false,
    high_contrast boolean DEFAULT false,
    timezone text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add columns to users table for profile information
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add columns to orgs table for workspace settings
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS default_timezone text DEFAULT 'America/New_York';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS region text DEFAULT 'us-east-1';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add Stripe billing columns to orgs table
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise'));
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'active' CHECK (billing_status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete'));
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Optional: billing_invoices cache table for quick display
CREATE TABLE IF NOT EXISTS billing_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    stripe_invoice_id text NOT NULL UNIQUE,
    hosted_invoice_url text,
    invoice_pdf text,
    amount_cents bigint NOT NULL,
    currency text DEFAULT 'usd',
    status text NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    invoice_date timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON orgs(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer_id ON orgs(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_id ON billing_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_stripe_invoice_id ON billing_invoices(stripe_invoice_id);

-- RLS policies for user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert_own" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update_own" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_delete_own" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for billing_invoices
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_invoices_select_member" ON billing_invoices
    FOR SELECT USING (public.user_in_org(org_id) = true);

-- Only service role can insert/update billing invoices (webhooks)
REVOKE INSERT, UPDATE, DELETE ON billing_invoices FROM authenticated;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orgs_updated_at BEFORE UPDATE ON orgs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_preferences IS 'User-specific preferences for theme, locale, accessibility, etc.';
COMMENT ON TABLE billing_invoices IS 'Cached Stripe invoice data for quick display in Settings';
COMMENT ON COLUMN orgs.slug IS 'URL-friendly workspace identifier (e.g., acme-finance)';
COMMENT ON COLUMN orgs.stripe_customer_id IS 'Stripe Customer ID for billing';
COMMENT ON COLUMN orgs.stripe_subscription_id IS 'Active Stripe Subscription ID';
COMMENT ON COLUMN orgs.billing_email IS 'Email for billing notifications (defaults to owner email)';
COMMENT ON COLUMN orgs.plan IS 'Current subscription plan tier';
COMMENT ON COLUMN orgs.billing_status IS 'Current billing/subscription status';

