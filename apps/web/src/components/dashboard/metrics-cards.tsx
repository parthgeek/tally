import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, PiggyBank, Eye, TrendingUp } from "lucide-react";
import Link from "next/link";
import { toUSD } from "@nexus/shared";
import type { DashboardDTO } from "@nexus/types/contracts";

interface MetricsCardsProps {
  dashboard: DashboardDTO;
}

export function MetricsCards({ dashboard }: MetricsCardsProps) {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Cash on Hand */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs sm:text-sm">Cash on Hand</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="pt-2 sm:pt-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">
            {toUSD(dashboard.cashOnHandCents)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Available liquid funds</p>
        </CardContent>
      </Card>

      {/* Safe to Spend */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs sm:text-sm">Safe to Spend (14d)</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="pt-2 sm:pt-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">
            {toUSD(dashboard.safeToSpend14Cents)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Projected available in 2 weeks</p>
        </CardContent>
      </Card>

      {/* Needs Review */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs sm:text-sm">Needs Review</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="pt-2 sm:pt-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">
            {dashboard.alerts.needsReviewCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <Link
              href="/review"
              className="hover:text-foreground transition-colors touch-manipulation"
            >
              Transactions to review →
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Spending Trend */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs sm:text-sm">Spending Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="pt-2 sm:pt-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">
            {dashboard.trend.outflowDeltaPct > 0 ? "+" : ""}
            {dashboard.trend.outflowDeltaPct}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">vs previous 30 days</p>
        </CardContent>
      </Card>
    </div>
  );
}
