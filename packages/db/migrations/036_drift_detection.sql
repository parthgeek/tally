-- 036_drift_detection.sql - Drift detection for categorization system
-- Tracks category distribution, confidence drift, and model degradation over time

-- Create weekly category distribution snapshots
CREATE TABLE IF NOT EXISTS category_distribution_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    category_id uuid NOT NULL REFERENCES categories(id),
    transaction_count integer NOT NULL DEFAULT 0,
    total_transactions integer NOT NULL, -- Total transactions for the week
    distribution_percentage numeric NOT NULL CHECK (distribution_percentage >= 0 AND distribution_percentage <= 100),
    avg_confidence numeric CHECK (avg_confidence >= 0 AND avg_confidence <= 1),
    source_breakdown jsonb DEFAULT '{}', -- {"pass1": count, "llm": count, "manual": count}
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, snapshot_date, category_id)
);

-- Create confidence drift tracking table
CREATE TABLE IF NOT EXISTS confidence_drift_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    source text NOT NULL CHECK (source IN ('pass1', 'llm', 'overall')),
    avg_confidence numeric NOT NULL CHECK (avg_confidence >= 0 AND avg_confidence <= 1),
    median_confidence numeric CHECK (median_confidence >= 0 AND median_confidence <= 1),
    p25_confidence numeric CHECK (p25_confidence >= 0 AND p25_confidence <= 1),
    p75_confidence numeric CHECK (p75_confidence >= 0 AND p75_confidence <= 1),
    p90_confidence numeric CHECK (p90_confidence >= 0 AND p90_confidence <= 1),
    transaction_count integer NOT NULL,
    low_confidence_count integer DEFAULT 0, -- Confidence < 0.6
    medium_confidence_count integer DEFAULT 0, -- Confidence 0.6-0.8
    high_confidence_count integer DEFAULT 0, -- Confidence > 0.8
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, snapshot_date, source)
);

-- Create drift alerts table
CREATE TABLE IF NOT EXISTS drift_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    alert_type text NOT NULL CHECK (alert_type IN ('category_distribution', 'confidence_drift', 'embeddings_recall', 'rule_effectiveness')),
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    metric_name text NOT NULL,
    current_value numeric NOT NULL,
    previous_value numeric,
    change_percentage numeric, -- Percentage change from previous
    threshold_exceeded numeric, -- What threshold was exceeded
    detection_date date NOT NULL,
    details jsonb DEFAULT '{}',
    is_acknowledged boolean NOT NULL DEFAULT false,
    acknowledged_at timestamptz,
    acknowledged_by uuid REFERENCES auth.users(id),
    resolution_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create model performance snapshots (overall system health)
