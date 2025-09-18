-- 014_connection_disconnect.sql - Add disconnect functionality for connections
-- Adds disconnect status and timestamp for proper connection lifecycle management

-- Add disconnected_at timestamp to connections table
ALTER TABLE connections ADD COLUMN IF NOT EXISTS disconnected_at timestamptz NULL;

-- First, update any existing rows with invalid status values to valid ones
-- This prevents the constraint violation error
UPDATE connections 
SET status = 'active' 
WHERE status NOT IN ('active', 'inactive', 'error', 'pending', 'disconnected');

-- Update status constraint to include 'disconnected' status
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_status_check;
ALTER TABLE connections ADD CONSTRAINT connections_status_check
CHECK (status IN ('active', 'inactive', 'error', 'pending', 'disconnected'));

-- Create index for efficient querying of disconnected connections
CREATE INDEX IF NOT EXISTS idx_connections_status_disconnected_at
ON connections(status, disconnected_at)
WHERE status = 'disconnected';

-- Create index for org + status queries (common pattern in connections list)
CREATE INDEX IF NOT EXISTS idx_connections_org_status
ON connections(org_id, status);

-- Add audit logging function for disconnect operations
CREATE OR REPLACE FUNCTION log_connection_disconnect()
RETURNS TRIGGER AS $$
BEGIN
    -- Log when a connection is marked as disconnected
    IF NEW.status = 'disconnected' AND OLD.status != 'disconnected' THEN
        INSERT INTO audit_log (
            table_name,
            operation,
            record_id,
            org_id,
            changed_by,
            changes,
            created_at
        ) VALUES (
            'connections',
            'disconnect',
            NEW.id,
            NEW.org_id,
            current_setting('app.current_user_id', true),
            json_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'disconnected_at', NEW.disconnected_at,
                'provider', NEW.provider,
                'provider_item_id', NEW.provider_item_id
            ),
            now()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit_log table if it doesn't exist (for disconnect audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    operation text NOT NULL,
    record_id uuid NOT NULL,
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    changed_by text,
    changes jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_log and create policy
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_org_access" ON audit_log;
CREATE POLICY "audit_log_org_access" ON audit_log
    FOR ALL USING (public.user_in_org(org_id) = true);

-- Create trigger for connection disconnect audit logging
DROP TRIGGER IF EXISTS connection_disconnect_audit ON connections;
CREATE TRIGGER connection_disconnect_audit
    AFTER UPDATE ON connections
    FOR EACH ROW
    EXECUTE FUNCTION log_connection_disconnect();

-- Add indexes for audit log performance
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation ON audit_log(table_name, operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Create database function for atomic disconnect operation
CREATE OR REPLACE FUNCTION disconnect_connection(
    p_connection_id uuid,
    p_org_id uuid,
    p_user_id text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Set current user context for audit logging
    IF p_user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_user_id, true);
    END IF;

    -- Update connection status to disconnected
    UPDATE connections
    SET
        status = 'disconnected',
        disconnected_at = now()
    WHERE
        id = p_connection_id
        AND org_id = p_org_id
        AND status != 'disconnected';

    -- Verify the update happened
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection not found or already disconnected';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- RLS policy for disconnect operations (service role needs full access)
DROP POLICY IF EXISTS "connections_disconnect_access" ON connections;
CREATE POLICY "connections_disconnect_access" ON connections
    FOR UPDATE USING (
        public.user_in_org(org_id) = true
        OR current_setting('role') = 'service_role'
    )
    WITH CHECK (
        public.user_in_org(org_id) = true
        OR current_setting('role') = 'service_role'
    );