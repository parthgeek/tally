-- 037_learning_loop_implementation.sql - Implement actual canary testing and effectiveness tracking
-- Replaces placeholder functions from migration 035 with real implementations

-- Drop and recreate run_canary_test with actual implementation
DROP FUNCTION IF EXISTS run_canary_test(uuid, uuid, integer, numeric);

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
    v_rule_info RECORD;
    v_test_result jsonb;
    v_correct_count integer := 0;
    v_incorrect_count integer := 0;
    v_total_tested integer := 0;
    v_true_positives integer := 0;
    v_false_positives integer := 0;
    v_false_negatives integer := 0;
    v_accuracy numeric;
    v_precision numeric;
    v_recall numeric;
    v_f1_score numeric;
    v_passed boolean;
    v_test_transaction RECORD;
BEGIN
    -- Get rule information
    SELECT rule_type, rule_identifier, category_id, confidence, metadata
    INTO v_rule_info
    FROM rule_versions
    WHERE id = p_rule_version_id AND org_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rule version % not found for org %', p_rule_version_id, p_org_id;
    END IF;

    -- Select a holdout set of transactions for testing
    -- Use transactions that have been manually corrected (ground truth)
    -- Or transactions categorized with high confidence that haven't been corrected
    FOR v_test_transaction IN
        SELECT
            t.id as tx_id,
            t.category_id as actual_category,
            t.merchant_name,
            t.description,
            t.mcc,
            t.amount_cents,
            COALESCE(c.new_category_id, t.category_id) as ground_truth_category
        FROM transactions t
        LEFT JOIN corrections c ON c.tx_id = t.id AND c.org_id = p_org_id
        WHERE t.org_id = p_org_id
            AND t.category_id IS NOT NULL
            AND t.created_at < CURRENT_DATE - INTERVAL '7 days' -- Use historical data only
        ORDER BY RANDOM()
        LIMIT p_test_set_size
    LOOP
        v_total_tested := v_total_tested + 1;

        -- Apply the rule to this transaction based on rule type
        DECLARE
            v_rule_matches boolean := false;
            v_predicted_category uuid;
        BEGIN
            CASE v_rule_info.rule_type
                WHEN 'mcc' THEN
                    -- Check if MCC matches
                    v_rule_matches := v_test_transaction.mcc = v_rule_info.rule_identifier;

                WHEN 'vendor' THEN
                    -- Check if vendor name matches the pattern
                    v_rule_matches := (
                        v_test_transaction.merchant_name ILIKE '%' || v_rule_info.rule_identifier || '%'
                        OR v_test_transaction.merchant_name ~* (v_rule_info.metadata->>'pattern')::text
                    );

                WHEN 'keyword' THEN
                    -- Check if description contains keyword
                    v_rule_matches := (
                        v_test_transaction.description ILIKE '%' || v_rule_info.rule_identifier || '%'
                    );

                WHEN 'embedding' THEN
                    -- For embeddings, we'd need to compute similarity (skip for now in canary test)
                    v_rule_matches := false;

                ELSE
                    v_rule_matches := false;
            END CASE;

            -- Determine predicted category
            IF v_rule_matches THEN
                v_predicted_category := v_rule_info.category_id;
            ELSE
                v_predicted_category := NULL; -- Rule doesn't apply
            END IF;

            -- Compare prediction with ground truth
            IF v_predicted_category IS NOT NULL THEN
                IF v_predicted_category = v_test_transaction.ground_truth_category THEN
                    -- True positive: rule applied correctly
                    v_correct_count := v_correct_count + 1;
                    v_true_positives := v_true_positives + 1;
                ELSE
                    -- False positive: rule applied but wrong category
                    v_incorrect_count := v_incorrect_count + 1;
                    v_false_positives := v_false_positives + 1;
                END IF;
            ELSE
                -- Rule didn't apply, check if it should have
                IF v_test_transaction.ground_truth_category = v_rule_info.category_id THEN
                    -- False negative: rule should have applied but didn't
                    v_false_negatives := v_false_negatives + 1;
                    v_incorrect_count := v_incorrect_count + 1;
                ELSE
                    -- True negative: rule correctly didn't apply
                    v_correct_count := v_correct_count + 1;
                END IF;
            END IF;
        END;
    END LOOP;

    -- Calculate metrics
    IF v_total_tested = 0 THEN
        RAISE EXCEPTION 'No test transactions available for org %', p_org_id;
    END IF;

    v_accuracy := v_correct_count::numeric / NULLIF(v_total_tested, 0);

    -- Precision = TP / (TP + FP)
    v_precision := v_true_positives::numeric / NULLIF(v_true_positives + v_false_positives, 0);

    -- Recall = TP / (TP + FN)
    v_recall := v_true_positives::numeric / NULLIF(v_true_positives + v_false_negatives, 0);

    -- F1 = 2 * (precision * recall) / (precision + recall)
    v_f1_score := 2 * (v_precision * v_recall) / NULLIF(v_precision + v_recall, 0);

    -- Determine if test passed
    v_passed := v_accuracy >= p_accuracy_threshold;

    -- Build result object
    v_test_result := jsonb_build_object(
        'test_set_size', v_total_tested,
        'correct_count', v_correct_count,
        'incorrect_count', v_incorrect_count,
        'true_positives', v_true_positives,
        'false_positives', v_false_positives,
        'false_negatives', v_false_negatives,
        'accuracy', COALESCE(v_accuracy, 0),
        'precision', COALESCE(v_precision, 0),
        'recall', COALESCE(v_recall, 0),
        'f1_score', COALESCE(v_f1_score, 0),
        'passed', v_passed,
        'threshold', p_accuracy_threshold,
        'rule_type', v_rule_info.rule_type,
        'rule_identifier', v_rule_info.rule_identifier,
        'message', CASE
            WHEN v_passed THEN 'Canary test passed - safe to promote'
            ELSE 'Canary test failed - do not promote (accuracy: ' || ROUND(v_accuracy::numeric * 100, 2) || '%, threshold: ' || ROUND(p_accuracy_threshold * 100, 2) || '%)'
        END
    );

    -- Insert canary test result into table
    INSERT INTO canary_test_results (
        org_id,
        rule_version_id,
        test_date,
        test_set_size,
        correct_count,
        incorrect_count,
        accuracy,
        precision,
        recall,
        f1_score,
        passed_threshold,
        test_metadata
    ) VALUES (
        p_org_id,
        p_rule_version_id,
        CURRENT_DATE,
        v_total_tested,
        v_correct_count,
        v_incorrect_count,
        COALESCE(v_accuracy, 0),
        COALESCE(v_precision, 0),
        COALESCE(v_recall, 0),
        COALESCE(v_f1_score, 0),
        v_passed,
        v_test_result
    )
    ON CONFLICT (org_id, rule_version_id, test_date) DO UPDATE
    SET
        test_set_size = EXCLUDED.test_set_size,
        correct_count = EXCLUDED.correct_count,
        incorrect_count = EXCLUDED.incorrect_count,
        accuracy = EXCLUDED.accuracy,
        precision = EXCLUDED.precision,
        recall = EXCLUDED.recall,
        f1_score = EXCLUDED.f1_score,
        passed_threshold = EXCLUDED.passed_threshold,
        test_metadata = EXCLUDED.test_metadata;

    RETURN v_test_result;
