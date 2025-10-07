"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardDTO } from "@nexus/types/contracts";

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      return response.json() as Promise<DashboardDTO>;
    },
    staleTime: 60 * 1000, // 60 seconds
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDashboardCharts(dashboard: DashboardDTO | undefined, timeRange: "30d" | "90d") {
  const chartData = dashboard
    ? [
        {
          name: "Cash In",
          [`${timeRange}`]:
            Number(
              BigInt(dashboard.inflowOutflow[timeRange === "30d" ? "d30" : "d90"].inflowCents)
            ) / 100,
        },
        {
          name: "Cash Out",
          [`${timeRange}`]:
            Number(
              BigInt(dashboard.inflowOutflow[timeRange === "30d" ? "d30" : "d90"].outflowCents)
            ) / 100,
        },
      ]
    : [];

  const colors = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
  const pieData =
    dashboard?.topExpenses30.map((expense, index) => ({
      name: expense.name,
      value: Number(BigInt(expense.cents)) / 100,
      color: colors[index % colors.length] || "#0088FE",
    })) || [];

  // Mock trend data for sparkline (could be enhanced with real weekly data)
  const trendData = Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    amount: Math.random() * 1000 + 500,
  }));

  return {
    chartData,
    pieData,
    trendData,
  };
}
