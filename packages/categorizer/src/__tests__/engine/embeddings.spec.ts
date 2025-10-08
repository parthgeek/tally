import { describe, expect, test, beforeEach, vi } from "vitest";
import {
  cosineSimilarity,
  generateVendorEmbedding,
  findNearestVendorEmbeddings,
  trackEmbeddingMatch,
  createStabilitySnapshot,
  getVendorStabilityMetrics,
  upsertVendorEmbedding,
} from "../../engine/embeddings.js";
import type { EmbeddingMatch } from "../../engine/embeddings.js";

describe("cosineSimilarity", () => {
  test("identical vectors have similarity 1", () => {
    const vectorA = [1, 0, 0];
    const vectorB = [1, 0, 0];

    expect(cosineSimilarity(vectorA, vectorB)).toBe(1);
  });

  test("orthogonal vectors have similarity 0", () => {
    const vectorA = [1, 0, 0];
    const vectorB = [0, 1, 0];

    expect(cosineSimilarity(vectorA, vectorB)).toBe(0);
  });

  test("opposite vectors have similarity -1", () => {
    const vectorA = [1, 0, 0];
    const vectorB = [-1, 0, 0];

    expect(cosineSimilarity(vectorA, vectorB)).toBe(-1);
  });

  test("similar vectors have similarity between 0 and 1", () => {
    const vectorA = [1, 1, 0];
    const vectorB = [1, 0.5, 0];

    const similarity = cosineSimilarity(vectorA, vectorB);

    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  test("normalized embeddings maintain correct similarity", () => {
    // Simulating text-embedding-3-small style normalized vectors
    const norm = Math.sqrt(2);
    const vectorA = [1 / norm, 1 / norm];
    const vectorB = [1 / norm, 0];

    const similarity = cosineSimilarity(vectorA, vectorB);

    expect(similarity).toBeCloseTo(Math.sqrt(2) / 2, 5);
  });

  test("throws on dimension mismatch", () => {
    const vectorA = [1, 0, 0];
    const vectorB = [1, 0];

    expect(() => cosineSimilarity(vectorA, vectorB)).toThrow("dimension mismatch");
  });

  test("handles zero vectors", () => {
    const vectorA = [0, 0, 0];
    const vectorB = [1, 1, 1];

    expect(cosineSimilarity(vectorA, vectorB)).toBe(0);
  });
});

describe("generateVendorEmbedding", () => {
  test("generates 1536-dimensional embedding", async () => {
    const mockEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: mockEmbedding }],
      }),
    });

    const result = await generateVendorEmbedding("Shopify", "test-api-key");

    expect(result).toHaveLength(1536);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      })
    );
  });

  test("throws on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(generateVendorEmbedding("Shopify", "invalid-key")).rejects.toThrow(
      "OpenAI embeddings API failed: 401 Unauthorized"
    );
  });

  test("throws on invalid response format", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(generateVendorEmbedding("Shopify", "test-key")).rejects.toThrow(
      "Invalid embeddings API response"
    );
  });

  test("throws on wrong embedding dimension", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: [1, 2, 3] }], // Wrong dimension
      }),
    });

    await expect(generateVendorEmbedding("Shopify", "test-key")).rejects.toThrow(
      "Invalid embedding dimension: expected 1536, got 3"
    );
  });
});

