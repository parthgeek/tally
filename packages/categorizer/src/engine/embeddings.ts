/**
 * Embeddings-based semantic vendor matching for transaction categorization
 *
 * Provides nearest-neighbor search, stability validation, and drift detection
 * for vendor embeddings using OpenAI text-embedding-3-small (1536 dimensions)
 */

import type { CategoryId, TransactionId, OrgId } from "@nexus/types";

export interface VendorEmbedding {
  vendor: string;
  categoryId: CategoryId;
  categoryName: string;
  embedding: number[];
  confidence: number;
  transactionCount: number;
  lastRefreshed: Date;
}

export interface EmbeddingMatch {
  vendor: string;
  categoryId: CategoryId;
  categoryName: string;
  similarityScore: number;
  confidence: number;
  transactionCount: number;
}

export interface EmbeddingSearchOptions {
  similarityThreshold?: number; // 0-1, default 0.7
  maxResults?: number; // default 5
  minTransactionCount?: number; // default 3
}

export interface EmbeddingStabilityMetrics {
  vendor: string;
  categoryId: CategoryId | null;
  avgSimilarity: number;
  matchCount: number;
  sampleMatches: Array<{
    txId: string;
    similarity: number;
    contributed: boolean;
    date: Date;
  }>;
  snapshotDate: Date;
}

/**
 * Generate embedding for vendor name using OpenAI text-embedding-3-small
 *
 * @param vendorName - Normalized vendor name to embed
 * @param openaiApiKey - OpenAI API key
 * @returns 1536-dimensional embedding vector
 */
export async function generateVendorEmbedding(
  vendorName: string,
  openaiApiKey: string
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: vendorName,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.data?.[0]?.embedding) {
    throw new Error("Invalid embeddings API response: missing embedding data");
  }

  const embedding = data.data[0].embedding as number[];

  if (embedding.length !== 1536) {
    throw new Error(`Invalid embedding dimension: expected 1536, got ${embedding.length}`);
  }

  return embedding;
}

/**
 * Find nearest vendor embeddings using cosine similarity
 *
 * Uses Supabase pgvector with HNSW index for fast approximate nearest-neighbor search
 */
