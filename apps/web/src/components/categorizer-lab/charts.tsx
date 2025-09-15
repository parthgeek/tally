'use client';

import { Card } from '@/components/ui/card';
import type { Metrics } from '@/lib/categorizer-lab/types';

interface ChartsProps {
  metrics: Metrics | null;
}

export function Charts({ metrics }: ChartsProps) {
  if (!metrics) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>Charts will appear here after categorization is complete.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Confidence Histogram */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Confidence Distribution</h3>

        {/* Summary stats */}
        <div className="mb-6 grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">
              {metrics.confidence.mean ? (metrics.confidence.mean * 100).toFixed(1) : '—'}%
            </div>
            <div className="text-sm text-gray-600">Average</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">
              {getP95FromHistogram(metrics.confidence.histogram).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">95th Percentile</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-600">
              {getConfidenceSpread(metrics.confidence.histogram)}%
            </div>
            <div className="text-sm text-gray-600">Spread</div>
          </div>
        </div>

        <div className="space-y-2">
          {metrics.confidence.histogram.map((bin, index) => {
            const maxCount = Math.max(...metrics.confidence.histogram.map(b => b.count));
            const widthPercent = maxCount > 0 ? (bin.count / maxCount) * 100 : 0;
            const isLowConfidence = bin.bin.includes('0.') && bin.bin < '0.5';
            const isHighConfidence = bin.bin.includes('0.9') || bin.bin.includes('1.0');

            return (
              <div key={bin.bin} className="flex items-center space-x-3">
                <div className="w-20 text-sm text-gray-600 font-mono text-right">
                  {bin.bin}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                  <div
                    className={`h-6 rounded-full flex items-center justify-end pr-2 ${
                      isLowConfidence ? 'bg-red-400' :
                      isHighConfidence ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  >
                    {bin.count > 0 && (
                      <span className="text-white text-xs font-medium">{bin.count}</span>
                    )}
                  </div>
                </div>
                <div className="w-12 text-xs text-gray-500">
                  {maxCount > 0 ? ((bin.count / maxCount) * 100).toFixed(0) : 0}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Confidence quality indicator */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            Quality: {getConfidenceQuality(metrics.confidence.histogram)}
          </div>
        </div>
      </Card>

      {/* Engine Usage Pie Chart (Simple) */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Engine Usage</h3>
        <div className="flex items-center justify-center space-x-8">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white font-semibold">{metrics.totals.pass1Only}</span>
            </div>
            <div className="text-sm text-gray-600 mt-2">Pass-1 Only</div>
          </div>
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-purple-500 flex items-center justify-center">
              <span className="text-white font-semibold">{metrics.totals.llmUsed}</span>
            </div>
            <div className="text-sm text-gray-600 mt-2">LLM Used</div>
          </div>
          {metrics.totals.errors > 0 && (
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white font-semibold">{metrics.totals.errors}</span>
              </div>
              <div className="text-sm text-gray-600 mt-2">Errors</div>
            </div>
          )}
        </div>
      </Card>

      {/* Latency Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Latency Analysis</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {metrics.latency.mean.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-500">Mean</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">
                {metrics.latency.p50.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-500">P50</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-orange-600">
                {metrics.latency.p95.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-500">P95</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-600">
                {metrics.latency.p99.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-500">P99</div>
            </div>
          </div>
          
          {/* Simple latency visualization */}
          <div className="mt-6">
            <div className="flex items-end justify-center space-x-2 h-24">
              {[
                { label: 'Mean', value: metrics.latency.mean, color: 'bg-blue-500' },
                { label: 'P50', value: metrics.latency.p50, color: 'bg-green-500' },
                { label: 'P95', value: metrics.latency.p95, color: 'bg-orange-500' },
                { label: 'P99', value: metrics.latency.p99, color: 'bg-red-500' },
              ].map((item) => {
                const maxValue = Math.max(
                  metrics.latency.mean,
                  metrics.latency.p50,
                  metrics.latency.p95,
                  metrics.latency.p99
                );
                const heightPercent = (item.value / maxValue) * 100;
                
                return (
                  <div key={item.label} className="flex flex-col items-center">
                    <div 
                      className={`w-12 ${item.color} rounded-t`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <div className="text-xs text-gray-600 mt-1">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Confusion Matrix (if accuracy data available) */}
      {metrics.accuracy && metrics.accuracy.confusionMatrix.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Confusion Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  <th className="p-2 text-center" colSpan={metrics.accuracy.categoryLabels.length}>
                    Predicted
                  </th>
                </tr>
                <tr>
                  <th className="p-2"></th>
                  {metrics.accuracy.categoryLabels.map((label) => (
                    <th key={label} className="p-2 text-xs transform -rotate-45 text-center">
                      {label.slice(0, 8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.accuracy.confusionMatrix.map((row, i) => (
                  <tr key={i}>
                    <th className="p-2 text-xs">
                      {i === Math.floor(metrics.accuracy!.categoryLabels.length / 2) && (
                        <div className="transform -rotate-90 whitespace-nowrap">Actual</div>
                      )}
                      <div>{metrics.accuracy!.categoryLabels[i]?.slice(0, 8)}</div>
                    </th>
                    {row.map((count, j) => {
                      const maxCount = Math.max(...metrics.accuracy!.confusionMatrix.flat());
                      const intensity = maxCount > 0 ? count / maxCount : 0;
                      const isCorrect = i === j;
                      
                      return (
                        <td 
                          key={j} 
                          className={`p-2 text-center text-xs ${
                            isCorrect ? 'bg-green-100' : 'bg-red-50'
                          }`}
                          style={{
                            backgroundColor: isCorrect 
                              ? `rgba(34, 197, 94, ${0.1 + intensity * 0.9})`
                              : `rgba(239, 68, 68, ${intensity * 0.3})`
                          }}
                        >
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Green diagonal = correct predictions, Red off-diagonal = misclassifications
          </div>
        </Card>
      )}

      {/* Notes about charts */}
      <Card className="p-4 bg-gray-50 text-black">
        <div className="text-sm text-gray-600">
          <p><strong>Note:</strong> These are simplified visualizations for the lab environment.
          In a production dashboard, you would typically use a charting library like Chart.js,
          D3.js, or Recharts for more sophisticated visualizations.</p>
        </div>
      </Card>
    </div>
  );
}

/**
 * Calculate 95th percentile from confidence histogram
 */
function getP95FromHistogram(histogram: Array<{ bin: string; count: number }>): number {
  const totalCount = histogram.reduce((sum, h) => sum + h.count, 0);
  if (totalCount === 0) return 0;

  const p95Target = totalCount * 0.95;
  let cumulativeCount = 0;

  // Sort histogram by bin value
  const sortedHistogram = histogram
    .map(h => ({ ...h, binValue: parseFloat(h.bin) }))
    .sort((a, b) => a.binValue - b.binValue);

  for (const bin of sortedHistogram) {
    cumulativeCount += bin.count;
    if (cumulativeCount >= p95Target) {
      return bin.binValue * 100;
    }
  }

  return 0;
}

/**
 * Calculate confidence spread (difference between highest and lowest bins with data)
 */
function getConfidenceSpread(histogram: Array<{ bin: string; count: number }>): number {
  const binsWithData = histogram.filter(h => h.count > 0);
  if (binsWithData.length === 0) return 0;

  const binValues = binsWithData.map(h => parseFloat(h.bin));
  const min = Math.min(...binValues);
  const max = Math.max(...binValues);

  return Math.round((max - min) * 100);
}

/**
 * Assess confidence distribution quality
 */
function getConfidenceQuality(histogram: Array<{ bin: string; count: number }>): string {
  const totalTransactions = histogram.reduce((sum, h) => sum + h.count, 0);
  if (totalTransactions === 0) return 'No data';

  // Count high confidence transactions (>= 0.8)
  const highConfidenceCount = histogram
    .filter(h => parseFloat(h.bin) >= 0.8)
    .reduce((sum, h) => sum + h.count, 0);

  // Count medium confidence transactions (0.5 - 0.8)
  const mediumConfidenceCount = histogram
    .filter(h => parseFloat(h.bin) >= 0.5 && parseFloat(h.bin) < 0.8)
    .reduce((sum, h) => sum + h.count, 0);

  // Count low confidence transactions (< 0.5)
  const lowConfidenceCount = histogram
    .filter(h => parseFloat(h.bin) < 0.5)
    .reduce((sum, h) => sum + h.count, 0);

  const highPct = (highConfidenceCount / totalTransactions) * 100;
  const lowPct = (lowConfidenceCount / totalTransactions) * 100;

  // Check for uniform distribution (all in one bucket)
  const maxBinCount = Math.max(...histogram.map(h => h.count));
  const isUniform = (maxBinCount / totalTransactions) > 0.8;

  if (isUniform) {
    return '⚠️ Too uniform - lacks confidence variance';
  } else if (highPct >= 60) {
    return `✅ Excellent (${highPct.toFixed(0)}% high confidence)`;
  } else if (highPct >= 40) {
    return `👍 Good (${highPct.toFixed(0)}% high confidence)`;
  } else if (lowPct >= 30) {
    return `⚠️ Poor (${lowPct.toFixed(0)}% low confidence)`;
  } else {
    return `📊 Mixed distribution`;
  }
}