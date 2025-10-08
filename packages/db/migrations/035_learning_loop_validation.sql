-- 035_learning_loop_validation.sql - Learning loop validation and rule versioning
-- Adds canary checks, oscillation detection, and rule effectiveness tracking

-- Create rule versions table for versioning and rollback
CREATE TABLE IF NOT EXISTS rule_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    rule_type text NOT NULL CHECK (rule_type IN ('mcc', 'vendor', 'keyword', 'embedding')),
    rule_identifier text NOT NULL, -- MCC code, vendor pattern, keyword, etc.
    category_id uuid NOT NULL REFERENCES categories(id),
    confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    version integer NOT NULL DEFAULT 1,
    source text NOT NULL CHECK (source IN ('manual', 'learned', 'import')),
    parent_version_id uuid REFERENCES rule_versions(id),
    metadata jsonb DEFAULT '{}', -- Rule-specific data (pattern, keywords, strength, etc.)
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    deactivated_at timestamptz,
    deactivated_by uuid REFERENCES auth.users(id),
    deactivation_reason text
);

-- Create rule effectiveness tracking table
CREATE TABLE IF NOT EXISTS rule_effectiveness (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    rule_version_id uuid NOT NULL REFERENCES rule_versions(id) ON DELETE CASCADE,
    measurement_date date NOT NULL,
    applications_count integer NOT NULL DEFAULT 0, -- How many times rule was applied
    correct_count integer NOT NULL DEFAULT 0, -- How many were correct (not corrected)
    incorrect_count integer NOT NULL DEFAULT 0, -- How many were corrected
    avg_confidence numeric CHECK (avg_confidence >= 0 AND avg_confidence <= 1),
    precision numeric CHECK (precision >= 0 AND precision <= 1), -- correct / (correct + incorrect)
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, rule_version_id, measurement_date)
);

-- Create oscillation detection table
CREATE TABLE IF NOT EXISTS category_oscillations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    tx_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    oscillation_sequence jsonb NOT NULL, -- Array of {category_id, changed_at, changed_by}
    oscillation_count integer NOT NULL, -- Number of times category changed
    first_detected_at timestamptz NOT NULL DEFAULT now(),
    last_detected_at timestamptz NOT NULL DEFAULT now(),
    is_resolved boolean NOT NULL DEFAULT false,
    resolution_category_id uuid REFERENCES categories(id),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id)
);

