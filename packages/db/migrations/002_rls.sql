-- 002_rls.sql - Row Level Security policies for Nexus platform

-- Helper function to check if current user belongs to an organization
CREATE OR REPLACE FUNCTION public.user_in_org(target_org uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM user_org_roles 
        WHERE user_id = auth.uid() 
        AND org_id = target_org
    );
$$;

-- Ensure RLS is enabled on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Users table policies - users can only access their own record
CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (id = auth.uid());

-- Organizations table policies
CREATE POLICY "orgs_select_member" ON orgs
    FOR SELECT USING (public.user_in_org(id) = true);

CREATE POLICY "orgs_insert_member" ON orgs
    FOR INSERT WITH CHECK (public.user_in_org(id) = true);

CREATE POLICY "orgs_update_member" ON orgs
    FOR UPDATE USING (public.user_in_org(id) = true);

CREATE POLICY "orgs_delete_member" ON orgs
    FOR DELETE USING (public.user_in_org(id) = true);

-- User organization roles table policies
CREATE POLICY "user_org_roles_select_member" ON user_org_roles
    FOR SELECT USING (public.user_in_org(org_id) = true);

CREATE POLICY "user_org_roles_insert_member" ON user_org_roles
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

CREATE POLICY "user_org_roles_update_member" ON user_org_roles
    FOR UPDATE USING (public.user_in_org(org_id) = true);

CREATE POLICY "user_org_roles_delete_member" ON user_org_roles
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- Connections table policies
CREATE POLICY "connections_select_member" ON connections
    FOR SELECT USING (public.user_in_org(org_id) = true);

CREATE POLICY "connections_insert_member" ON connections
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

CREATE POLICY "connections_update_member" ON connections
    FOR UPDATE USING (public.user_in_org(org_id) = true);

CREATE POLICY "connections_delete_member" ON connections
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- Accounts table policies
CREATE POLICY "accounts_select_member" ON accounts
    FOR SELECT USING (public.user_in_org(org_id) = true);

CREATE POLICY "accounts_insert_member" ON accounts
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

CREATE POLICY "accounts_update_member" ON accounts
    FOR UPDATE USING (public.user_in_org(org_id) = true);

CREATE POLICY "accounts_delete_member" ON accounts
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- Categories table policies - special handling for global categories (org_id = NULL)
CREATE POLICY "categories_select_global_or_member" ON categories
    FOR SELECT USING (org_id IS NULL OR public.user_in_org(org_id) = true);

CREATE POLICY "categories_insert_member_only" ON categories
    FOR INSERT WITH CHECK (org_id IS NOT NULL AND public.user_in_org(org_id) = true);

CREATE POLICY "categories_update_member_only" ON categories
    FOR UPDATE USING (org_id IS NOT NULL AND public.user_in_org(org_id) = true);

CREATE POLICY "categories_delete_member_only" ON categories
    FOR DELETE USING (org_id IS NOT NULL AND public.user_in_org(org_id) = true);

-- Rules table policies
CREATE POLICY "rules_select_member" ON rules
    FOR SELECT USING (public.user_in_org(org_id) = true);

CREATE POLICY "rules_insert_member" ON rules
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

CREATE POLICY "rules_update_member" ON rules
    FOR UPDATE USING (public.user_in_org(org_id) = true);

CREATE POLICY "rules_delete_member" ON rules
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- Receipts table policies
CREATE POLICY "receipts_select_member" ON receipts
    FOR SELECT USING (public.user_in_org(org_id) = true);

CREATE POLICY "receipts_insert_member" ON receipts
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

CREATE POLICY "receipts_update_member" ON receipts
    FOR UPDATE USING (public.user_in_org(org_id) = true);

CREATE POLICY "receipts_delete_member" ON receipts
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- Transactions table policies
CREATE POLICY "transactions_select_member" ON transactions
    FOR SELECT USING (public.user_in_org(org_id) = true);

CREATE POLICY "transactions_insert_member" ON transactions
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

CREATE POLICY "transactions_update_member" ON transactions
    FOR UPDATE USING (public.user_in_org(org_id) = true);

CREATE POLICY "transactions_delete_member" ON transactions
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- Exports table policies
CREATE POLICY "exports_select_member" ON exports
    FOR SELECT USING (public.user_in_org(org_id) = true);

CREATE POLICY "exports_insert_member" ON exports
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

CREATE POLICY "exports_update_member" ON exports
    FOR UPDATE USING (public.user_in_org(org_id) = true);

CREATE POLICY "exports_delete_member" ON exports
    FOR DELETE USING (public.user_in_org(org_id) = true);