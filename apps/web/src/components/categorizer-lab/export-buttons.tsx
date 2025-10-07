"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exportMetricsAsCSV } from "@/lib/categorizer-lab/metrics";
import type {
  LabTransaction,
  TransactionResult,
  Metrics,
  LabRunResponse,
} from "@/lib/categorizer-lab/types";

interface ExportButtonsProps {
  originalTransactions: LabTransaction[];
  results: TransactionResult[];
  metrics: Metrics | null;
  runResponse: LabRunResponse | null;
}

export function ExportButtons({
  originalTransactions,
  results,
  metrics,
  runResponse,
}: ExportButtonsProps) {
  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportResultsAsJSON = () => {
    if (!runResponse) return;

    const exportData = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalTransactions: originalTransactions.length,
        successfulResults: results.filter((r) => !r.error).length,
        errors: results.filter((r) => r.error).length,
      },
      originalTransactions,
      results,
      metrics,
      fullResponse: runResponse,
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    downloadFile(jsonContent, `categorizer-lab-results-${timestamp}.json`, "application/json");
  };

  const exportResultsAsCSV = () => {
    if (results.length === 0) return;

    // Create lookup map for original transactions
    const originalMap = new Map(originalTransactions.map((tx) => [tx.id, tx]));

    const csvLines = [
      // Header
      [
        "transaction_id",
        "description",
        "merchant_name",
        "amount_cents",
        "mcc",
        "ground_truth_category",
        "predicted_category",
        "confidence",
        "engine",
        "total_ms",
        "pass1_ms",
        "pass2_ms",
        "rationale",
        "error",
        "correct",
      ].join(","),
    ];

    // Data rows
    results.forEach((result) => {
      const original = originalMap.get(result.id);
      const isCorrect =
        original?.categoryId && result.predictedCategoryId
          ? original.categoryId === result.predictedCategoryId
            ? "true"
            : "false"
          : "";

      const row = [
        result.id,
        original?.description ? `"${original.description.replace(/"/g, '""')}"` : "",
        original?.merchantName ? `"${original.merchantName.replace(/"/g, '""')}"` : "",
        original?.amountCents || "",
        original?.mcc || "",
        original?.categoryId || "",
        result.predictedCategoryId || "",
        result.confidence?.toFixed(3) || "",
        result.engine,
        result.timings.totalMs.toString(),
        result.timings.pass1Ms?.toString() || "",
        result.timings.pass2Ms?.toString() || "",
        result.rationale.length > 0 ? `"${result.rationale.join("; ").replace(/"/g, '""')}"` : "",
        result.error ? `"${result.error.replace(/"/g, '""')}"` : "",
        isCorrect,
      ].join(",");

      csvLines.push(row);
    });

    const csvContent = csvLines.join("\n");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    downloadFile(csvContent, `categorizer-lab-results-${timestamp}.csv`, "text/csv");
  };

  const exportMetricsAsCSVFile = () => {
    if (!metrics) return;

    const csvContent = exportMetricsAsCSV(metrics);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    downloadFile(csvContent, `categorizer-lab-metrics-${timestamp}.csv`, "text/csv");
  };

  const exportErrorLog = () => {
    if (!runResponse?.errors || runResponse.errors.length === 0) return;

    const errorLog = [
      `Categorizer Lab Error Log`,
      `Generated: ${new Date().toISOString()}`,
      `Total Errors: ${runResponse.errors.length}`,
      ``,
      ...runResponse.errors.map((error, index) => `${index + 1}. ${error}`),
    ].join("\n");

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    downloadFile(errorLog, `categorizer-lab-errors-${timestamp}.txt`, "text/plain");
  };

  const exportDatasetTemplate = () => {
    const template = {
      transactions: [
        {
          id: "example-1",
          description: "STARBUCKS STORE #12345",
          merchantName: "STARBUCKS",
          mcc: "5814",
          amountCents: "-500",
          date: "2024-01-15",
          currency: "USD",
          categoryId: "meals",
        },
        {
          id: "example-2",
          description: "ELECTRIC COMPANY MONTHLY BILL",
          merchantName: "ELECTRIC UTILITY",
          mcc: "4900",
          amountCents: "-15000",
          date: "2024-01-01",
          currency: "USD",
          categoryId: "utilities",
        },
      ],
    };

    const jsonContent = JSON.stringify(template, null, 2);
    downloadFile(jsonContent, "categorizer-lab-template.json", "application/json");
  };

  const hasResults = results.length > 0;
  const hasErrors = runResponse?.errors && runResponse.errors.length > 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Export Results</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Results Export */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700">Results</h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={exportResultsAsJSON}
                disabled={!hasResults}
                className="w-full text-sm"
              >
                Export as JSON
              </Button>
              <Button
                variant="outline"
                onClick={exportResultsAsCSV}
                disabled={!hasResults}
                className="w-full text-sm"
              >
                Export as CSV
              </Button>
            </div>
          </div>

          {/* Metrics Export */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700">Metrics</h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={exportMetricsAsCSVFile}
                disabled={!metrics}
                className="w-full text-sm"
              >
                Export Metrics CSV
              </Button>
              <Button
                variant="outline"
                onClick={exportErrorLog}
                disabled={!hasErrors}
                className="w-full text-sm"
              >
                Export Error Log
              </Button>
            </div>
          </div>
        </div>

        {/* Template Export */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-sm text-gray-700 mb-2">Templates</h4>
          <Button variant="outline" onClick={exportDatasetTemplate} className="w-full text-sm">
            Download Dataset Template
          </Button>
        </div>

        <div className="text-sm text-gray-500">
          <p>
            <strong>Export Formats:</strong>
          </p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>
              <strong>JSON:</strong> Complete results with metadata for programmatic use
            </li>
            <li>
              <strong>CSV:</strong> Tabular format for analysis in Excel/Google Sheets
            </li>
            <li>
              <strong>Metrics CSV:</strong> Summary statistics and per-category performance
            </li>
            <li>
              <strong>Error Log:</strong> Text file with detailed error messages
            </li>
          </ul>
        </div>

        {!hasResults && (
          <div className="text-center text-gray-500 py-4">
            Run categorization to enable result exports.
          </div>
        )}
      </div>
    </Card>
  );
}