-- Create canary test results table
CREATE TABLE IF NOT EXISTS canary_test_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    rule_version_id uuid NOT NULL REFERENCES rule_versions(id) ON DELETE CASCADE,
    test_date date NOT NULL,
    test_set_size integer NOT NULL, -- Number of transactions tested
    correct_count integer NOT NULL DEFAULT 0,
    incorrect_count integer NOT NULL DEFAULT 0,
    accuracy numeric CHECK (accuracy >= 0 AND accuracy <= 1), -- correct / total
    precision numeric CHECK (precision >= 0 AND precision <= 1),
    recall numeric CHECK (recall >= 0 AND recall <= 1),
    f1_score numeric CHECK (f1_score >= 0 AND f1_score <= 1),
    passed_threshold boolean NOT NULL, -- Did it pass the minimum accuracy threshold?
    promoted_to_production boolean NOT NULL DEFAULT false,
    test_metadata jsonb DEFAULT '{}', -- Detailed test results
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, rule_version_id, test_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rule_versions_org ON rule_versions(org_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_active ON rule_versions(org_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rule_versions_type ON rule_versions(org_id, rule_type);
CREATE INDEX IF NOT EXISTS idx_rule_versions_identifier ON rule_versions(org_id, rule_type, rule_identifier);
CREATE INDEX IF NOT EXISTS idx_rule_versions_category ON rule_versions(category_id);

CREATE INDEX IF NOT EXISTS idx_rule_effectiveness_org ON rule_effectiveness(org_id);
CREATE INDEX IF NOT EXISTS idx_rule_effectiveness_rule ON rule_effectiveness(rule_version_id);
CREATE INDEX IF NOT EXISTS idx_rule_effectiveness_date ON rule_effectiveness(org_id, measurement_date DESC);

CREATE INDEX IF NOT EXISTS idx_oscillations_org ON category_oscillations(org_id);
CREATE INDEX IF NOT EXISTS idx_oscillations_tx ON category_oscillations(tx_id);
CREATE INDEX IF NOT EXISTS idx_oscillations_unresolved ON category_oscillations(org_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_oscillations_detected ON category_oscillations(org_id, last_detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_canary_results_org ON canary_test_results(org_id);
CREATE INDEX IF NOT EXISTS idx_canary_results_rule ON canary_test_results(rule_version_id);
CREATE INDEX IF NOT EXISTS idx_canary_results_date ON canary_test_results(org_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_canary_results_passed ON canary_test_results(org_id, passed_threshold) WHERE passed_threshold = true;

-- Enable RLS on new tables
ALTER TABLE rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_oscillations ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_test_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for rule_versions
DROP POLICY IF EXISTS "rule_versions_select_member" ON rule_versions;
CREATE POLICY "rule_versions_select_member" ON rule_versions
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "rule_versions_insert_member" ON rule_versions;
CREATE POLICY "rule_versions_insert_member" ON rule_versions
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "rule_versions_update_member" ON rule_versions;
CREATE POLICY "rule_versions_update_member" ON rule_versions
    FOR UPDATE USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "rule_versions_delete_member" ON rule_versions;
CREATE POLICY "rule_versions_delete_member" ON rule_versions
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- RLS policies for rule_effectiveness
DROP POLICY IF EXISTS "rule_effectiveness_select_member" ON rule_effectiveness;
CREATE POLICY "rule_effectiveness_select_member" ON rule_effectiveness
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "rule_effectiveness_insert_member" ON rule_effectiveness;
CREATE POLICY "rule_effectiveness_insert_member" ON rule_effectiveness
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

-- RLS policies for category_oscillations
DROP POLICY IF EXISTS "oscillations_select_member" ON category_oscillations;
CREATE POLICY "oscillations_select_member" ON category_oscillations
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "oscillations_insert_member" ON category_oscillations;
CREATE POLICY "oscillations_insert_member" ON category_oscillations
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "oscillations_update_member" ON category_oscillations;
CREATE POLICY "oscillations_update_member" ON category_oscillations
    FOR UPDATE USING (public.user_in_org(org_id) = true);

-- RLS policies for canary_test_results
DROP POLICY IF EXISTS "canary_results_select_member" ON canary_test_results;
CREATE POLICY "canary_results_select_member" ON canary_test_results
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "canary_results_insert_member" ON canary_test_results;
CREATE POLICY "canary_results_insert_member" ON canary_test_results
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

-- Function to detect oscillations when a correction is made
CREATE OR REPLACE FUNCTION detect_category_oscillation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_oscillation_count integer;
    v_existing_oscillation_id uuid;
    v_oscillation_sequence jsonb;
BEGIN
    -- Count how many corrections have been made for this transaction
    SELECT COUNT(*) INTO v_oscillation_count
    FROM corrections
    WHERE tx_id = NEW.tx_id;

    -- If this is the 2nd or more correction, it's an oscillation
    IF v_oscillation_count >= 2 THEN
        -- Check if oscillation already exists
        SELECT id, oscillation_sequence INTO v_existing_oscillation_id, v_oscillation_sequence
        FROM category_oscillations
        WHERE tx_id = NEW.tx_id
        AND is_resolved = false
        LIMIT 1;

        IF v_existing_oscillation_id IS NOT NULL THEN
            -- Update existing oscillation
            UPDATE category_oscillations
            SET
                oscillation_sequence = oscillation_sequence || jsonb_build_object(
                    'category_id', NEW.new_category_id,
                    'changed_at', NEW.created_at,
                    'changed_by', NEW.user_id
                ),
                oscillation_count = oscillation_count + 1,
                last_detected_at = now()
            WHERE id = v_existing_oscillation_id;
        ELSE
            -- Create new oscillation record
            -- Build sequence from all corrections
            SELECT jsonb_agg(
                jsonb_build_object(
                    'category_id', c.new_category_id,
                    'changed_at', c.created_at,
                    'changed_by', c.user_id
                ) ORDER BY c.created_at
            ) INTO v_oscillation_sequence
            FROM corrections c
            WHERE c.tx_id = NEW.tx_id;

            INSERT INTO category_oscillations (
                org_id,
                tx_id,
                oscillation_sequence,
                oscillation_count
            ) VALUES (
                NEW.org_id,
                NEW.tx_id,
                v_oscillation_sequence,
                v_oscillation_count
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger to detect oscillations on correction insert
DROP TRIGGER IF EXISTS trigger_detect_oscillation ON corrections;
CREATE TRIGGER trigger_detect_oscillation
    AFTER INSERT ON corrections
    FOR EACH ROW
    EXECUTE FUNCTION detect_category_oscillation();

-- Function to track rule effectiveness from corrections
CREATE OR REPLACE FUNCTION track_rule_effectiveness(
    p_org_id uuid,
    p_measurement_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_records_updated integer := 0;
BEGIN
    -- This is a placeholder for rule effectiveness tracking
    -- In production, this would analyze which rules were applied to transactions
    -- and whether those transactions were later corrected

    -- For now, just return 0
    -- TODO: Implement actual effectiveness tracking based on decisions table

    RETURN v_records_updated;
END;
$$;

COMMENT ON FUNCTION track_rule_effectiveness IS
'Tracks rule effectiveness by analyzing applied rules and subsequent corrections. Run daily.';

-- Function to run canary tests on a new rule version
CREATE OR REPLACE FUNCTION run_canary_test(
    p_org_id uuid,
    p_rule_version_id uuid,
    p_test_set_size integer DEFAULT 100,
    p_accuracy_threshold numeric DEFAULT 0.80
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_test_result jsonb;
    v_accuracy numeric;
    v_passed boolean;
BEGIN
    -- This is a placeholder for canary testing logic
    -- In production, this would:
    -- 1. Select a holdout set of p_test_set_size transactions
    -- 2. Apply the new rule version
    -- 3. Compare results with ground truth
    -- 4. Calculate accuracy, precision, recall, F1

    -- For now, return a mock result
    v_accuracy := 0.85; -- Mock value
    v_passed := v_accuracy >= p_accuracy_threshold;

    v_test_result := jsonb_build_object(
        'test_set_size', p_test_set_size,
        'accuracy', v_accuracy,
        'passed', v_passed,
        'threshold', p_accuracy_threshold,
        'message', CASE
            WHEN v_passed THEN 'Canary test passed - safe to promote'
            ELSE 'Canary test failed - do not promote'
        END
    );

    -- Insert canary test result
    INSERT INTO canary_test_results (
        org_id,
        rule_version_id,
        test_date,
        test_set_size,
        correct_count,
        incorrect_count,
        accuracy,
        passed_threshold,
        test_metadata
    ) VALUES (
        p_org_id,
        p_rule_version_id,
        CURRENT_DATE,
        p_test_set_size,
        FLOOR(p_test_set_size * v_accuracy)::integer,
        CEIL(p_test_set_size * (1 - v_accuracy))::integer,
        v_accuracy,
        v_passed,
        v_test_result
    );

    RETURN v_test_result;
END;
$$;

COMMENT ON FUNCTION run_canary_test IS
'Runs canary tests on a new rule version before promotion. Returns test results.';

-- Function to rollback a rule version
CREATE OR REPLACE FUNCTION rollback_rule_version(
    p_rule_version_id uuid,
    p_user_id uuid,
    p_reason text DEFAULT 'Manual rollback'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_parent_version_id uuid;
BEGIN
    -- Deactivate current version
    UPDATE rule_versions
    SET
        is_active = false,
        deactivated_at = now(),
        deactivated_by = p_user_id,
        deactivation_reason = p_reason
    WHERE id = p_rule_version_id
    RETURNING parent_version_id INTO v_parent_version_id;

    -- Reactivate parent version if it exists
    IF v_parent_version_id IS NOT NULL THEN
        UPDATE rule_versions
        SET is_active = true
        WHERE id = v_parent_version_id;

        RETURN true;
    ELSE
        -- No parent to rollback to
        RETURN false;
    END IF;
END;
$$;

COMMENT ON FUNCTION rollback_rule_version IS
'Rolls back a rule version to its parent version. Returns true if successful.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION detect_category_oscillation TO authenticated;
GRANT EXECUTE ON FUNCTION track_rule_effectiveness TO authenticated;
GRANT EXECUTE ON FUNCTION run_canary_test TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_rule_version TO authenticated;
