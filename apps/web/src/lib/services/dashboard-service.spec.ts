import { describe, expect, test, vi, beforeEach } from "vitest";
import { DashboardService } from "./dashboard-service";
import type { OrgId } from "@nexus/types/contracts";

// Mock the shared utilities
vi.mock("@nexus/shared", () => ({
  sumCents: vi.fn((amounts: string[]) => {
    // Simple sum implementation for testing
    return amounts.reduce((sum, amount) => (BigInt(sum) + BigInt(amount || "0")).toString(), "0");
  }),
  pctDelta: vi.fn((curr: number, prev: number) => {
    if (prev === 0) return 0;
    return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
  }),
  zScore: vi.fn((value: number, samples: number[]) => {
    if (samples.length < 4) return 0;
    const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
    const variance =
      samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    const stddev = Math.sqrt(variance);
    return stddev === 0 ? 0 : (value - mean) / stddev;
  }),
}));

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
};

const mockQuery = {
  select: vi.fn(() => mockQuery),
  eq: vi.fn(() => mockQuery),
  in: vi.fn(() => mockQuery),
  gte: vi.fn(() => mockQuery),
  lte: vi.fn(() => mockQuery),
  lt: vi.fn(() => mockQuery),
  single: vi.fn(),
};

describe("DashboardService", () => {
  let dashboardService: DashboardService;
  const mockOrgId = "org-123" as OrgId;

  beforeEach(() => {
    vi.clearAllMocks();
    dashboardService = new DashboardService(mockSupabase as any);
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  describe("getCashMetrics", () => {
    test("calculates cash on hand from liquid accounts", async () => {
      mockQuery.single.mockResolvedValue({
        data: [{ current_balance_cents: "50000" }, { current_balance_cents: "75000" }],
        error: null,
      });

      const result = await dashboardService.getCashMetrics(mockOrgId);

      expect(result.cashOnHandCents).toBe("125000");
      expect(mockSupabase.from).toHaveBeenCalledWith("accounts");
      expect(mockQuery.eq).toHaveBeenCalledWith("org_id", mockOrgId);
      expect(mockQuery.in).toHaveBeenCalledWith("type", ["checking", "savings", "cash"]);
      expect(mockQuery.eq).toHaveBeenCalledWith("is_active", true);
    });

    test("handles null balances gracefully", async () => {
      mockQuery.single.mockResolvedValue({
        data: [{ current_balance_cents: null }, { current_balance_cents: "75000" }],
        error: null,
      });

      const result = await dashboardService.getCashMetrics(mockOrgId);

      expect(result.cashOnHandCents).toBe("75000");
    });

    test("handles empty accounts array", async () => {
      mockQuery.single.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await dashboardService.getCashMetrics(mockOrgId);

      expect(result.cashOnHandCents).toBe("0");
    });
  });

  describe("getInflowOutflowMetrics", () => {
    const mockWindows = {
      today: "2023-12-01",
      d30_from: "2023-11-01",
      d90_from: "2023-09-02",
      prev30_from: "2023-10-02",
      prev30_to: "2023-11-01",
    };

    test("calculates inflow/outflow metrics correctly", async () => {
      // Mock 30d transactions
      mockQuery.single
        .mockResolvedValueOnce({
          data: [
            { amount_cents: "10000" }, // +$100 inflow
            { amount_cents: "-5000" }, // -$50 outflow
            { amount_cents: "20000" }, // +$200 inflow
          ],
          error: null,
        })
        // Mock 90d transactions
        .mockResolvedValueOnce({
          data: [
            { amount_cents: "30000" }, // +$300 inflow
            { amount_cents: "-15000" }, // -$150 outflow
          ],
          error: null,
        });

      const result = await dashboardService.getInflowOutflowMetrics(mockOrgId, mockWindows);

      expect(result.d30.inflowCents).toBe("30000"); // $100 + $200
      expect(result.d30.outflowCents).toBe("5000"); // $50
      expect(result.d90.inflowCents).toBe("30000"); // $300
      expect(result.d90.outflowCents).toBe("15000"); // $150

      // Daily averages (divide by 30)
      expect(result.d30.dailyAvgInflowCents).toBe("1000"); // $30000/30 = $1000
      expect(result.d30.dailyAvgOutflowCents).toBe("166"); // $5000/30 = $166.67 → $166
    });

    test("handles no transactions", async () => {
      mockQuery.single
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await dashboardService.getInflowOutflowMetrics(mockOrgId, mockWindows);

      expect(result.d30.inflowCents).toBe("0");
      expect(result.d30.outflowCents).toBe("0");
      expect(result.d90.inflowCents).toBe("0");
      expect(result.d90.outflowCents).toBe("0");
    });
  });

  describe("getTopExpenses", () => {
    const mockWindows = {
      today: "2023-12-01",
      d30_from: "2023-11-01",
      d90_from: "2023-09-02",
      prev30_from: "2023-10-02",
      prev30_to: "2023-11-01",
    };

    test("groups and sorts expenses by category", async () => {
      mockQuery.single.mockResolvedValue({
        data: [
          { category_id: "cat-1", amount_cents: "-10000", categories: { name: "Restaurants" } },
          { category_id: "cat-2", amount_cents: "-5000", categories: { name: "Office" } },
          { category_id: "cat-1", amount_cents: "-15000", categories: { name: "Restaurants" } },
          { category_id: null, amount_cents: "-3000", categories: null },
        ],
        error: null,
      });

      const result = await dashboardService.getTopExpenses(mockOrgId, mockWindows);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        categoryId: "cat-1",
        name: "Restaurants",
        cents: "25000", // $100 + $150
      });
      expect(result[1]).toEqual({
        categoryId: "cat-2",
        name: "Office",
        cents: "5000",
      });
      expect(result[2]).toEqual({
        categoryId: "uncategorized",
        name: "Uncategorized",
        cents: "3000",
      });
    });

    test("limits results to top 5", async () => {
      const mockData = Array.from({ length: 10 }, (_, i) => ({
        category_id: `cat-${i}`,
        amount_cents: `-${(i + 1) * 1000}`,
        categories: { name: `Category ${i}` },
      }));

      mockQuery.single.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await dashboardService.getTopExpenses(mockOrgId, mockWindows);

      expect(result).toHaveLength(5);
      expect(result[0]?.cents).toBe("10000"); // Highest expense
      expect(result[4]?.cents).toBe("6000"); // 5th highest
    });
  });

  describe("getTrendMetrics", () => {
    const mockWindows = {
      today: "2023-12-01",
      d30_from: "2023-11-01",
      d90_from: "2023-09-02",
      prev30_from: "2023-10-02",
      prev30_to: "2023-11-01",
    };

    test("calculates percentage change correctly", async () => {
      mockQuery.single.mockResolvedValue({
        data: [
          { amount_cents: "-10000" }, // -$100
          { amount_cents: "-5000" }, // -$50
        ],
        error: null,
      });

      const currentOutflow = "20000"; // $200
      const result = await dashboardService.getTrendMetrics(mockOrgId, mockWindows, currentOutflow);

      // Current: $200, Previous: $150 ($100 + $50)
      // Delta: (200 - 150) / 150 = 33.3%
      expect(result.outflowDeltaPct).toBeCloseTo(33.3, 1);
    });

    test("handles zero previous outflow", async () => {
      mockQuery.single.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await dashboardService.getTrendMetrics(mockOrgId, mockWindows, "10000");

      expect(result.outflowDeltaPct).toBe(0);
    });
  });

  describe("getAlertMetrics", () => {
    test("calculates low balance alert correctly", async () => {
      mockQuery.single.mockResolvedValue({
        data: { low_balance_threshold_cents: "100000" },
        error: null,
      });

      // Mock count query
      mockQuery.single.mockResolvedValue({ count: 5, error: null });

      const result = await dashboardService.getAlertMetrics(mockOrgId, "50000");

      expect(result.lowBalance).toBe(true); // $500 < $1000
      expect(result.needsReviewCount).toBe(5);
    });

    test("handles missing org threshold", async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: null,
      });

      mockQuery.single.mockResolvedValue({ count: 0, error: null });

      const result = await dashboardService.getAlertMetrics(mockOrgId, "150000");

      expect(result.lowBalance).toBe(false); // $1500 > $1000 (default)
      expect(result.needsReviewCount).toBe(0);
    });
  });
});