export async function findNearestVendorEmbeddings(
  db: any,
  orgId: OrgId,
  queryEmbedding: number[],
  options: EmbeddingSearchOptions = {}
): Promise<EmbeddingMatch[]> {
  const { similarityThreshold = 0.7, maxResults = 5 } = options;

  if (queryEmbedding.length !== 1536) {
    throw new Error(
      `Invalid query embedding dimension: expected 1536, got ${queryEmbedding.length}`
    );
  }

  // Use the SQL function for optimized nearest-neighbor search
  // pgvector expects the embedding as a JSON string
  const { data, error } = await db.rpc("find_nearest_vendor_embeddings", {
    p_org_id: orgId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_similarity_threshold: similarityThreshold,
    p_limit: maxResults,
  });

  if (error) {
    throw new Error(`Nearest-neighbor search failed: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    vendor: row.vendor,
    categoryId: row.category_id as CategoryId,
    categoryName: row.category_name || "Unknown",
    similarityScore: parseFloat(row.similarity_score),
    confidence: parseFloat(row.confidence),
    transactionCount: parseInt(row.transaction_count),
  }));
}

/**
 * Track embedding match for stability monitoring
 *
 * Records each embedding match to enable drift detection and stability validation
 */
export async function trackEmbeddingMatch(
  db: any,
  orgId: OrgId,
  txId: TransactionId,
  match: EmbeddingMatch,
  contributedToDecision: boolean
): Promise<string> {
  const { data, error } = await db.rpc("track_embedding_match", {
    p_org_id: orgId,
    p_tx_id: txId,
    p_matched_vendor: match.vendor,
    p_similarity_score: match.similarityScore,
    p_matched_category_id: match.categoryId,
    p_contributed_to_decision: contributedToDecision,
  });

  if (error) {
    throw new Error(`Failed to track embedding match: ${error.message}`);
  }

  return data;
}

/**
 * Create weekly stability snapshot for drift detection
 *
 * Aggregates embedding matches from the past week to detect changes in vendor categorization
 */
export async function createStabilitySnapshot(
  db: any,
  orgId: OrgId,
  snapshotDate: Date = new Date()
): Promise<number> {
  const { data, error } = await db.rpc("create_embedding_stability_snapshot", {
    p_org_id: orgId,
    p_snapshot_date: snapshotDate.toISOString().split("T")[0], // YYYY-MM-DD
  });

  if (error) {
    throw new Error(`Failed to create stability snapshot: ${error.message}`);
  }

  return data;
}

/**
 * Get stability metrics for a vendor across time
 *
 * Useful for detecting drift or validating that embeddings refresh doesn't break existing matches
 */
export async function getVendorStabilityMetrics(
  db: any,
  orgId: OrgId,
  vendor: string,
  daysSince: number = 30
): Promise<EmbeddingStabilityMetrics[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSince);

  const { data, error } = await db
    .from("embedding_stability_snapshots")
    .select("*")
    .eq("org_id", orgId)
    .eq("vendor", vendor)
    .gte("snapshot_date", cutoffDate.toISOString().split("T")[0])
    .order("snapshot_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch stability metrics: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    vendor: row.vendor,
    categoryId: row.category_id as CategoryId | null,
    avgSimilarity: parseFloat(row.avg_similarity),
    matchCount: parseInt(row.match_count),
    sampleMatches: row.sample_matches || [],
    snapshotDate: new Date(row.snapshot_date),
  }));
}

/**
 * Upsert vendor embedding (create or update)
 *
 * Updates existing embedding or creates new one. Increments transaction count.
 */
export async function upsertVendorEmbedding(
  db: any,
  orgId: OrgId,
  vendor: string,
  embedding: number[],
  categoryId: CategoryId,
  confidence: number = 0.5
): Promise<void> {
  if (embedding.length !== 1536) {
    throw new Error(`Invalid embedding dimension: expected 1536, got ${embedding.length}`);
  }

  // Check if embedding exists
  const { data: existing, error: selectError } = await db
    .from("vendor_embeddings")
    .select("transaction_count")
    .eq("org_id", orgId)
    .eq("vendor", vendor)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to check existing embedding: ${selectError.message}`);
  }

  if (existing) {
    // Update existing embedding
    const { error: updateError } = await db
      .from("vendor_embeddings")
      .update({
        embedding: JSON.stringify(embedding),
        category_id: categoryId,
        confidence,
        transaction_count: existing.transaction_count + 1,
        last_refreshed: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("vendor", vendor);

    if (updateError) {
      throw new Error(`Failed to update vendor embedding: ${updateError.message}`);
    }
  } else {
    // Insert new embedding
    const { error: insertError } = await db.from("vendor_embeddings").insert({
      org_id: orgId,
      vendor,
      embedding: JSON.stringify(embedding),
      category_id: categoryId,
      confidence,
      transaction_count: 1,
    });

    if (insertError) {
      throw new Error(`Failed to insert vendor embedding: ${insertError.message}`);
    }
  }
}

/**
 * Batch generate embeddings for multiple vendors
 *
 * Useful for bulk processing or initial setup
 */
export async function batchGenerateEmbeddings(
  vendors: string[],
  openaiApiKey: string
): Promise<Map<string, number[]>> {
  const embeddings = new Map<string, number[]>();

  // Process in batches of 20 to stay within rate limits
  const batchSize = 20;
  for (let i = 0; i < vendors.length; i += batchSize) {
    const batch = vendors.slice(i, i + batchSize);

    const batchEmbeddings = await Promise.all(
      batch.map((vendor) => generateVendorEmbedding(vendor, openaiApiKey))
    );

    batch.forEach((vendor, index) => {
      embeddings.set(vendor, batchEmbeddings[index]!);
    });

    // Rate limit: wait 100ms between batches
    if (i + batchSize < vendors.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * Useful for testing or validation without database
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}
