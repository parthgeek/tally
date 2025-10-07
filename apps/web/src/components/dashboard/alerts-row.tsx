import { AlertTriangle, TrendingUp, Eye, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DashboardDTO } from "@nexus/types/contracts";

interface AlertsRowProps {
  alerts: DashboardDTO["alerts"];
  onAlertClick: (type: "low_balance" | "unusual_spend" | "needs_review") => void;
}

export function AlertsRow({ alerts, onAlertClick }: AlertsRowProps) {
  const hasAlerts = alerts.lowBalance || alerts.unusualSpend || alerts.needsReviewCount > 0;

  if (!hasAlerts) return null;

  return (
    <div className="space-y-2">
      {/* Low Balance Alert */}
      {alerts.lowBalance && (
        <Link
          href="/settings/thresholds"
          onClick={() => onAlertClick("low_balance")}
          className="block"
        >
          <div
            className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors",
              "bg-destructive-background border-destructive/20",
              "hover:bg-destructive-background/80 cursor-pointer"
            )}
          >
            <div className="mt-0.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 text-sm">
              <span className="font-medium text-destructive">Low Balance Alert</span>
              <p className="text-muted-foreground mt-0.5">
                Your cash on hand is below the configured threshold
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Unusual Spending Alert */}
      {alerts.unusualSpend && (
        <div
          onClick={() => onAlertClick("unusual_spend")}
          className={cn(
            "flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors",
            "bg-warning-background border-warning/20",
            "hover:bg-warning-background/80 cursor-pointer"
          )}
        >
          <div className="mt-0.5">
            <TrendingUp className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1 text-sm">
            <span className="font-medium text-warning-foreground">Unusual Spending Pattern</span>
            <p className="text-muted-foreground mt-0.5">
              Recent spending is significantly higher than normal
            </p>
          </div>
        </div>
      )}

      {/* Needs Review Alert */}
      {alerts.needsReviewCount > 0 && (
        <Link href="/review" onClick={() => onAlertClick("needs_review")} className="block">
          <div
            className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors",
              "bg-accent/50 border-primary/20",
              "hover:bg-accent/70 cursor-pointer"
            )}
          >
            <div className="mt-0.5">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 text-sm">
              <span className="font-medium text-foreground">
                {alerts.needsReviewCount}{" "}
                {alerts.needsReviewCount === 1 ? "Transaction" : "Transactions"} Need Review
              </span>
              <p className="text-muted-foreground mt-0.5">
                Low confidence categorizations require your attention
              </p>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
