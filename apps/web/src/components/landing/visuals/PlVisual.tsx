"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "./charts";
import { KPICard } from "./primitives";
import { generateProfitSeries } from "./mock-data";

/**
 * Real-time P&L visual
 * Shows net profit KPI with animated count-up and sparkline chart
 */
export function PlVisual() {
  const targetValue = 48234;
  const [displayValue, setDisplayValue] = useState(0);
  const profitSeries = generateProfitSeries(30);

  // Animated count-up effect
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    if (prefersReducedMotion) {
      setDisplayValue(targetValue);
      return;
    }

    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = targetValue / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(targetValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(currentStep * increment));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [targetValue]);

  const formattedValue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(displayValue);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
      <KPICard
        title="Net Profit (After Taxes)"
        value={formattedValue}
        delta={{ value: "+12.3%", isPositive: true }}
        caption="Real-time profit tracking • Updated live"
      >
        <div className="mt-4">
          <Sparkline points={profitSeries} width={280} height={64} />
        </div>
      </KPICard>
      
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Last 30 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span>Trending up</span>
        </div>
      </div>
    </div>
  );
}

