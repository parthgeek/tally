"use client";

import { useEffect, useState } from "react";
import { Badge, CategoryPill } from "./primitives";
import { mockTransactions } from "./mock-data";

/**
 * Smart Categorization visual
 * Shows transaction list with animated category correction
 */
export function CategorizationVisual() {
  const [showCorrection, setShowCorrection] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCorrection(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-muted-foreground">Recent Transactions</h4>
        <Badge variant="success" size="sm">
          AI Powered
        </Badge>
      </div>

      <div className="space-y-3">
        {mockTransactions.map((txn) => {
          const isCorrected = txn.corrected && showCorrection;
          const displayCategory = isCorrected ? txn.category : txn.previousCategory || txn.category;

          return (
            <div
              key={txn.id}
              className={`p-3 rounded-lg border transition-all duration-300 ${
                isCorrected
                  ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{txn.vendor}</p>
                    {isCorrected && (
                      <Badge variant="success" size="sm">
                        Corrected
                      </Badge>
                    )}
                    {!txn.corrected && (
                      <Badge variant="muted" size="sm">
                        Auto
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CategoryPill>{displayCategory}</CategoryPill>
                    <span className="text-xs text-muted-foreground">{txn.date}</span>
                  </div>
                </div>
                <p className="text-sm font-mono font-medium whitespace-nowrap">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(txn.amount)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-border text-xs text-muted-foreground">
        <p>AI learns from your corrections • IRS category compliant</p>
      </div>
    </div>
  );
}

