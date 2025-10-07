import React from "react";
import { describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDashboardCharts } from "./use-dashboard";
import type { DashboardDTO } from "@nexus/types/contracts";

// Mock fetch globally
global.fetch = vi.fn();

const mockDashboard: DashboardDTO = {
  cashOnHandCents: "100000",
  safeToSpend14Cents: "80000",
  inflowOutflow: {
    d30: {
      inflowCents: "50000",
      outflowCents: "30000",
      dailyAvgInflowCents: "1666",
      dailyAvgOutflowCents: "1000",
    },
    d90: {
      inflowCents: "150000",
      outflowCents: "90000",
    },
  },
  topExpenses30: [
    { categoryId: "cat-1", name: "Restaurants", cents: "15000" },
    { categoryId: "cat-2", name: "Office", cents: "10000" },
  ],
  trend: {
    outflowDeltaPct: 15.5,
  },
  alerts: {
    lowBalance: false,
    unusualSpend: true,
    needsReviewCount: 3,
  },
  generatedAt: "2023-12-01T10:00:00Z",
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useDashboardCharts", () => {
  test("formats chart data correctly for 30d range", () => {
    const { result } = renderHook(() => useDashboardCharts(mockDashboard, "30d"), {
      wrapper: createWrapper(),
    });

    expect(result.current.chartData).toEqual([
      {
        name: "Cash In",
        "30d": 500, // 50000 cents = $500
      },
      {
        name: "Cash Out",
        "30d": 300, // 30000 cents = $300
      },
    ]);
  });

  test("formats chart data correctly for 90d range", () => {
    const { result } = renderHook(() => useDashboardCharts(mockDashboard, "90d"), {
      wrapper: createWrapper(),
    });

    expect(result.current.chartData).toEqual([
      {
        name: "Cash In",
        "90d": 1500, // 150000 cents = $1500
      },
      {
        name: "Cash Out",
        "90d": 900, // 90000 cents = $900
      },
    ]);
  });

  test("formats pie data correctly", () => {
    const { result } = renderHook(() => useDashboardCharts(mockDashboard, "30d"), {
      wrapper: createWrapper(),
    });

    expect(result.current.pieData).toEqual([
      {
        name: "Restaurants",
        value: 150, // 15000 cents = $150
        color: "#0088FE",
      },
      {
        name: "Office",
        value: 100, // 10000 cents = $100
        color: "#00C49F",
      },
    ]);
  });

  test("returns empty arrays when dashboard is undefined", () => {
    const { result } = renderHook(() => useDashboardCharts(undefined, "30d"), {
      wrapper: createWrapper(),
    });

    expect(result.current.chartData).toEqual([]);
    expect(result.current.pieData).toEqual([]);
    expect(result.current.trendData).toHaveLength(7); // Mock data is always generated
  });

  test("generates trend data with 7 days", () => {
    const { result } = renderHook(() => useDashboardCharts(mockDashboard, "30d"), {
      wrapper: createWrapper(),
    });

    expect(result.current.trendData).toHaveLength(7);
    expect(result.current.trendData[0]).toHaveProperty("day", 1);
    expect(result.current.trendData[0]).toHaveProperty("amount");
    expect(result.current.trendData[6]).toHaveProperty("day", 7);
  });

  test("handles BigInt conversion correctly", () => {
    const dashboardWithLargeNumbers: DashboardDTO = {
      ...mockDashboard,
      inflowOutflow: {
        d30: {
          inflowCents: "999999999999", // Very large number
          outflowCents: "888888888888",
          dailyAvgInflowCents: "1666",
          dailyAvgOutflowCents: "1000",
        },
        d90: {
          inflowCents: "150000",
          outflowCents: "90000",
        },
      },
    };

    const { result } = renderHook(() => useDashboardCharts(dashboardWithLargeNumbers, "30d"), {
      wrapper: createWrapper(),
    });

    expect(result.current.chartData[0]?.["30d"]).toBe(9999999999.99); // Correct conversion
    expect(result.current.chartData[1]?.["30d"]).toBe(8888888888.88);
  });
});