CREATE TABLE IF NOT EXISTS model_performance_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    auto_apply_rate numeric CHECK (auto_apply_rate >= 0 AND auto_apply_rate <= 1), -- % automatically categorized
    manual_review_rate numeric CHECK (manual_review_rate >= 0 AND manual_review_rate <= 1),
    correction_rate numeric CHECK (correction_rate >= 0 AND correction_rate <= 1), -- % corrected
    avg_processing_time_ms integer,
    pass1_success_rate numeric CHECK (pass1_success_rate >= 0 AND pass1_success_rate <= 1),
    llm_invocation_rate numeric CHECK (llm_invocation_rate >= 0 AND llm_invocation_rate <= 1),
    embeddings_coverage numeric CHECK (embeddings_coverage >= 0 AND embeddings_coverage <= 1),
    total_transactions_processed integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, snapshot_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_dist_org_date ON category_distribution_snapshots(org_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_category_dist_category ON category_distribution_snapshots(org_id, category_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_confidence_drift_org_date ON confidence_drift_snapshots(org_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_confidence_drift_source ON confidence_drift_snapshots(org_id, source, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_drift_alerts_org ON drift_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_unack ON drift_alerts(org_id, is_acknowledged) WHERE is_acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_drift_alerts_date ON drift_alerts(org_id, detection_date DESC);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_type ON drift_alerts(org_id, alert_type, detection_date DESC);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_severity ON drift_alerts(severity, is_acknowledged) WHERE is_acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_model_perf_org_date ON model_performance_snapshots(org_id, snapshot_date DESC);

-- Enable RLS on new tables
ALTER TABLE category_distribution_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_drift_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for category_distribution_snapshots
DROP POLICY IF EXISTS "category_dist_select_member" ON category_distribution_snapshots;
CREATE POLICY "category_dist_select_member" ON category_distribution_snapshots
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "category_dist_insert_member" ON category_distribution_snapshots;
CREATE POLICY "category_dist_insert_member" ON category_distribution_snapshots
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

-- RLS policies for confidence_drift_snapshots
DROP POLICY IF EXISTS "confidence_drift_select_member" ON confidence_drift_snapshots;
CREATE POLICY "confidence_drift_select_member" ON confidence_drift_snapshots
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "confidence_drift_insert_member" ON confidence_drift_snapshots;
CREATE POLICY "confidence_drift_insert_member" ON confidence_drift_snapshots
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

-- RLS policies for drift_alerts
DROP POLICY IF EXISTS "drift_alerts_select_member" ON drift_alerts;
CREATE POLICY "drift_alerts_select_member" ON drift_alerts
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "drift_alerts_insert_member" ON drift_alerts;
CREATE POLICY "drift_alerts_insert_member" ON drift_alerts
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "drift_alerts_update_member" ON drift_alerts;
CREATE POLICY "drift_alerts_update_member" ON drift_alerts
    FOR UPDATE USING (public.user_in_org(org_id) = true);

-- RLS policies for model_performance_snapshots
DROP POLICY IF EXISTS "model_perf_select_member" ON model_performance_snapshots;
CREATE POLICY "model_perf_select_member" ON model_performance_snapshots
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "model_perf_insert_member" ON model_performance_snapshots;
CREATE POLICY "model_perf_insert_member" ON model_performance_snapshots
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

-- Function to create weekly category distribution snapshot
CREATE OR REPLACE FUNCTION create_category_distribution_snapshot(
    p_org_id uuid,
    p_snapshot_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start date;
    v_week_end date;
    v_total_transactions integer;
    v_snapshots_created integer := 0;
BEGIN
    -- Calculate week boundaries (Monday to Sunday)
    v_week_start := p_snapshot_date - (EXTRACT(DOW FROM p_snapshot_date)::integer - 1);
    v_week_end := v_week_start + 6;

    -- Get total transactions for the week
    SELECT COUNT(*)::integer INTO v_total_transactions
    FROM transactions
    WHERE org_id = p_org_id
        AND created_at::date >= v_week_start
        AND created_at::date <= v_week_end
        AND category_id IS NOT NULL;

    -- Skip if no transactions
    IF v_total_transactions = 0 THEN
        RETURN 0;
    END IF;

    -- Insert snapshot for each category
    INSERT INTO category_distribution_snapshots (
        org_id,
        snapshot_date,
        category_id,
        transaction_count,
        total_transactions,
        distribution_percentage,
        avg_confidence,
        source_breakdown
    )
    SELECT
        p_org_id,
        p_snapshot_date,
        t.category_id,
        COUNT(*)::integer as transaction_count,
        v_total_transactions,
        (COUNT(*)::numeric / v_total_transactions * 100) as distribution_percentage,
        AVG(t.confidence) as avg_confidence,
        jsonb_build_object(
            'pass1', COUNT(*) FILTER (WHERE t.categorization_source = 'pass1'),
            'llm', COUNT(*) FILTER (WHERE t.categorization_source = 'llm'),
            'manual', COUNT(*) FILTER (WHERE t.categorization_source = 'manual')
        ) as source_breakdown
    FROM transactions t
    WHERE t.org_id = p_org_id
        AND t.created_at::date >= v_week_start
        AND t.created_at::date <= v_week_end
        AND t.category_id IS NOT NULL
    GROUP BY t.category_id
    ON CONFLICT (org_id, snapshot_date, category_id) DO UPDATE
    SET
        transaction_count = EXCLUDED.transaction_count,
        total_transactions = EXCLUDED.total_transactions,
        distribution_percentage = EXCLUDED.distribution_percentage,
        avg_confidence = EXCLUDED.avg_confidence,
        source_breakdown = EXCLUDED.source_breakdown;

    GET DIAGNOSTICS v_snapshots_created = ROW_COUNT;
    RETURN v_snapshots_created;
END;
$$;

COMMENT ON FUNCTION create_category_distribution_snapshot IS
'Creates weekly snapshot of category distribution for drift detection. Run weekly.';

-- Function to create confidence drift snapshot
CREATE OR REPLACE FUNCTION create_confidence_drift_snapshot(
    p_org_id uuid,
    p_snapshot_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start date;
    v_week_end date;
    v_snapshots_created integer := 0;
BEGIN
    -- Calculate week boundaries
    v_week_start := p_snapshot_date - (EXTRACT(DOW FROM p_snapshot_date)::integer - 1);
    v_week_end := v_week_start + 6;

    -- Create snapshots for each source (pass1, llm, overall)
    INSERT INTO confidence_drift_snapshots (
        org_id,
        snapshot_date,
        source,
        avg_confidence,
        median_confidence,
        p25_confidence,
        p75_confidence,
        p90_confidence,
        transaction_count,
        low_confidence_count,
        medium_confidence_count,
        high_confidence_count
    )
    SELECT
        p_org_id,
        p_snapshot_date,
        COALESCE(t.categorization_source, 'overall') as source,
        AVG(t.confidence) as avg_confidence,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY t.confidence) as median_confidence,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY t.confidence) as p25_confidence,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY t.confidence) as p75_confidence,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY t.confidence) as p90_confidence,
        COUNT(*)::integer as transaction_count,
        COUNT(*) FILTER (WHERE t.confidence < 0.6)::integer as low_confidence_count,
        COUNT(*) FILTER (WHERE t.confidence >= 0.6 AND t.confidence <= 0.8)::integer as medium_confidence_count,
        COUNT(*) FILTER (WHERE t.confidence > 0.8)::integer as high_confidence_count
    FROM transactions t
    WHERE t.org_id = p_org_id
        AND t.created_at::date >= v_week_start
        AND t.created_at::date <= v_week_end
        AND t.confidence IS NOT NULL
    GROUP BY GROUPING SETS (
        (t.categorization_source),
        ()
    )
    ON CONFLICT (org_id, snapshot_date, source) DO UPDATE
    SET
        avg_confidence = EXCLUDED.avg_confidence,
        median_confidence = EXCLUDED.median_confidence,
        p25_confidence = EXCLUDED.p25_confidence,
        p75_confidence = EXCLUDED.p75_confidence,
        p90_confidence = EXCLUDED.p90_confidence,
        transaction_count = EXCLUDED.transaction_count,
        low_confidence_count = EXCLUDED.low_confidence_count,
        medium_confidence_count = EXCLUDED.medium_confidence_count,
        high_confidence_count = EXCLUDED.high_confidence_count;

    GET DIAGNOSTICS v_snapshots_created = ROW_COUNT;
    RETURN v_snapshots_created;
END;
$$;

COMMENT ON FUNCTION create_confidence_drift_snapshot IS
'Creates weekly snapshot of confidence distribution for drift detection. Run weekly.';

-- Function to detect drift and create alerts
CREATE OR REPLACE FUNCTION detect_drift_and_alert(
    p_org_id uuid,
    p_current_date date DEFAULT CURRENT_DATE,
    p_threshold_percentage numeric DEFAULT 10.0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alerts_created integer := 0;
    v_current_snapshot RECORD;
    v_previous_snapshot RECORD;
    v_change_pct numeric;
BEGIN
    -- Detect category distribution drift
    FOR v_current_snapshot IN
        SELECT category_id, distribution_percentage, transaction_count
        FROM category_distribution_snapshots
        WHERE org_id = p_org_id AND snapshot_date = p_current_date
    LOOP
        -- Get previous week's snapshot
        SELECT distribution_percentage INTO v_previous_snapshot
        FROM category_distribution_snapshots
        WHERE org_id = p_org_id
            AND category_id = v_current_snapshot.category_id
            AND snapshot_date = p_current_date - 7
        LIMIT 1;

        IF FOUND THEN
            -- Calculate percentage change
            v_change_pct := ABS(
                (v_current_snapshot.distribution_percentage - v_previous_snapshot.distribution_percentage) /
                NULLIF(v_previous_snapshot.distribution_percentage, 0) * 100
            );

            -- Create alert if threshold exceeded
            IF v_change_pct >= p_threshold_percentage THEN
                INSERT INTO drift_alerts (
                    org_id,
                    alert_type,
                    severity,
                    metric_name,
                    current_value,
                    previous_value,
                    change_percentage,
                    threshold_exceeded,
                    detection_date,
                    details
                ) VALUES (
                    p_org_id,
                    'category_distribution',
                    CASE
                        WHEN v_change_pct >= 50 THEN 'critical'
                        WHEN v_change_pct >= 25 THEN 'high'
                        WHEN v_change_pct >= 15 THEN 'medium'
                        ELSE 'low'
                    END,
                    'category_' || v_current_snapshot.category_id || '_distribution',
                    v_current_snapshot.distribution_percentage,
                    v_previous_snapshot.distribution_percentage,
                    v_change_pct,
                    p_threshold_percentage,
                    p_current_date,
                    jsonb_build_object(
                        'category_id', v_current_snapshot.category_id,
                        'current_count', v_current_snapshot.transaction_count
                    )
                );
                v_alerts_created := v_alerts_created + 1;
            END IF;
        END IF;
    END LOOP;

    -- Detect confidence drift
    FOR v_current_snapshot IN
        SELECT source, avg_confidence
        FROM confidence_drift_snapshots
        WHERE org_id = p_org_id AND snapshot_date = p_current_date
    LOOP
        SELECT avg_confidence INTO v_previous_snapshot
        FROM confidence_drift_snapshots
        WHERE org_id = p_org_id
            AND source = v_current_snapshot.source
            AND snapshot_date = p_current_date - 7
        LIMIT 1;

        IF FOUND THEN
            v_change_pct := ABS(
                (v_current_snapshot.avg_confidence - v_previous_snapshot.avg_confidence) /
                NULLIF(v_previous_snapshot.avg_confidence, 0) * 100
            );

            IF v_change_pct >= p_threshold_percentage THEN
                INSERT INTO drift_alerts (
                    org_id,
                    alert_type,
                    severity,
                    metric_name,
                    current_value,
                    previous_value,
                    change_percentage,
                    threshold_exceeded,
                    detection_date,
                    details
                ) VALUES (
                    p_org_id,
                    'confidence_drift',
                    CASE
                        WHEN v_change_pct >= 20 THEN 'high'
                        WHEN v_change_pct >= 15 THEN 'medium'
                        ELSE 'low'
                    END,
                    v_current_snapshot.source || '_avg_confidence',
                    v_current_snapshot.avg_confidence,
                    v_previous_snapshot.avg_confidence,
                    v_change_pct,
                    p_threshold_percentage,
                    p_current_date,
                    jsonb_build_object('source', v_current_snapshot.source)
                );
                v_alerts_created := v_alerts_created + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN v_alerts_created;
END;
$$;

COMMENT ON FUNCTION detect_drift_and_alert IS
'Detects drift in category distribution and confidence scores, creates alerts when thresholds exceeded.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_category_distribution_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION create_confidence_drift_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION detect_drift_and_alert TO authenticated;
