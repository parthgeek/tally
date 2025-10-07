"use client";

import { useState, useEffect } from "react";
import { DatasetLoader } from "@/components/categorizer-lab/dataset-loader";
import { RunControls } from "@/components/categorizer-lab/run-controls";
import { ProgressPanel } from "@/components/categorizer-lab/progress-panel";
import { ResultsTable } from "@/components/categorizer-lab/results-table";
import { MetricsSummary } from "@/components/categorizer-lab/metrics-summary";
import { Charts } from "@/components/categorizer-lab/charts";
import { ExportButtons } from "@/components/categorizer-lab/export-buttons";
import { FeatureStatusIndicator } from "@/components/categorizer-lab/feature-status";
import { runWithProgress } from "@/lib/categorizer-lab/client";
import type {
  LabTransaction,
  LabRunRequest,
  LabRunResponse,
  TransactionResult,
  Metrics,
} from "@/lib/categorizer-lab/types";

export default function CategorizerLabClient() {
  const [dataset, setDataset] = useState<LabTransaction[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const [progress, setProgress] = useState<
    { processed: number; total: number; current?: string } | undefined
  >();
  const [results, setResults] = useState<TransactionResult[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [runResponse, setRunResponse] = useState<LabRunResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Ensure proper hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleDatasetLoaded = (transactions: LabTransaction[]) => {
    setDataset(transactions);
    // Clear previous results when new dataset is loaded
    setResults([]);
    setMetrics(null);
    setRunResponse(null);
    setErrors([]);
    setProgress(undefined);
    setRunCompleted(false);
    console.log("Dataset loaded:", transactions.length);
  };

  const handleRunStart = async (request: LabRunRequest) => {
    // 1. Set the initial "running" state
    setIsRunning(true);
    setRunCompleted(false);
    setProgress({ processed: 0, total: request.dataset.length });
    setErrors([]);
    console.log("Run started...");

    try {
      // 2. Await the async operation
      const response = await runWithProgress(request, setProgress);

      // 3. Set the final "completed" state with the response data
      setResults(response.results);
      setMetrics(response.metrics);
      setRunResponse(response);
      setErrors(response.errors);
    } catch (error) {
      // 4. Handle errors by setting an error state
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setErrors([errorMessage]);
      console.error("Lab run failed:", error);
    } finally {
      // 5. Always mark the run as completed and no longer running in the finally block
      setIsRunning(false);
      setRunCompleted(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Categorization Lab</h1>
        <p className="text-muted-foreground mt-2">
          Test and visualize the categorization engine on synthetic or uploaded transaction batches.
        </p>
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-black">
          <p className="text-sm text-amber-800">
            <strong>Development Tool:</strong> This lab is for testing purposes only and does not
            affect production data.
          </p>
        </div>

        {/* Feature Status */}
        <div className="mt-4">
          <FeatureStatusIndicator />
        </div>
      </div>

      <div className="space-y-6">
        {/* Dataset Loader Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">1. Dataset</h2>
          {/* Debug info */}
          <div
            className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-black"
            data-testid="dataset-debug-info"
          >
            <strong>🔧 Debug Info:</strong> Dataset has {dataset.length} transactions loaded |
            Hydrated: {isHydrated ? "✅" : "❌"}
          </div>
          <DatasetLoader onDatasetLoaded={handleDatasetLoaded} disabled={isRunning} />
        </div>

        {/* Run Controls Section */}
        {dataset.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">2. Configuration</h2>
            <RunControls dataset={dataset} onRunStart={handleRunStart} isRunning={isRunning} />
          </div>
        )}

        {/* Progress Section */}
        {(isRunning || (progress && !runCompleted)) && (
          <div>
            <h2 className="text-xl font-semibold mb-4">3. Progress</h2>
            <ProgressPanel isRunning={isRunning} progress={progress} errors={errors} />
          </div>
        )}

        {/* Completion Message and Results Section */}
        {runCompleted && (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md text-black">
              <h2 className="text-lg font-semibold text-green-800 mb-2">Categorization Complete</h2>
              <p className="text-sm text-green-700">
                Processing finished. {results.length} transactions processed.
                {errors.length > 0 && ` ${errors.length} errors encountered.`}
              </p>
            </div>

            {results.length > 0 && (
              <>
                <div>
                  <h2 className="text-xl font-semibold mb-4">4. Results</h2>
                  <ResultsTable originalTransactions={dataset} results={results} />
                </div>

                {/* Metrics Section */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">5. Metrics</h2>
                  <MetricsSummary metrics={metrics} />
                </div>

                {/* Charts Section */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">6. Visualizations</h2>
                  <Charts metrics={metrics} />
                </div>

                {/* Export Section */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">7. Export</h2>
                  <ExportButtons
                    originalTransactions={dataset}
                    results={results}
                    metrics={metrics}
                    runResponse={runResponse}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
