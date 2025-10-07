"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RationalePopover, type RationaleData } from "./rationale-popover";
import { InfoIcon, AlertTriangleIcon } from "lucide-react";
import type { LabTransaction, TransactionResult } from "@/lib/categorizer-lab/types";
import { formatCategoryForDisplay } from "@/lib/categorizer-lab/taxonomy-helpers";
import { CategoryHierarchy } from "@/lib/categorizer-lab/category-badge";

interface ResultsTableProps {
  originalTransactions: LabTransaction[];
  results: TransactionResult[];
}

export function ResultsTable({ originalTransactions, results }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEngine, setFilterEngine] = useState<"all" | "pass1" | "llm">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "error">("all");
  const [sortBy, setSortBy] = useState<"id" | "confidence" | "timing">("id");
  const [sortDesc, setSortDesc] = useState(false);

  // Create lookup map for original transactions
  const originalMap = new Map(originalTransactions.map((tx) => [tx.id, tx]));

  // Filter and sort results
  const filteredResults = results
    .filter((result) => {
      // Search filter
      if (searchTerm) {
        const original = originalMap.get(result.id);
        const searchLower = searchTerm.toLowerCase();

        // Get category names for search
        const groundTruthCategoryName = original?.categoryId
          ? formatCategoryForDisplay(original.categoryId).toLowerCase()
          : "";
        const predictedCategoryName = result.predictedCategoryId
          ? formatCategoryForDisplay(result.predictedCategoryId).toLowerCase()
          : "";

        if (
          !result.id.toLowerCase().includes(searchLower) &&
          !original?.description.toLowerCase().includes(searchLower) &&
          !original?.merchantName?.toLowerCase().includes(searchLower) &&
          !result.predictedCategoryId?.toLowerCase().includes(searchLower) &&
          !groundTruthCategoryName.includes(searchLower) &&
          !predictedCategoryName.includes(searchLower)
        ) {
          return false;
        }
      }

      // Engine filter
      if (filterEngine !== "all" && result.engine !== filterEngine) {
        return false;
      }

      // Status filter
      if (filterStatus === "success" && result.error) {
        return false;
      }
      if (filterStatus === "error" && !result.error) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "id":
          comparison = a.id.localeCompare(b.id);
          break;
        case "confidence":
          comparison = (a.confidence || 0) - (b.confidence || 0);
          break;
        case "timing":
          comparison = a.timings.totalMs - b.timings.totalMs;
          break;
      }

      return sortDesc ? -comparison : comparison;
    });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(false);
    }
  };

  const formatAmount = (amountCents: string): string => {
    const cents = parseInt(amountCents, 10);
    const dollars = cents / 100;
    const isNegative = cents < 0;
    return `${isNegative ? "-" : ""}$${Math.abs(dollars).toFixed(2)}`;
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined) return null;

    let variant: "default" | "secondary" | "destructive" = "secondary";
    if (confidence >= 0.8) variant = "default";
    else if (confidence < 0.5) variant = "destructive";

    return (
      <Badge variant={variant} className="text-xs">
        {(confidence * 100).toFixed(0)}%
      </Badge>
    );
  };

  const getAccuracyIndicator = (result: TransactionResult): React.JSX.Element | null => {
    const original = originalMap.get(result.id);
    if (!original?.categoryId || !result.predictedCategoryId) return null;

    const isCorrect = original.categoryId === result.predictedCategoryId;
    return (
      <Badge variant={isCorrect ? "default" : "destructive"} className="text-xs">
        {isCorrect ? "✓" : "✗"}
      </Badge>
    );
  };

  const getRationaleView = (result: TransactionResult): React.JSX.Element => {
    if (result.error) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangleIcon className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    }

    // Extract rationale data from result
    const rationaleData: RationaleData = {
      rationale: result.rationale || [],
      engine: result.engine as "pass1" | "llm",
      // Check if this is an enhanced result with additional data
      signals: (result as any).signals || undefined,
      guardrailsApplied: (result as any).guardrailsApplied || false,
      guardrailViolations: (result as any).guardrailViolations || [],
      pass1Context: (result as any).pass1Context || undefined,
    };

    // Only add predictedCategoryId if it exists
    if (result.predictedCategoryId) {
      rationaleData.predictedCategoryId = result.predictedCategoryId;
    }

    // Only add confidence if it exists
    if (result.confidence !== undefined) {
      rationaleData.confidence = result.confidence;
    }

    // Count available details for summary
    const detailsCount = [
      rationaleData.rationale.length > 0,
      rationaleData.signals && rationaleData.signals.length > 0,
      rationaleData.pass1Context,
      rationaleData.guardrailsApplied,
    ].filter(Boolean).length;

    if (detailsCount === 0) {
      return <span className="text-gray-400 text-xs">No details</span>;
    }

    return (
      <RationalePopover data={rationaleData}>
        <div className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
          <InfoIcon className="w-3 h-3" />
          <span className="text-xs">
            {detailsCount} detail{detailsCount > 1 ? "s" : ""}
          </span>
          {rationaleData.guardrailsApplied && (
            <AlertTriangleIcon className="w-3 h-3 text-amber-500" />
          )}
        </div>
      </RationalePopover>
    );
  };

  if (results.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>No results yet. Run categorization to see results here.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Results ({filteredResults.length})</h3>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{results.length} total</Badge>
            <Badge variant="outline">{results.filter((r) => !r.error).length} success</Badge>
            <Badge variant="outline">{results.filter((r) => r.error).length} errors</Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <select
              value={filterEngine}
              onChange={(e) => setFilterEngine(e.target.value as typeof filterEngine)}
              className="w-full rounded-md border border-gray-300 bg-white text-black py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Engines</option>
              <option value="pass1">Pass-1 Only</option>
              <option value="llm">LLM Only</option>
            </select>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="w-full rounded-md border border-gray-300 bg-white text-black py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="success">Success Only</option>
              <option value="error">Errors Only</option>
            </select>
          </div>
          <div>
            <Button variant="outline" size="sm" className="w-full">
              Export Filtered
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-black">
                <th
                  className="text-left p-3 cursor-pointer hover:bg-gray-100 hover:text-black"
                  onClick={() => handleSort("id")}
                >
                  Transaction ID {sortBy === "id" && (sortDesc ? "↓" : "↑")}
                </th>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Ground Truth</th>
                <th className="text-left p-3">Predicted</th>
                <th
                  className="text-left p-3 cursor-pointer hover:bg-gray-100 hover:text-black"
                  onClick={() => handleSort("confidence")}
                >
                  Confidence {sortBy === "confidence" && (sortDesc ? "↓" : "↑")}
                </th>
                <th className="text-left p-3">Engine</th>
                <th className="text-left p-3">Rationale</th>
                <th
                  className="text-left p-3 cursor-pointer hover:bg-gray-100 hover:text-black"
                  onClick={() => handleSort("timing")}
                >
                  Timing {sortBy === "timing" && (sortDesc ? "↓" : "↑")}
                </th>
                <th className="text-left p-3">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => {
                const original = originalMap.get(result.id);
                return (
                  <tr key={result.id} className="border-b hover:bg-gray-50 hover:text-black">
                    <td className="p-3 font-mono text-xs">{result.id}</td>
                    <td className="p-3 max-w-xs">
                      <div className="truncate" title={original?.description}>
                        {original?.description}
                      </div>
                      {original?.merchantName && (
                        <div className="text-gray-500 text-xs truncate">
                          {original.merchantName}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {original ? formatAmount(original.amountCents) : "—"}
                    </td>
                    <td className="p-3">
                      {original?.categoryId ? (
                        <CategoryHierarchy categoryId={original.categoryId} />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {result.error ? (
                        <Badge variant="destructive" className="text-xs">
                          Error
                        </Badge>
                      ) : result.predictedCategoryId ? (
                        <CategoryHierarchy categoryId={result.predictedCategoryId} />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3">{getConfidenceBadge(result.confidence)}</td>
                    <td className="p-3">
                      <Badge
                        variant={result.engine === "llm" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {result.engine === "llm" ? "LLM" : "Pass-1"}
                      </Badge>
                    </td>
                    <td className="p-3">{getRationaleView(result)}</td>
                    <td className="p-3 font-mono text-xs">
                      <div>{result.timings.totalMs}ms</div>
                      {result.timings.pass1Ms && (
                        <div className="text-gray-500">P1: {result.timings.pass1Ms}ms</div>
                      )}
                      {result.timings.pass2Ms && (
                        <div className="text-gray-500">P2: {result.timings.pass2Ms}ms</div>
                      )}
                    </td>
                    <td className="p-3">{getAccuracyIndicator(result)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredResults.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No results match the current filters.
          </div>
        )}

        {/* Rationale Modal/Popover could be added here */}
        {/* Error Details Modal could be added here */}
      </div>
    </Card>
  );
}
