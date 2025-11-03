"use client";

import { DonutChart } from "./charts";
import { mockPayoutBreakdown } from "./mock-data";

/**
 * Shopify Reconciliation visual
 * Shows payout breakdown with donut chart
 */
export function ShopifyReconVisual() {
  const { total, segments } = mockPayoutBreakdown;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left: Payout summary */}
        <div className="space-y-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Shopify Payout
            </p>
            <p className="text-3xl font-bold font-mono mb-1">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(total)}
            </p>
            <p className="text-xs text-muted-foreground">Jan 15 - Jan 28, 2025</p>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {segments.map((segment) => {
              const percent = ((segment.value / total) * 100).toFixed(1);
              return (
                <div key={segment.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-sm text-muted-foreground">{segment.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(segment.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">{percent}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Donut chart */}
        <div className="flex items-center justify-center">
          <DonutChart segments={segments} size={200} thickness={40} />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
        <p>Automatic reconciliation • Every penny accounted for</p>
      </div>
    </div>
  );
}

