-- 034_embeddings_enhancements.sql - Enhanced embeddings system for semantic vendor matching
-- Adds category tracking, confidence tracking, and stability validation

-- Add missing columns to vendor_embeddings table
ALTER TABLE vendor_embeddings ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id);
ALTER TABLE vendor_embeddings ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1);
ALTER TABLE vendor_embeddings ADD COLUMN IF NOT EXISTS transaction_count integer DEFAULT 1 CHECK (transaction_count > 0);
ALTER TABLE vendor_embeddings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Create embedding matches tracking table for stability validation
CREATE TABLE IF NOT EXISTS embedding_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    tx_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    matched_vendor text NOT NULL,
    similarity_score numeric NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    matched_category_id uuid REFERENCES categories(id),
    contributed_to_decision boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create embedding stability snapshots for drift detection
CREATE TABLE IF NOT EXISTS embedding_stability_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    vendor text NOT NULL,
    category_id uuid REFERENCES categories(id),
    embedding_version text NOT NULL DEFAULT 'v1',
    sample_matches jsonb NOT NULL, -- Array of {vendor, similarity, date}
    avg_similarity numeric CHECK (avg_similarity >= 0 AND avg_similarity <= 1),
    match_count integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, snapshot_date, vendor)
);

-- Create view for nearest-neighbor search helper
CREATE OR REPLACE VIEW embedding_search_candidates AS
SELECT
    ve.org_id,
    ve.vendor,
    ve.category_id,
    ve.confidence,
    ve.transaction_count,
    ve.embedding,
    ve.last_refreshed,
    c.name as category_name,
    c.slug as category_slug
FROM vendor_embeddings ve
LEFT JOIN categories c ON ve.category_id = c.id
WHERE ve.transaction_count >= 3;  -- Only use vendors with sufficient data

COMMENT ON VIEW embedding_search_candidates IS
'Pre-filtered vendor embeddings for nearest-neighbor search. Only includes vendors with 3+ transactions.';