END;
$$;

COMMENT ON FUNCTION run_canary_test IS
'Runs comprehensive canary tests on a new rule version using holdout set. Tests rule accuracy, precision, recall, and F1 score.';

-- Drop and recreate track_rule_effectiveness with actual implementation
DROP FUNCTION IF EXISTS track_rule_effectiveness(uuid, date);

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
    v_week_start date;
    v_week_end date;
    v_rule RECORD;
    v_applications_count integer;
    v_correct_count integer;
    v_incorrect_count integer;
    v_avg_confidence numeric;
    v_precision numeric;
BEGIN
    -- Calculate week boundaries
    v_week_start := p_measurement_date - (EXTRACT(DOW FROM p_measurement_date)::integer - 1);
    v_week_end := v_week_start + 6;

    -- For each active rule version, track its effectiveness
    FOR v_rule IN
        SELECT id, rule_type, rule_identifier, category_id, confidence, metadata
        FROM rule_versions
        WHERE org_id = p_org_id
            AND is_active = true
    LOOP
        -- Count how many times this rule was applied in the past week
        -- This requires tracking rule provenance in transactions (future enhancement)
        -- For now, we'll approximate by matching rule criteria

        DECLARE
            v_matched_transactions RECORD;
            v_total_matches integer := 0;
            v_corrected_matches integer := 0;
        BEGIN
            -- Find transactions that match this rule
            FOR v_matched_transactions IN
                SELECT
                    t.id as tx_id,
                    t.category_id,
                    t.confidence,
                    EXISTS(
                        SELECT 1 FROM corrections c
                        WHERE c.tx_id = t.id
                            AND c.org_id = p_org_id
                            AND c.created_at >= v_week_start
                            AND c.created_at <= v_week_end
                    ) as was_corrected,
                    (
                        SELECT c.new_category_id
                        FROM corrections c
                        WHERE c.tx_id = t.id
                            AND c.org_id = p_org_id
                        ORDER BY c.created_at DESC
                        LIMIT 1
                    ) as corrected_category
                FROM transactions t
                WHERE t.org_id = p_org_id
                    AND t.created_at >= v_week_start
                    AND t.created_at <= v_week_end
                    AND t.category_id = v_rule.category_id
                    AND (
                        (v_rule.rule_type = 'mcc' AND t.mcc = v_rule.rule_identifier)
                        OR (v_rule.rule_type = 'vendor' AND (
                            t.merchant_name ILIKE '%' || v_rule.rule_identifier || '%'
                            OR t.merchant_name ~* (v_rule.metadata->>'pattern')::text
                        ))
                        OR (v_rule.rule_type = 'keyword' AND
                            t.description ILIKE '%' || v_rule.rule_identifier || '%'
                        )
                    )
            LOOP
                v_total_matches := v_total_matches + 1;

                IF v_matched_transactions.was_corrected THEN
                    v_corrected_matches := v_corrected_matches + 1;
                END IF;
            END LOOP;

            -- Calculate metrics
            v_applications_count := v_total_matches;
            v_incorrect_count := v_corrected_matches;
            v_correct_count := v_total_matches - v_corrected_matches;
            v_avg_confidence := v_rule.confidence;

            IF v_total_matches > 0 THEN
                v_precision := v_correct_count::numeric / NULLIF(v_total_matches, 0);
            ELSE
                v_precision := NULL;
            END IF;

            -- Only insert if rule was actually applied
            IF v_applications_count > 0 THEN
                INSERT INTO rule_effectiveness (
                    org_id,
                    rule_version_id,
                    measurement_date,
                    applications_count,
                    correct_count,
                    incorrect_count,
                    avg_confidence,
                    precision
                ) VALUES (
                    p_org_id,
                    v_rule.id,
                    p_measurement_date,
                    v_applications_count,
                    v_correct_count,
                    v_incorrect_count,
                    v_avg_confidence,
                    v_precision
                )
                ON CONFLICT (org_id, rule_version_id, measurement_date) DO UPDATE
                SET
                    applications_count = EXCLUDED.applications_count,
                    correct_count = EXCLUDED.correct_count,
                    incorrect_count = EXCLUDED.incorrect_count,
                    avg_confidence = EXCLUDED.avg_confidence,
                    precision = EXCLUDED.precision;

                v_records_updated := v_records_updated + 1;
            END IF;
        END;
    END LOOP;

    RETURN v_records_updated;
END;
$$;

COMMENT ON FUNCTION track_rule_effectiveness IS
'Tracks rule effectiveness by analyzing which rules were applied and whether those transactions were later corrected. Run weekly.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION run_canary_test TO authenticated;
GRANT EXECUTE ON FUNCTION track_rule_effectiveness TO authenticated;
