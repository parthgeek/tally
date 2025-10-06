"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, Package } from "lucide-react";
import { CategoryPill } from "@/components/ui/category-pill";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { cn } from "@/lib/utils";

// Mock transaction data
const mockTransactions = [
  {
    id: "1",
    date: "2025-10-06",
    description: "Shopify Payout",
    amount: 12847.5,
    category: "DTC Sales",
    categoryType: "revenue" as const,
    confidence: 0.98,
  },
  {
    id: "2",
    date: "2025-10-05",
    description: "Stripe Processing Fees",
    amount: -384.23,
    category: "Payment Processing",
    categoryType: "opex" as const,
    confidence: 0.95,
  },
  {
    id: "3",
    date: "2025-10-05",
    description: "Inventory Purchase - Widget Co",
    amount: -5240.0,
    category: "Inventory & COGS",
    categoryType: "cogs" as const,
    confidence: 0.92,
  },
  {
    id: "4",
    date: "2025-10-04",
    description: "Meta Ads Campaign",
    amount: -850.0,
    category: "Marketing & Advertising",
    categoryType: "opex" as const,
    confidence: 0.99,
  },
  {
    id: "5",
    date: "2025-10-04",
    description: "Amazon Seller Payout",
    amount: 6234.12,
    category: "DTC Sales",
    categoryType: "revenue" as const,
    confidence: 0.97,
  },
];

// Mock metrics data
const mockMetrics = {
  revenue: { value: 124382, change: 12.3 },
  cogs: { value: 52180, change: -3.2 },
  grossMargin: { value: 58.1, change: 2.1 },
};

/**
 * Dashboard preview component for landing page hero section
 * Shows semi-interactive mock dashboard with animations
 */
export function DashboardPreview() {
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Animate on mount
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Rotate transactions every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTransactionIndex((prev) => (prev + 1) % mockTransactions.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  return (
    <div
      className={cn(
        "relative transition-all duration-800",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      {/* Dashboard container with shadow */}
      <div className="rounded-xl shadow-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Dashboard</h3>
            <div className="text-xs text-muted-foreground">Last 30 days</div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="p-4 sm:p-6 grid grid-cols-3 gap-3 sm:gap-4 bg-background">
          {/* Revenue */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-bold font-mono">
                {formatCurrency(mockMetrics.revenue.value)}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <span className="text-green-600 font-medium">
                  {formatPercentage(mockMetrics.revenue.change)}
                </span>
              </div>
            </div>
          </div>

          {/* COGS */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-muted-foreground">COGS</p>
            </div>
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-bold font-mono">
                {formatCurrency(mockMetrics.cogs.value)}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <TrendingDown className="w-3 h-3 text-green-600" />
                <span className="text-green-600 font-medium">
                  {formatPercentage(mockMetrics.cogs.change)}
                </span>
              </div>
            </div>
          </div>

          {/* Gross Margin */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-muted-foreground">Margin</p>
            </div>
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-bold font-mono">
                {mockMetrics.grossMargin.value}%
              </div>
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <span className="text-green-600 font-medium">
                  {formatPercentage(mockMetrics.grossMargin.change)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="p-4 sm:p-6 pt-0 bg-background">
          <h4 className="text-sm font-semibold mb-3">Recent Transactions</h4>
          <div className="space-y-2">
            {mockTransactions.slice(0, 3).map((transaction, index) => (
              <div
                key={transaction.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all duration-300",
                  index === currentTransactionIndex % 3
                    ? "border-primary/50 bg-primary/5 scale-[1.02]"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{transaction.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CategoryPill tier1={transaction.categoryType} tier2={transaction.category} />
                    <ConfidenceBadge confidence={transaction.confidence} />
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div
                    className={cn(
                      "text-sm font-mono font-semibold",
                      transaction.amount > 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {transaction.amount > 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(transaction.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decorative gradient background */}
      <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 rounded-xl" />
    </div>
  );
}