-- Add indexes for nearest-neighbor search performance
CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_category ON vendor_embeddings(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_refreshed ON vendor_embeddings(org_id, last_refreshed);
CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_count ON vendor_embeddings(org_id, transaction_count DESC);

-- Add HNSW index for fast cosine similarity search (pgvector)
-- Using cosine distance as it's best for normalized embeddings
CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_hnsw ON vendor_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_vendor_embeddings_hnsw IS
'HNSW index for fast approximate nearest-neighbor search using cosine similarity. m=16 provides good recall/speed tradeoff.';

-- Add indexes for embedding matches tracking
CREATE INDEX IF NOT EXISTS idx_embedding_matches_org ON embedding_matches(org_id);
CREATE INDEX IF NOT EXISTS idx_embedding_matches_tx ON embedding_matches(tx_id);
CREATE INDEX IF NOT EXISTS idx_embedding_matches_vendor ON embedding_matches(org_id, matched_vendor);
CREATE INDEX IF NOT EXISTS idx_embedding_matches_contributed ON embedding_matches(org_id, contributed_to_decision) WHERE contributed_to_decision = true;
CREATE INDEX IF NOT EXISTS idx_embedding_matches_created ON embedding_matches(org_id, created_at DESC);

-- Add indexes for stability snapshots
CREATE INDEX IF NOT EXISTS idx_embedding_stability_org_date ON embedding_stability_snapshots(org_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_embedding_stability_vendor ON embedding_stability_snapshots(org_id, vendor);

-- Enable RLS on new tables
ALTER TABLE embedding_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_stability_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for embedding_matches
DROP POLICY IF EXISTS "embedding_matches_select_member" ON embedding_matches;
CREATE POLICY "embedding_matches_select_member" ON embedding_matches
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "embedding_matches_insert_member" ON embedding_matches;
CREATE POLICY "embedding_matches_insert_member" ON embedding_matches
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "embedding_matches_delete_member" ON embedding_matches;
CREATE POLICY "embedding_matches_delete_member" ON embedding_matches
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- RLS policies for embedding_stability_snapshots
DROP POLICY IF EXISTS "embedding_stability_select_member" ON embedding_stability_snapshots;
CREATE POLICY "embedding_stability_select_member" ON embedding_stability_snapshots
    FOR SELECT USING (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "embedding_stability_insert_member" ON embedding_stability_snapshots;
CREATE POLICY "embedding_stability_insert_member" ON embedding_stability_snapshots
    FOR INSERT WITH CHECK (public.user_in_org(org_id) = true);

DROP POLICY IF EXISTS "embedding_stability_delete_member" ON embedding_stability_snapshots;
CREATE POLICY "embedding_stability_delete_member" ON embedding_stability_snapshots
    FOR DELETE USING (public.user_in_org(org_id) = true);

-- Function to find nearest neighbor vendors for semantic matching
CREATE OR REPLACE FUNCTION find_nearest_vendor_embeddings(
    p_org_id uuid,
    p_query_embedding vector(1536),
    p_similarity_threshold numeric DEFAULT 0.7,
    p_limit integer DEFAULT 5
)
RETURNS TABLE (
    vendor text,
    category_id uuid,
    category_name text,
    similarity_score numeric,
    confidence numeric,
    transaction_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ve.vendor,
        ve.category_id,
        c.name as category_name,
        -- Cosine similarity: 1 - cosine_distance
        (1 - (ve.embedding <=> p_query_embedding))::numeric as similarity_score,
        ve.confidence,
        ve.transaction_count
    FROM vendor_embeddings ve
    LEFT JOIN categories c ON ve.category_id = c.id
    WHERE ve.org_id = p_org_id
        AND ve.transaction_count >= 3  -- Only vendors with sufficient data
        AND (1 - (ve.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY ve.embedding <=> p_query_embedding  -- cosine distance (lower is better)
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION find_nearest_vendor_embeddings IS
'Finds nearest vendor embeddings using cosine similarity. Returns vendors above threshold, ordered by similarity.';

-- Function to track embedding match for stability monitoring
CREATE OR REPLACE FUNCTION track_embedding_match(
    p_org_id uuid,
    p_tx_id uuid,
    p_matched_vendor text,
    p_similarity_score numeric,
    p_matched_category_id uuid,
    p_contributed_to_decision boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match_id uuid;
BEGIN
    INSERT INTO embedding_matches (
        org_id,
        tx_id,
        matched_vendor,
        similarity_score,
        matched_category_id,
        contributed_to_decision
    ) VALUES (
        p_org_id,
        p_tx_id,
        p_matched_vendor,
        p_similarity_score,
        p_matched_category_id,
        p_contributed_to_decision
    )
    RETURNING id INTO v_match_id;

    RETURN v_match_id;
END;
$$;

COMMENT ON FUNCTION track_embedding_match IS
'Records an embedding match for stability monitoring and drift detection.';

-- Function to create weekly stability snapshot
CREATE OR REPLACE FUNCTION create_embedding_stability_snapshot(
    p_org_id uuid,
    p_snapshot_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_snapshot_count integer := 0;
BEGIN
    -- Create snapshots for each vendor with matches in the past 7 days
    INSERT INTO embedding_stability_snapshots (
        org_id,
        snapshot_date,
        vendor,
        category_id,
        sample_matches,
        avg_similarity,
        match_count
    )
    SELECT
        em.org_id,
        p_snapshot_date,
        em.matched_vendor as vendor,
        em.matched_category_id as category_id,
        jsonb_agg(
            jsonb_build_object(
                'tx_id', em.tx_id,
                'similarity', em.similarity_score,
                'contributed', em.contributed_to_decision,
                'date', em.created_at
            ) ORDER BY em.similarity_score DESC
        ) FILTER (WHERE em.similarity_score >= 0.7) as sample_matches,
        AVG(em.similarity_score) as avg_similarity,
        COUNT(*) as match_count
    FROM embedding_matches em
    WHERE em.org_id = p_org_id
        AND em.created_at >= p_snapshot_date - INTERVAL '7 days'
        AND em.created_at < p_snapshot_date
    GROUP BY em.org_id, em.matched_vendor, em.matched_category_id
    HAVING COUNT(*) >= 3  -- Only snapshot vendors with 3+ matches
    ON CONFLICT (org_id, snapshot_date, vendor) DO UPDATE
    SET
        category_id = EXCLUDED.category_id,
        sample_matches = EXCLUDED.sample_matches,
        avg_similarity = EXCLUDED.avg_similarity,
        match_count = EXCLUDED.match_count;

    GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
    RETURN v_snapshot_count;
END;
$$;

COMMENT ON FUNCTION create_embedding_stability_snapshot IS
'Creates a weekly stability snapshot for all vendors with recent embedding matches. Used for drift detection.';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION find_nearest_vendor_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION track_embedding_match TO authenticated;
GRANT EXECUTE ON FUNCTION create_embedding_stability_snapshot TO authenticated;
