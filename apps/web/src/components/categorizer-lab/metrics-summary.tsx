"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metrics } from "@/lib/categorizer-lab/types";
import {
  formatCategoryForDisplay,
  getCategoryTypeBadgeVariant,
  getParentCategoryName,
} from "@/lib/categorizer-lab/taxonomy-helpers";

interface MetricsSummaryProps {
  metrics: Metrics | null;
}

export function MetricsSummary({ metrics }: MetricsSummaryProps) {
  if (!metrics) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>Metrics will appear here after categorization is complete.</p>
        </div>
      </Card>
    );
  }

  const formatLatency = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics.totals.count}</div>
            <div className="text-sm text-gray-500">Total Transactions</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {metrics.totals.count - metrics.totals.errors}
            </div>
            <div className="text-sm text-gray-500">
              Successful (
              {formatPercentage(
                (metrics.totals.count - metrics.totals.errors) / metrics.totals.count
              )}
              )
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{metrics.totals.llmUsed}</div>
            <div className="text-sm text-gray-500">
              LLM Used ({formatPercentage(metrics.totals.llmUsed / metrics.totals.count)})
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{metrics.totals.errors}</div>
            <div className="text-sm text-gray-500">
              Errors ({formatPercentage(metrics.totals.errors / metrics.totals.count)})
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance</h3>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-xl font-semibold">{formatLatency(metrics.latency.mean)}</div>
            <div className="text-sm text-gray-500">Mean Latency</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{formatLatency(metrics.latency.p50)}</div>
            <div className="text-sm text-gray-500">P50 Latency</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{formatLatency(metrics.latency.p95)}</div>
            <div className="text-sm text-gray-500">P95 Latency</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{formatLatency(metrics.latency.p99)}</div>
            <div className="text-sm text-gray-500">P99 Latency</div>
          </div>
        </div>
      </Card>

      {/* Confidence Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Confidence Distribution</h3>
        <div className="space-y-4">
          <div>
            <div className="text-xl font-semibold">{formatPercentage(metrics.confidence.mean)}</div>
            <div className="text-sm text-gray-500">Mean Confidence</div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Distribution by Confidence Range:</div>
            <div className="grid grid-cols-5 gap-2">
              {metrics.confidence.histogram.map((bin) => (
                <div key={bin.bin} className="text-center">
                  <div className="text-sm font-medium">{bin.count}</div>
                  <div className="text-xs text-gray-500">{bin.bin}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Accuracy Metrics (if available) */}
      {metrics.accuracy && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Accuracy Analysis</h3>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-semibold text-green-600">
                {formatPercentage(metrics.accuracy.overall)}
              </div>
              <div className="text-sm text-gray-500">Overall Accuracy</div>
            </div>

            {metrics.accuracy.perCategory.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-3">Per-Category Performance:</div>
                <div className="space-y-4">
                  {(() => {
                    // Group categories by parent for better organization
                    const grouped = new Map<string, typeof metrics.accuracy.perCategory>();

                    metrics.accuracy.perCategory.forEach((cat) => {
                      const parentName = getParentCategoryName(cat.categoryId) || "Other";
                      if (!grouped.has(parentName)) {
                        grouped.set(parentName, []);
                      }
                      grouped.get(parentName)!.push(cat);
                    });

                    // Sort groups by total support and show top groups
                    const sortedGroups = Array.from(grouped.entries())
                      .map(([parentName, categories]) => ({
                        parentName,
                        categories: categories.sort((a, b) => b.support - a.support),
                        totalSupport: categories.reduce((sum, cat) => sum + cat.support, 0),
                      }))
                      .sort((a, b) => b.totalSupport - a.totalSupport)
                      .slice(0, 3); // Show top 3 parent categories

                    return sortedGroups.map(({ parentName, categories }) => (
                      <div key={parentName} className="space-y-2">
                        <div className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-1">
                          {parentName} ({categories.reduce((sum, cat) => sum + cat.support, 0)}{" "}
                          samples)
                        </div>
                        <div className="space-y-1 ml-4">
                          {categories.slice(0, 3).map(
                            (
                              cat // Show top 3 categories per parent
                            ) => (
                              <div
                                key={cat.categoryId}
                                className="flex items-center justify-between p-2 bg-gray-50 text-black rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={getCategoryTypeBadgeVariant(cat.categoryId)}
                                    className="text-xs"
                                  >
                                    {formatCategoryForDisplay(cat.categoryId, {
                                      format: "child-only",
                                    })}
                                  </Badge>
                                  <span className="text-sm text-gray-600">
                                    ({cat.support} samples)
                                  </span>
                                </div>
                                <div className="flex space-x-3 text-sm">
                                  <span>Acc: {formatPercentage(cat.accuracy)}</span>
                                  <span>P: {formatPercentage(cat.precision)}</span>
                                  <span>R: {formatPercentage(cat.recall)}</span>
                                  <span>F1: {formatPercentage(cat.f1)}</span>
                                </div>
                              </div>
                            )
                          )}
                          {categories.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
                              ... and {categories.length - 3} more categories in {parentName}
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                {metrics.accuracy.perCategory.length > 9 && (
                  <div className="text-sm text-gray-500 text-center mt-3 pt-3 border-t border-gray-200">
                    Showing top parent categories. Total: {metrics.accuracy.perCategory.length}{" "}
                    categories
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Cost Metrics (if available) */}
      {metrics.cost && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Cost Analysis</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-xl font-semibold text-orange-600">
                ${metrics.cost.estimatedUsd.toFixed(4)}
              </div>
              <div className="text-sm text-gray-500">Estimated Cost</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{metrics.cost.calls}</div>
              <div className="text-sm text-gray-500">LLM Calls</div>
            </div>
            <div>
              <div className="text-xl font-semibold">
                ${(metrics.cost.estimatedUsd / metrics.cost.calls).toFixed(4)}
              </div>
              <div className="text-sm text-gray-500">Cost per Call</div>
            </div>
          </div>
        </Card>
      )}

      {/* Engine Usage Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Engine Usage</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xl font-semibold text-blue-600">{metrics.totals.pass1Only}</div>
            <div className="text-sm text-gray-500">
              Pass-1 Only ({formatPercentage(metrics.totals.pass1Only / metrics.totals.count)})
            </div>
          </div>
          <div>
            <div className="text-xl font-semibold text-purple-600">{metrics.totals.llmUsed}</div>
            <div className="text-sm text-gray-500">
              LLM Used ({formatPercentage(metrics.totals.llmUsed / metrics.totals.count)})
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Insights */}
      <Card className="p-6 bg-blue-50 border-blue-200 text-black">
        <h3 className="text-lg font-semibold mb-3 text-blue-800">Key Insights</h3>
        <ul className="space-y-2 text-sm text-blue-700">
          <li>
            • <strong>Success Rate:</strong>{" "}
            {formatPercentage(
              (metrics.totals.count - metrics.totals.errors) / metrics.totals.count
            )}
            of transactions were successfully categorized
          </li>
          <li>
            • <strong>Engine Efficiency:</strong>{" "}
            {formatPercentage(metrics.totals.pass1Only / metrics.totals.count)}
            were handled by fast Pass-1 rules alone
          </li>
          <li>
            • <strong>Performance:</strong> Average {formatLatency(metrics.latency.mean)} per
            transaction (P95: {formatLatency(metrics.latency.p95)})
          </li>
          {metrics.accuracy && (
            <li>
              • <strong>Accuracy:</strong> {formatPercentage(metrics.accuracy.overall)} overall
              accuracy based on ground truth data
            </li>
          )}
          {metrics.cost && (
            <li>
              • <strong>Cost:</strong> ${metrics.cost.estimatedUsd.toFixed(4)} estimated for{" "}
              {metrics.cost.calls} LLM calls
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
