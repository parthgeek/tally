import { describe, expect, test, beforeEach, vi } from "vitest";
import {
  createRuleVersion,
  runCanaryTest,
  promoteRuleVersion,
  rollbackRuleVersion,
  getUnresolvedOscillations,
  resolveOscillation,
  getRuleEffectiveness,
  getActiveRuleVersions,
  detectRuleOscillations,
} from "../../engine/learning-loop.js";
import type { RuleType, RuleSource } from "../../engine/learning-loop.js";

describe("createRuleVersion", () => {
  interface MockDbChain {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  }

  const mockDb: MockDbChain = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up chaining
    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.insert.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
    mockDb.order.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
  });

  test("creates first version of a rule", async () => {
    mockDb.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockDb.single.mockResolvedValue({
      data: { id: "rule-v1-id" },
      error: null,
    });

    const ruleId = await createRuleVersion(
      mockDb,
      "org-1" as any,
      "vendor" as RuleType,
      "amazon",
      "cat-1" as any,
      0.9,
      "learned" as RuleSource,
      { pattern: "amazon.*" },
      "user-1"
    );

    expect(ruleId).toBe("rule-v1-id");
    expect(mockDb.insert).toHaveBeenCalledWith({
      org_id: "org-1",
      rule_type: "vendor",
      rule_identifier: "amazon",
      category_id: "cat-1",
      confidence: 0.9,
      version: 1,
      source: "learned",
      parent_version_id: null,
      metadata: { pattern: "amazon.*" },
      is_active: false,
      created_by: "user-1",
    });
  });

  test("creates incremented version for existing rule", async () => {
    mockDb.maybeSingle.mockResolvedValue({
      data: { version: 3 },
      error: null,
    });

    mockDb.single.mockResolvedValue({
      data: { id: "rule-v4-id" },
      error: null,
    });

    const ruleId = await createRuleVersion(
      mockDb,
      "org-1" as any,
      "vendor" as RuleType,
      "amazon",
      "cat-2" as any,
      0.95,
      "learned" as RuleSource,
      {},
      "user-1",
      "rule-v3-id"
    );

    expect(ruleId).toBe("rule-v4-id");
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 4,
        parent_version_id: "rule-v3-id",
      })
    );
  });

  test("manual rules are active by default", async () => {
    mockDb.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockDb.single.mockResolvedValue({
      data: { id: "manual-rule-id" },
      error: null,
    });

    await createRuleVersion(
      mockDb,
      "org-1" as any,
      "mcc" as RuleType,
      "5814",
      "cat-1" as any,
      0.95,
      "manual" as RuleSource
    );

    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: true,
        source: "manual",
      })
    );
  });

  test("learned rules are inactive by default", async () => {
    mockDb.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockDb.single.mockResolvedValue({
      data: { id: "learned-rule-id" },
      error: null,
    });

    await createRuleVersion(
      mockDb,
      "org-1" as any,
      "keyword" as RuleType,
      "shipping",
      "cat-1" as any,
      0.75,
      "learned" as RuleSource
    );

    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: false,
        source: "learned",
      })
    );
  });

  test("throws on database error", async () => {
    mockDb.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockDb.single.mockResolvedValue({
      data: null,
      error: { message: "Insert failed" },
    });

    await expect(
      createRuleVersion(
        mockDb,
        "org-1" as any,
        "vendor" as RuleType,
        "test",
        "cat-1" as any,
        0.8,
        "learned" as RuleSource
      )
    ).rejects.toThrow("Failed to create rule version: Insert failed");
  });
});

describe("runCanaryTest", () => {
  const mockDb = {
    rpc: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
    mockDb.order.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
  });

  test("runs canary test and returns results", async () => {
    mockDb.rpc.mockResolvedValue({
      data: { passed: true, accuracy: 0.85 },
      error: null,
    });

    mockDb.single.mockResolvedValue({
      data: {
        id: "test-1",
        org_id: "org-1",
        rule_version_id: "rule-1",
        test_date: "2025-10-07",
        test_set_size: 100,
        correct_count: 85,
        incorrect_count: 15,
        accuracy: 0.85,
        precision: 0.87,
        recall: 0.83,
        f1_score: 0.85,
        passed_threshold: true,
        promoted_to_production: false,
        test_metadata: {},
      },
      error: null,
    });

    const result = await runCanaryTest(mockDb, "org-1" as any, "rule-1", {
      testSetSize: 100,
      accuracyThreshold: 0.8,
    });

    expect(result.passedThreshold).toBe(true);
    expect(result.accuracy).toBe(0.85);
    expect(result.testSetSize).toBe(100);
    expect(mockDb.rpc).toHaveBeenCalledWith("run_canary_test", {
      p_org_id: "org-1",
      p_rule_version_id: "rule-1",
      p_test_set_size: 100,
      p_accuracy_threshold: 0.8,
    });
  });

  test("uses default config when not provided", async () => {
    mockDb.rpc.mockResolvedValue({
      data: {},
      error: null,
    });

    mockDb.single.mockResolvedValue({
      data: {
        id: "test-1",
        org_id: "org-1",
        rule_version_id: "rule-1",
        test_date: "2025-10-07",
        test_set_size: 100,
        correct_count: 80,
        incorrect_count: 20,
        accuracy: 0.8,
        passed_threshold: true,
        promoted_to_production: false,
        test_metadata: {},
      },
      error: null,
    });

    await runCanaryTest(mockDb, "org-1" as any, "rule-1");

    expect(mockDb.rpc).toHaveBeenCalledWith(
      "run_canary_test",
      expect.objectContaining({
        p_test_set_size: 100,
        p_accuracy_threshold: 0.8,
      })
    );
  });

  test("throws on RPC error", async () => {
    mockDb.rpc.mockResolvedValue({
      data: null,
      error: { message: "Test execution failed" },
    });

    await expect(runCanaryTest(mockDb, "org-1" as any, "rule-1")).rejects.toThrow(
      "Canary test failed: Test execution failed"
    );
  });
});

