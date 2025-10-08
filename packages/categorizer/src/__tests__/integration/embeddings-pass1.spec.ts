/**
 * Integration tests for embeddings + Pass1 categorization
 *
 * Tests that embeddings boost properly integrates with Pass1 pipeline
 * and improves categorization accuracy for similar vendors
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { OrgId, CategoryId, NormalizedTransaction } from "@nexus/types";
import { pass1Categorize, type Pass1Context } from "../../engine/pass1.js";
import {
  generateVendorEmbedding,
  findNearestVendorEmbeddings,
  upsertVendorEmbedding,
  trackEmbeddingMatch,
  getVendorStabilityMetrics,
} from "../../engine/embeddings.js";

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

describe("Embeddings + Pass1 Integration", () => {
  let db: ReturnType<typeof createClient>;
  let testOrgId: OrgId;
  let testCategoryId: CategoryId;

  beforeAll(async () => {
    if (!SUPABASE_SERVICE_KEY) {
      console.warn("SUPABASE_SERVICE_ROLE_KEY not set, skipping integration tests");
      return;
    }

    // Use service role key for test setup (bypasses RLS)
    db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create test organization
    const { data: orgData, error: orgError } = await db
      .from("orgs")
      .insert({
        name: "Embeddings Test Org",
      })
      .select("id")
      .single();

    if (orgError) throw orgError;
    testOrgId = orgData.id as OrgId;

    // Get a test category
    const { data: categoryData } = await db.from("categories").select("id").limit(1).single();

    testCategoryId = categoryData?.id as CategoryId;
  });

  afterAll(async () => {
    if (!db || !testOrgId) return;

    // Cleanup
    await db.from("vendor_embeddings").delete().eq("org_id", testOrgId);
    await db.from("embedding_matches").delete().eq("org_id", testOrgId);
    await db.from("embedding_stability_snapshots").delete().eq("org_id", testOrgId);
    await db.from("transactions").delete().eq("org_id", testOrgId);
    await db.from("orgs").delete().eq("id", testOrgId);
  });

  beforeEach(async () => {
    if (!db || !testOrgId) return;

    // Clean up embeddings data
    await db.from("vendor_embeddings").delete().eq("org_id", testOrgId);
    await db.from("embedding_matches").delete().eq("org_id", testOrgId);
  });

  describe("Embedding Generation", () => {
    test.skipIf(!OPENAI_API_KEY)("generates embeddings for vendor names", async () => {
      const embedding = await generateVendorEmbedding("Slack Technologies", OPENAI_API_KEY);

      expect(embedding).toHaveLength(1536);
      expect(embedding.every((val) => typeof val === "number")).toBe(true);
    });

    test("throws on invalid API key", async () => {
      await expect(generateVendorEmbedding("Test Vendor", "invalid-key")).rejects.toThrow(
        /OpenAI embeddings API failed/
      );
    });
  });

  describe("Nearest Neighbor Search", () => {
    test("finds semantically similar vendors", async () => {
      if (!db || !testOrgId) return;

      // Create mock embeddings for similar vendors
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

      // Insert multiple times to meet the transaction_count >= 3 threshold
      await upsertVendorEmbedding(db, testOrgId, "slack", mockEmbedding, testCategoryId, 0.9);
      await upsertVendorEmbedding(db, testOrgId, "slack", mockEmbedding, testCategoryId, 0.9);
      await upsertVendorEmbedding(db, testOrgId, "slack", mockEmbedding, testCategoryId, 0.9);

      await upsertVendorEmbedding(
        db,
        testOrgId,
        "slack technologies",
        mockEmbedding,
        testCategoryId,
        0.92
      );
      await upsertVendorEmbedding(
        db,
        testOrgId,
        "slack technologies",
        mockEmbedding,
        testCategoryId,
        0.92
      );
      await upsertVendorEmbedding(
        db,
        testOrgId,
        "slack technologies",
        mockEmbedding,
        testCategoryId,
        0.92
      );

      const queryEmbedding = mockEmbedding; // Using same embedding for testing

      const matches = await findNearestVendorEmbeddings(db, testOrgId, queryEmbedding, {
        similarityThreshold: 0.7,
        maxResults: 5,
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.categoryId).toBe(testCategoryId);
      expect(matches[0]?.similarityScore).toBeGreaterThanOrEqual(0.7);
    });

    test("respects similarity threshold", async () => {
      if (!db || !testOrgId) return;

      // Create embeddings with low similarity
      const embedding1 = Array.from({ length: 1536 }, () => Math.random());
      const embedding2 = Array.from({ length: 1536 }, () => Math.random());

      await upsertVendorEmbedding(db, testOrgId, "vendor1", embedding1, testCategoryId);

      const matches = await findNearestVendorEmbeddings(db, testOrgId, embedding2, {
        similarityThreshold: 0.99, // Very high threshold
        maxResults: 5,
      });

      // Should find no matches due to high threshold
      expect(matches.length).toBe(0);
    });

    test(
      "limits results to maxResults parameter",
      async () => {
        if (!db || !testOrgId) return;

        const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

        // Insert 10 vendors with same embedding (3 times each to meet threshold)
        // Must be sequential to avoid race conditions on composite primary key
        for (let i = 0; i < 10; i++) {
          await upsertVendorEmbedding(
            db,
            testOrgId,
            `vendor-${i}`,
            mockEmbedding,
            testCategoryId,
            0.9
          );
          await upsertVendorEmbedding(
            db,
            testOrgId,
            `vendor-${i}`,
            mockEmbedding,
            testCategoryId,
            0.9
          );
          await upsertVendorEmbedding(
            db,
            testOrgId,
            `vendor-${i}`,
            mockEmbedding,
            testCategoryId,
            0.9
          );
        }

        const matches = await findNearestVendorEmbeddings(db, testOrgId, mockEmbedding, {
          similarityThreshold: 0.7,
          maxResults: 3,
        });

        expect(matches.length).toBeLessThanOrEqual(3);
      },
      { timeout: 15000 }
    );
  });

  describe("Pass1 Integration with Embeddings", () => {
    test.skipIf(!OPENAI_API_KEY)("embeddings boost helps categorize unknown vendor", async () => {
      if (!db || !testOrgId) return;

      // Setup: Insert a known vendor embedding (3 times to meet threshold)
      // Use "slack technologies" as the known vendor
      const knownVendorEmbedding = await generateVendorEmbedding(
        "slack technologies",
        OPENAI_API_KEY
      );
      await upsertVendorEmbedding(
        db,
        testOrgId,
        "slack technologies",
        knownVendorEmbedding,
        testCategoryId,
        0.95
      );
      await upsertVendorEmbedding(
        db,
        testOrgId,
        "slack technologies",
        knownVendorEmbedding,
        testCategoryId,
        0.95
      );
      await upsertVendorEmbedding(
        db,
        testOrgId,
        "slack technologies",
        knownVendorEmbedding,
        testCategoryId,
        0.95
      );

      // Test: Categorize a semantically similar but differently named vendor
      // "Slack Platform Services" normalizes to "slack platform services" (different from "slack technologies")
      // Should match via embeddings semantic similarity
      const unknownTransaction: NormalizedTransaction = {
        id: "test-tx-1" as any,
        orgId: testOrgId,
        merchantName: "Slack Platform Services", // Semantically similar but different normalized form
        description: "Monthly subscription",
        amountCents: 1500,
        date: new Date(),
        mcc: "5999", // Generic MCC (not mapped)
        source: "plaid",
        externalId: "ext-1",
        accountId: "acc-1" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: Pass1Context = {
        orgId: testOrgId,
        db,
        caches: {
          vendorRules: new Map(),
          vendorEmbeddings: new Map(),
        },
        config: {
          enableEmbeddings: true,
          debugMode: true,
        },
        logger: {
          info: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      };

      const result = await pass1Categorize(unknownTransaction, context);

      expect(result.categoryId).toBeTruthy();
      expect(result.signals).toBeDefined();

      // Check if embeddings signal was created
      const embeddingSignals = result.signals?.filter((s) => s.source === "embedding");
      expect(embeddingSignals?.length).toBeGreaterThan(0);
    });

    test("pass1 works without embeddings when disabled", async () => {
      if (!db || !testOrgId) return;

      const transaction: NormalizedTransaction = {
        id: "test-tx-2" as any,
        orgId: testOrgId,
        merchantName: "Unknown Vendor",
        description: "Purchase",
        amountCents: 1000,
        date: new Date(),
        mcc: "5999",
        source: "plaid",
        externalId: "ext-2",
        accountId: "acc-2" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context: Pass1Context = {
        orgId: testOrgId,
        db,
        config: {
          enableEmbeddings: false, // Disabled
        },
      };

      const result = await pass1Categorize(transaction, context);

      // Should complete without errors even with embeddings disabled
      expect(result).toBeDefined();
      expect(result.rationale).toBeDefined();

      // Should not have embedding signals
      const embeddingSignals = result.signals?.filter((s) => s.source === "embedding");
      expect(embeddingSignals?.length || 0).toBe(0);
    });
  });

  describe("Embedding Match Tracking", () => {
    test("tracks embedding matches for stability monitoring", async () => {
      if (!db || !testOrgId) return;

      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

      // Insert multiple times to meet the transaction_count >= 3 threshold
      await upsertVendorEmbedding(db, testOrgId, "test-vendor", mockEmbedding, testCategoryId);
      await upsertVendorEmbedding(db, testOrgId, "test-vendor", mockEmbedding, testCategoryId);
      await upsertVendorEmbedding(db, testOrgId, "test-vendor", mockEmbedding, testCategoryId);

      const matches = await findNearestVendorEmbeddings(db, testOrgId, mockEmbedding, {
        similarityThreshold: 0.7,
      });

      expect(matches.length).toBeGreaterThan(0);

      // Create a real transaction to track the match against
      const { data: txData, error: txError } = await db
        .from("transactions")
        .insert({
          org_id: testOrgId,
          merchant_name: "Test Vendor",
          description: "Test transaction",
          category_id: testCategoryId,
          amount_cents: 1000,
          mcc: "5999",
          date: new Date().toISOString().split("T")[0],
          currency: "USD",
          raw: {},
        })
        .select("id")
        .single();

      if (txError) throw txError;
      expect(txData).toBeTruthy();

      const matchId = await trackEmbeddingMatch(db, testOrgId, txData.id as any, matches[0]!, true);

      expect(matchId).toBeTruthy();

      // Verify match was tracked
      const { data } = await db.from("embedding_matches").select("*").eq("id", matchId).single();

      expect(data).toBeTruthy();
      expect(data?.matched_vendor).toBe(matches[0]?.vendor);
      expect(data?.contributed_to_decision).toBe(true);
    });
  });

  describe("Stability Metrics", () => {
    test("retrieves vendor stability metrics over time", async () => {
      if (!db || !testOrgId) return;

      // Create stability snapshot
      await db.from("embedding_stability_snapshots").insert({
        org_id: testOrgId,
        snapshot_date: new Date().toISOString().split("T")[0],
        vendor: "test-vendor",
        category_id: testCategoryId,
        sample_matches: [],
        avg_similarity: 0.85,
        match_count: 10,
      });

      const metrics = await getVendorStabilityMetrics(db, testOrgId, "test-vendor", 30);

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0]?.vendor).toBe("test-vendor");
      expect(metrics[0]?.avgSimilarity).toBe(0.85);
      expect(metrics[0]?.matchCount).toBe(10);
    });

    test("returns empty array for vendor with no history", async () => {
      if (!db || !testOrgId) return;

      const metrics = await getVendorStabilityMetrics(db, testOrgId, "non-existent-vendor", 30);

      expect(metrics).toEqual([]);
    });
  });

  describe("Upsert Vendor Embedding", () => {
    test("creates new embedding when vendor does not exist", async () => {
      if (!db || !testOrgId) return;

      const embedding = Array.from({ length: 1536 }, () => 0.5);

      await upsertVendorEmbedding(db, testOrgId, "new-vendor", embedding, testCategoryId, 0.85);

      const { data } = await db
        .from("vendor_embeddings")
        .select("*")
        .eq("org_id", testOrgId)
        .eq("vendor", "new-vendor")
        .single();

      expect(data).toBeTruthy();
      expect(data?.category_id).toBe(testCategoryId);
      expect(data?.confidence).toBe(0.85);
      expect(data?.transaction_count).toBe(1);
    });

    test("updates existing embedding and increments transaction count", async () => {
      if (!db || !testOrgId) return;

      const embedding = Array.from({ length: 1536 }, () => 0.5);

      // First upsert
      await upsertVendorEmbedding(db, testOrgId, "existing-vendor", embedding, testCategoryId, 0.8);

      // Second upsert
      await upsertVendorEmbedding(db, testOrgId, "existing-vendor", embedding, testCategoryId, 0.9);

      const { data } = await db
        .from("vendor_embeddings")
        .select("*")
        .eq("org_id", testOrgId)
        .eq("vendor", "existing-vendor")
        .single();

      expect(data?.transaction_count).toBe(2);
      expect(data?.confidence).toBe(0.9);
    });
  });

  describe("Coverage Boost Measurement", () => {
    test("measures coverage improvement with embeddings enabled", async () => {
      if (!db || !testOrgId) return;

      // Setup: Create vendor embeddings for known vendors (3 times each to meet threshold)
      const embedding1 = Array.from({ length: 1536 }, (_, i) => Math.sin(i));
      const embedding2 = Array.from({ length: 1536 }, (_, i) => Math.cos(i));

      await upsertVendorEmbedding(db, testOrgId, "slack", embedding1, testCategoryId, 0.95);
      await upsertVendorEmbedding(db, testOrgId, "slack", embedding1, testCategoryId, 0.95);
      await upsertVendorEmbedding(db, testOrgId, "slack", embedding1, testCategoryId, 0.95);

      await upsertVendorEmbedding(db, testOrgId, "github", embedding2, testCategoryId, 0.92);
      await upsertVendorEmbedding(db, testOrgId, "github", embedding2, testCategoryId, 0.92);
      await upsertVendorEmbedding(db, testOrgId, "github", embedding2, testCategoryId, 0.92);

      // Test transactions with embeddings disabled
      const testTransactions: NormalizedTransaction[] = [
        {
          id: "tx-1" as any,
          orgId: testOrgId,
          merchantName: "Slack Technologies", // Similar to "slack"
          description: "Software",
          amountCents: 1500,
          date: new Date(),
          mcc: "5999",
          source: "plaid",
          externalId: "ext-1",
          accountId: "acc-1" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tx-2" as any,
          orgId: testOrgId,
          merchantName: "GitHub Inc", // Similar to "github"
          description: "Subscription",
          amountCents: 2000,
          date: new Date(),
          mcc: "5999",
          source: "plaid",
          externalId: "ext-2",
          accountId: "acc-2" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      let categorizedWithoutEmbeddings = 0;
      let categorizedWithEmbeddings = 0;

      // Test without embeddings
      for (const tx of testTransactions) {
        const context: Pass1Context = {
          orgId: testOrgId,
          db,
          config: { enableEmbeddings: false },
        };

        const result = await pass1Categorize(tx, context);
        if (result.categoryId) {
          categorizedWithoutEmbeddings++;
        }
      }

      // Test with embeddings (mocked)
      for (const tx of testTransactions) {
        const context: Pass1Context = {
          orgId: testOrgId,
          db,
          config: { enableEmbeddings: true },
          caches: {
            vendorRules: new Map(),
            vendorEmbeddings: new Map(),
          },
        };

        const result = await pass1Categorize(tx, context);
        if (result.categoryId) {
          categorizedWithEmbeddings++;
        }
      }

      // Embeddings should improve or maintain coverage
      expect(categorizedWithEmbeddings).toBeGreaterThanOrEqual(categorizedWithoutEmbeddings);
    });
  });
});