describe("findNearestVendorEmbeddings", () => {
  const mockDb = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("finds nearest vendors above similarity threshold", async () => {
    const queryEmbedding = new Array(1536).fill(0);

    mockDb.rpc.mockResolvedValue({
      data: [
        {
          vendor: "amazon",
          category_id: "cat-1",
          category_name: "Product Purchases",
          similarity_score: 0.85,
          confidence: 0.9,
          transaction_count: 10,
        },
        {
          vendor: "amzn mktp",
          category_id: "cat-1",
          category_name: "Product Purchases",
          similarity_score: 0.78,
          confidence: 0.85,
          transaction_count: 5,
        },
      ],
      error: null,
    });

    const results = await findNearestVendorEmbeddings(mockDb, "org-1" as any, queryEmbedding, {
      similarityThreshold: 0.7,
      maxResults: 5,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      vendor: "amazon",
      categoryId: "cat-1",
      categoryName: "Product Purchases",
      similarityScore: 0.85,
      confidence: 0.9,
      transactionCount: 10,
    });
    expect(mockDb.rpc).toHaveBeenCalledWith("find_nearest_vendor_embeddings", {
      p_org_id: "org-1",
      p_query_embedding: expect.any(String),
      p_similarity_threshold: 0.7,
      p_limit: 5,
    });
  });

  test("returns empty array when no matches found", async () => {
    const queryEmbedding = new Array(1536).fill(0);

    mockDb.rpc.mockResolvedValue({
      data: null,
      error: null,
    });

    const results = await findNearestVendorEmbeddings(mockDb, "org-1" as any, queryEmbedding);

    expect(results).toEqual([]);
  });

  test("throws on database error", async () => {
    const queryEmbedding = new Array(1536).fill(0);

    mockDb.rpc.mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    });

    await expect(
      findNearestVendorEmbeddings(mockDb, "org-1" as any, queryEmbedding)
    ).rejects.toThrow("Nearest-neighbor search failed: Database connection failed");
  });

  test("throws on invalid query embedding dimension", async () => {
    const queryEmbedding = [1, 2, 3]; // Wrong dimension

    await expect(
      findNearestVendorEmbeddings(mockDb, "org-1" as any, queryEmbedding)
    ).rejects.toThrow("Invalid query embedding dimension: expected 1536, got 3");
  });

  test("uses default options when not provided", async () => {
    const queryEmbedding = new Array(1536).fill(0);

    mockDb.rpc.mockResolvedValue({ data: [], error: null });

    await findNearestVendorEmbeddings(mockDb, "org-1" as any, queryEmbedding);

    expect(mockDb.rpc).toHaveBeenCalledWith(
      "find_nearest_vendor_embeddings",
      expect.objectContaining({
        p_similarity_threshold: 0.7,
        p_limit: 5,
      })
    );
  });
});

describe("trackEmbeddingMatch", () => {
  const mockDb = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("tracks embedding match successfully", async () => {
    const match: EmbeddingMatch = {
      vendor: "amazon",
      categoryId: "cat-1" as any,
      categoryName: "Product Purchases",
      similarityScore: 0.85,
      confidence: 0.9,
      transactionCount: 10,
    };

    mockDb.rpc.mockResolvedValue({
      data: "match-id-123",
      error: null,
    });

    const matchId = await trackEmbeddingMatch(mockDb, "org-1" as any, "tx-1" as any, match, true);

    expect(matchId).toBe("match-id-123");
    expect(mockDb.rpc).toHaveBeenCalledWith("track_embedding_match", {
      p_org_id: "org-1",
      p_tx_id: "tx-1",
      p_matched_vendor: "amazon",
      p_similarity_score: 0.85,
      p_matched_category_id: "cat-1",
      p_contributed_to_decision: true,
    });
  });

  test("throws on database error", async () => {
    const match: EmbeddingMatch = {
      vendor: "amazon",
      categoryId: "cat-1" as any,
      categoryName: "Product Purchases",
      similarityScore: 0.85,
      confidence: 0.9,
      transactionCount: 10,
    };

    mockDb.rpc.mockResolvedValue({
      data: null,
      error: { message: "Insert failed" },
    });

    await expect(
      trackEmbeddingMatch(mockDb, "org-1" as any, "tx-1" as any, match, false)
    ).rejects.toThrow("Failed to track embedding match: Insert failed");
  });
});

describe("createStabilitySnapshot", () => {
  const mockDb = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates snapshot and returns count", async () => {
    mockDb.rpc.mockResolvedValue({
      data: 42,
      error: null,
    });

    const count = await createStabilitySnapshot(mockDb, "org-1" as any, new Date("2025-10-07"));

    expect(count).toBe(42);
    expect(mockDb.rpc).toHaveBeenCalledWith("create_embedding_stability_snapshot", {
      p_org_id: "org-1",
      p_snapshot_date: "2025-10-07",
    });
  });

  test("uses current date when not provided", async () => {
    const today = new Date().toISOString().split("T")[0];

    mockDb.rpc.mockResolvedValue({
      data: 10,
      error: null,
    });

    await createStabilitySnapshot(mockDb, "org-1" as any);

    expect(mockDb.rpc).toHaveBeenCalledWith(
      "create_embedding_stability_snapshot",
      expect.objectContaining({
        p_snapshot_date: today,
      })
    );
  });

  test("throws on database error", async () => {
    mockDb.rpc.mockResolvedValue({
      data: null,
      error: { message: "Snapshot failed" },
    });

    await expect(createStabilitySnapshot(mockDb, "org-1" as any)).rejects.toThrow(
      "Failed to create stability snapshot: Snapshot failed"
    );
  });
});

