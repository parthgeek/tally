"use client";

import { useState, useEffect } from "react";
import { Check, Download } from "lucide-react";
import { ProgressBar } from "./primitives";
import { exportProviders } from "./mock-data";

/**
 * Export visual
 * Shows export interface with progress and success states
 */
export function ExportVisual() {
  const [providers, setProviders] = useState(exportProviders);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isExporting) {
      const duration = 2000; // 2 seconds
      const steps = 50;
      const increment = 100 / steps;
      const stepDuration = duration / steps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        setProgress(currentStep * increment);

        if (currentStep >= steps) {
          clearInterval(timer);
          setIsComplete(true);
          setIsExporting(false);
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }
  }, [isExporting]);

  const handleExport = () => {
    setProgress(0);
    setIsComplete(false);
    setIsExporting(true);
  };

  const toggleProvider = (id: string) => {
    if (isExporting || isComplete) return;
    setProviders(
      providers.map((p) => (p.id === id ? { ...p, checked: !p.checked } : p))
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6 max-w-md mx-auto">
      <div>
        <h4 className="text-lg font-semibold mb-2">Export Financial Data</h4>
        <p className="text-sm text-muted-foreground">
          Tax-ready exports in one click. Choose your format below.
        </p>
      </div>

      {/* Provider selection */}
      <div className="space-y-2">
        {providers.map((provider) => (
          <label
            key={provider.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
          >
            <input
              type="checkbox"
              checked={provider.checked}
              onChange={() => toggleProvider(provider.id)}
              disabled={isExporting || isComplete}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <span className="text-sm font-medium">{provider.label}</span>
          </label>
        ))}
      </div>

      {/* Export button and progress */}
      <div className="space-y-3">
        <button
          onClick={handleExport}
          disabled={isExporting || isComplete || !providers.some((p) => p.checked)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isComplete ? (
            <>
              <Check className="w-4 h-4" />
              <span>Export Complete</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>{isExporting ? "Exporting..." : "Export Data"}</span>
            </>
          )}
        </button>

        {isExporting && (
          <div>
            <ProgressBar progress={progress} />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Preparing your export...
            </p>
          </div>
        )}

        {isComplete && (
          <div className="p-3 rounded-lg bg-success-background border border-success/30">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-success-foreground" />
              <span className="font-medium text-success-foreground">
                export_2025_Q1.csv
              </span>
            </div>
            <p className="text-xs text-success-foreground/80 mt-1">
              Ready to send to your accountant
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border text-xs text-muted-foreground">
        <p>Compatible with QuickBooks, Xero, and standard CSV format</p>
      </div>
    </div>
  );
}