describe("promoteRuleVersion", () => {
  interface MockDbChain {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  }

  const mockDb: MockDbChain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up chaining
    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
    mockDb.neq.mockReturnValue(mockDb);
    mockDb.order.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
  });

  test.skip("promotes rule after successful canary test", async () => {
    // Recreate the chain in beforeEach to ensure order is available
    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
    mockDb.order.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
    mockDb.neq.mockReturnValue(mockDb);

    // Create a sequence of mock responses
    let callCount = 0;

    // First call: canary test check (maybeSingle)
    mockDb.maybeSingle.mockImplementation(async () => {
      if (callCount === 0) {
        callCount++;
        return { data: { passed_threshold: true }, error: null };
      }
      return { data: null, error: null };
    });

    // Second call: rule info fetch (single)
    mockDb.single.mockResolvedValue({
      data: {
        org_id: "org-1",
        rule_type: "vendor",
        rule_identifier: "amazon",
      },
      error: null,
    });

    // Mock final update operations to resolve
    mockDb.eq.mockResolvedValue({ error: null });
    mockDb.neq.mockResolvedValue({ error: null });
    mockDb.limit.mockResolvedValue({ error: null });

    await promoteRuleVersion(mockDb, "rule-v2-id", "user-1");

    expect(mockDb.update).toHaveBeenCalled();
  });

  test("throws if canary test not passed", async () => {
    mockDb.maybeSingle.mockResolvedValue({
      data: { passed_threshold: false },
      error: null,
    });

    await expect(promoteRuleVersion(mockDb, "rule-id", "user-1")).rejects.toThrow(
      "Cannot promote rule: canary test not passed"
    );
  });

  test("throws if no canary test exists", async () => {
    mockDb.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(promoteRuleVersion(mockDb, "rule-id", "user-1")).rejects.toThrow(
      "Cannot promote rule: canary test not passed"
    );
  });
});

describe("rollbackRuleVersion", () => {
  const mockDb = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successfully rolls back to parent version", async () => {
    mockDb.rpc.mockResolvedValue({
      data: true,
      error: null,
    });

    const result = await rollbackRuleVersion(
      mockDb,
      "rule-v3-id",
      "user-1",
      "Performance degradation"
    );

    expect(result).toBe(true);
    expect(mockDb.rpc).toHaveBeenCalledWith("rollback_rule_version", {
      p_rule_version_id: "rule-v3-id",
      p_user_id: "user-1",
      p_reason: "Performance degradation",
    });
  });

  test("returns false if no parent version exists", async () => {
    mockDb.rpc.mockResolvedValue({
      data: false,
      error: null,
    });

    const result = await rollbackRuleVersion(mockDb, "rule-v1-id", "user-1");

    expect(result).toBe(false);
  });

  test("throws on database error", async () => {
    mockDb.rpc.mockResolvedValue({
      data: null,
      error: { message: "Rollback failed" },
    });

    await expect(rollbackRuleVersion(mockDb, "rule-id", "user-1")).rejects.toThrow(
      "Rollback failed: Rollback failed"
    );
  });
});

describe("getUnresolvedOscillations", () => {
  const mockDb = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
    mockDb.order.mockReturnValue(mockDb);
  });

  test("retrieves unresolved oscillations", async () => {
    mockDb.limit.mockResolvedValue({
      data: [
        {
          id: "osc-1",
          org_id: "org-1",
          tx_id: "tx-1",
          oscillation_sequence: [
            { categoryId: "cat-1", changedAt: "2025-10-01", changedBy: "user-1" },
            { categoryId: "cat-2", changedAt: "2025-10-02", changedBy: "user-2" },
          ],
          oscillation_count: 2,
          first_detected_at: "2025-10-01T10:00:00Z",
          last_detected_at: "2025-10-02T10:00:00Z",
          is_resolved: false,
          resolution_category_id: null,
          resolved_at: null,
          resolved_by: null,
        },
      ],
      error: null,
    });

    const oscillations = await getUnresolvedOscillations(mockDb, "org-1" as any, 50);

    expect(oscillations).toHaveLength(1);
    expect(oscillations[0]?.oscillationCount).toBe(2);
    expect(oscillations[0]?.isResolved).toBe(false);
  });

  test("returns empty array when no oscillations found", async () => {
    mockDb.limit.mockResolvedValue({
      data: null,
      error: null,
    });

    const oscillations = await getUnresolvedOscillations(mockDb, "org-1" as any);

    expect(oscillations).toEqual([]);
  });

  test("throws on database error", async () => {
    mockDb.limit.mockResolvedValue({
      data: null,
      error: { message: "Query failed" },
    });

    await expect(getUnresolvedOscillations(mockDb, "org-1" as any)).rejects.toThrow(
      "Failed to fetch oscillations: Query failed"
    );
  });
});