describe("getVendorStabilityMetrics", () => {
  interface MockDbChain {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
  }

  const mockDb: MockDbChain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
  };

  // Set up chaining
  mockDb.from.mockReturnValue(mockDb);
  mockDb.select.mockReturnValue(mockDb);
  mockDb.eq.mockReturnValue(mockDb);
  mockDb.gte.mockReturnValue(mockDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("retrieves stability metrics for vendor", async () => {
    mockDb.order.mockResolvedValue({
      data: [
        {
          vendor: "amazon",
          category_id: "cat-1",
          avg_similarity: 0.85,
          match_count: 10,
          sample_matches: [
            { txId: "tx-1", similarity: 0.9, contributed: true, date: "2025-10-01" },
          ],
          snapshot_date: "2025-10-01",
        },
      ],
      error: null,
    });

    const metrics = await getVendorStabilityMetrics(mockDb, "org-1" as any, "amazon", 30);

    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toEqual({
      vendor: "amazon",
      categoryId: "cat-1",
      avgSimilarity: 0.85,
      matchCount: 10,
      sampleMatches: expect.any(Array),
      snapshotDate: expect.any(Date),
    });
  });

  test("returns empty array when no metrics found", async () => {
    mockDb.order.mockResolvedValue({
      data: null,
      error: null,
    });

    const metrics = await getVendorStabilityMetrics(mockDb, "org-1" as any, "amazon");

    expect(metrics).toEqual([]);
  });

  test("throws on database error", async () => {
    mockDb.order.mockResolvedValue({
      data: null,
      error: { message: "Query failed" },
    });

    await expect(getVendorStabilityMetrics(mockDb, "org-1" as any, "amazon")).rejects.toThrow(
      "Failed to fetch stability metrics: Query failed"
    );
  });
});

describe("upsertVendorEmbedding", () => {
  interface MockDbChain {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  }

  const mockDb: MockDbChain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up chaining for each test
    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
  });

  test("inserts new embedding when vendor does not exist", async () => {
    const embedding = new Array(1536).fill(0.5);

    mockDb.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockDb.insert.mockResolvedValue({
      error: null,
    });

    await upsertVendorEmbedding(mockDb, "org-1" as any, "amazon", embedding, "cat-1" as any, 0.8);

    expect(mockDb.insert).toHaveBeenCalledWith({
      org_id: "org-1",
      vendor: "amazon",
      embedding: expect.any(String),
      category_id: "cat-1",
      confidence: 0.8,
      transaction_count: 1,
    });
  });

  test("updates existing embedding and increments count", async () => {
    const embedding = new Array(1536).fill(0.5);

    // Mock the complete chain: from().select().eq().eq().maybeSingle()
    mockDb.maybeSingle.mockResolvedValue({
      data: { transaction_count: 5 },
      error: null,
    });

    // Mock the update chain: from().update().eq().eq()
    const finalResult = { error: null };
    const lastEq = { eq: vi.fn().mockResolvedValue(finalResult) };
    mockDb.update.mockReturnValue({ eq: vi.fn().mockReturnValue(lastEq) });

    await upsertVendorEmbedding(mockDb, "org-1" as any, "amazon", embedding, "cat-1" as any, 0.8);

    expect(mockDb.update).toHaveBeenCalledWith({
      embedding: expect.any(String),
      category_id: "cat-1",
      confidence: 0.8,
      transaction_count: 6,
      last_refreshed: expect.any(String),
    });
  });

  test("throws on invalid embedding dimension", async () => {
    const embedding = [1, 2, 3]; // Wrong dimension

    await expect(
      upsertVendorEmbedding(mockDb, "org-1" as any, "amazon", embedding, "cat-1" as any)
    ).rejects.toThrow("Invalid embedding dimension: expected 1536, got 3");
  });

  test("throws on insert error", async () => {
    const embedding = new Array(1536).fill(0.5);

    mockDb.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockDb.insert.mockResolvedValue({
      error: { message: "Constraint violation" },
    });

    await expect(
      upsertVendorEmbedding(mockDb, "org-1" as any, "amazon", embedding, "cat-1" as any)
    ).rejects.toThrow("Failed to insert vendor embedding: Constraint violation");
  });
});