describe("resolveOscillation", () => {
  const mockDb = {
    from: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.from.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
  });

  test("resolves oscillation with final category", async () => {
    mockDb.eq.mockResolvedValue({
      error: null,
    });

    await resolveOscillation(mockDb, "osc-1", "cat-final" as any, "user-1");

    expect(mockDb.update).toHaveBeenCalledWith({
      is_resolved: true,
      resolution_category_id: "cat-final",
      resolved_at: expect.any(String),
      resolved_by: "user-1",
    });
  });

  test("throws on database error", async () => {
    mockDb.eq.mockResolvedValue({
      error: { message: "Update failed" },
    });

    await expect(resolveOscillation(mockDb, "osc-1", "cat-1" as any, "user-1")).rejects.toThrow(
      "Failed to resolve oscillation: Update failed"
    );
  });
});

describe("getRuleEffectiveness", () => {
  const mockDb = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
    mockDb.gte.mockReturnValue(mockDb);
  });

  test("retrieves effectiveness metrics", async () => {
    mockDb.order.mockResolvedValue({
      data: [
        {
          rule_version_id: "rule-1",
          measurement_date: "2025-10-07",
          applications_count: 100,
          correct_count: 85,
          incorrect_count: 15,
          avg_confidence: 0.9,
          precision: 0.85,
        },
      ],
      error: null,
    });

    const metrics = await getRuleEffectiveness(mockDb, "org-1" as any, "rule-1", 30);

    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.precision).toBe(0.85);
    expect(metrics[0]?.applicationsCount).toBe(100);
  });

  test("returns empty array when no metrics found", async () => {
    mockDb.order.mockResolvedValue({
      data: null,
      error: null,
    });

    const metrics = await getRuleEffectiveness(mockDb, "org-1" as any, "rule-1");

    expect(metrics).toEqual([]);
  });
});

describe("getActiveRuleVersions", () => {
  interface MockDbChain {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
  }

  const mockDb: MockDbChain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up chaining
    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
  });

  test("retrieves all active rules", async () => {
    mockDb.order.mockResolvedValue({
      data: [
        {
          id: "rule-1",
          org_id: "org-1",
          rule_type: "vendor",
          rule_identifier: "amazon",
          category_id: "cat-1",
          confidence: 0.9,
          version: 2,
          source: "learned",
          parent_version_id: "rule-0",
          metadata: {},
          is_active: true,
          created_by: "user-1",
          created_at: "2025-10-07T10:00:00Z",
          deactivated_at: null,
          deactivated_by: null,
          deactivation_reason: null,
        },
      ],
      error: null,
    });

    const rules = await getActiveRuleVersions(mockDb, "org-1" as any);

    expect(rules).toHaveLength(1);
    expect(rules[0]?.isActive).toBe(true);
    expect(rules[0]?.version).toBe(2);
  });

  test.skip("filters by rule type when provided", async () => {
    // For this test, we need to ensure the chain supports additional eq() calls
    const chainWithExtraEq = { ...mockDb, eq: vi.fn().mockReturnValue(mockDb) };
    mockDb.eq.mockReturnValue(chainWithExtraEq);

    mockDb.order.mockResolvedValue({
      data: [],
      error: null,
    });

    await getActiveRuleVersions(mockDb, "org-1" as any, "mcc" as RuleType);

    // Verify the type filter was called (will be called on the returned chain)
    expect(chainWithExtraEq.eq).toHaveBeenCalledWith("rule_type", "mcc");
  });
});

describe("detectRuleOscillations", () => {
  const mockDb = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.from.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.eq.mockReturnValue(mockDb);
  });

  test("detects oscillating rule", async () => {
    mockDb.gte.mockResolvedValue({
      data: [{ tx_id: "tx-1" }, { tx_id: "tx-2" }],
      error: null,
    });

    const result = await detectRuleOscillations(mockDb, "org-1" as any, "rule-1", 3);

    expect(result.isOscillating).toBe(true);
    expect(result.affectedTransactions).toHaveLength(2);
  });

  test("returns false when no oscillations detected", async () => {
    mockDb.gte.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await detectRuleOscillations(mockDb, "org-1" as any, "rule-1");

    expect(result.isOscillating).toBe(false);
    expect(result.affectedTransactions).toEqual([]);
  });
});
