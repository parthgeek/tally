import { describe, test, expect } from "vitest";
import { calculateMetrics, calculateCalibration, exportMetricsAsCSV } from "./metrics";
import type { LabTransaction, TransactionResult } from "./types";

describe("calculateMetrics", () => {
  const createTransaction = (id: string, categoryId?: string): LabTransaction => ({
    id,
    description: `Transaction ${id}`,
    amountCents: "-1000",
    currency: "USD",
    categoryId,
  });

  const createResult = (
    id: string,
    predictedCategoryId?: string,
    confidence?: number,
    engine: "pass1" | "llm" = "pass1",
    totalMs = 100,
    error?: string
  ): TransactionResult => ({
    id,
    predictedCategoryId,
    confidence,
    rationale: [],
    engine,
    timings: { totalMs },
    error,
  });

  test("calculates basic totals correctly", () => {
    const transactions = [
      createTransaction("tx-1"),
      createTransaction("tx-2"),
      createTransaction("tx-3"),
    ];

    const results = [
      createResult("tx-1", "cat-1", 0.9, "pass1"),
      createResult("tx-2", "cat-2", 0.8, "llm"),
      createResult("tx-3", undefined, undefined, "pass1", 100, "Error occurred"),
    ];

    const metrics = calculateMetrics(transactions, results);

    expect(metrics.totals.count).toBe(3);
    expect(metrics.totals.pass1Only).toBe(2);
    expect(metrics.totals.llmUsed).toBe(1);
    expect(metrics.totals.errors).toBe(1);
  });

  test("calculates latency statistics", () => {
    const transactions = [
      createTransaction("tx-1"),
      createTransaction("tx-2"),
      createTransaction("tx-3"),
    ];
    const results = [
      createResult("tx-1", "cat-1", 0.9, "pass1", 50),
      createResult("tx-2", "cat-2", 0.8, "pass1", 100),
      createResult("tx-3", "cat-3", 0.7, "pass1", 150),
    ];

    const metrics = calculateMetrics(transactions, results);

    expect(metrics.latency.mean).toBe(100);
    expect(metrics.latency.p50).toBe(100);
    expect(metrics.latency.p95).toBeCloseTo(150);
    expect(metrics.latency.p99).toBeCloseTo(150);
  });

  test("calculates confidence statistics", () => {
    const transactions = [
      createTransaction("tx-1"),
      createTransaction("tx-2"),
      createTransaction("tx-3"),
    ];
    const results = [
      createResult("tx-1", "cat-1", 0.9),
      createResult("tx-2", "cat-2", 0.5),
      createResult("tx-3", "cat-3", 0.1),
    ];

    const metrics = calculateMetrics(transactions, results);

    expect(metrics.confidence.mean).toBeCloseTo(0.5);
    expect(metrics.confidence.histogram).toHaveLength(10);

    // Check histogram bins
    const firstBin = metrics.confidence.histogram.find((h) => h.bin === "0.0-0.1");
    const middleBin = metrics.confidence.histogram.find((h) => h.bin === "0.5-0.6");
    const lastBin = metrics.confidence.histogram.find((h) => h.bin === "0.9-1.0");

    expect(firstBin?.count).toBe(1);
    expect(middleBin?.count).toBe(1);
    expect(lastBin?.count).toBe(1);
  });

  test("calculates accuracy when ground truth is available", () => {
    const transactions = [
      createTransaction("tx-1", "cat-1"),
      createTransaction("tx-2", "cat-2"),
      createTransaction("tx-3", "cat-1"),
      createTransaction("tx-4"), // No ground truth
    ];

    const results = [
      createResult("tx-1", "cat-1", 0.9), // Correct
      createResult("tx-2", "cat-1", 0.8), // Wrong
      createResult("tx-3", "cat-1", 0.7), // Correct
      createResult("tx-4", "cat-3", 0.6), // No ground truth
    ];

    const metrics = calculateMetrics(transactions, results);

    expect(metrics.accuracy).toBeDefined();
    expect(metrics.accuracy!.overall).toBeCloseTo(2 / 3); // 2 correct out of 3 with ground truth
    expect(metrics.accuracy!.categoryLabels).toEqual(["cat-1", "cat-2"]);
    expect(metrics.accuracy!.perCategory).toHaveLength(2);

    const cat1Metrics = metrics.accuracy!.perCategory.find((c) => c.categoryId === "cat-1");
    expect(cat1Metrics?.support).toBe(2); // Two ground truth examples
    expect(cat1Metrics?.accuracy).toBe(1); // Both predicted correctly
  });

  test("returns undefined accuracy when no ground truth available", () => {
    const transactions = [createTransaction("tx-1"), createTransaction("tx-2")];
    const results = [createResult("tx-1", "cat-1", 0.9), createResult("tx-2", "cat-2", 0.8)];

    const metrics = calculateMetrics(transactions, results);

    expect(metrics.accuracy).toBeUndefined();
  });

  test("handles empty results", () => {
    const transactions = [createTransaction("tx-1")];
    const results: TransactionResult[] = [];

    const metrics = calculateMetrics(transactions, results);

    expect(metrics.totals.count).toBe(0);
    expect(metrics.latency.mean).toBe(0);
    expect(metrics.confidence.mean).toBe(0);
    expect(metrics.accuracy).toBeUndefined();
  });
});

describe("calculateCalibration", () => {
  test("calculates calibration bins correctly", () => {
    const transactions = [
      {
        id: "tx-1",
        description: "Test",
        amountCents: "-100",
        currency: "USD",
        categoryId: "cat-1",
      },
      {
        id: "tx-2",
        description: "Test",
        amountCents: "-100",
        currency: "USD",
        categoryId: "cat-2",
      },
      {
        id: "tx-3",
        description: "Test",
        amountCents: "-100",
        currency: "USD",
        categoryId: "cat-1",
      },
      {
        id: "tx-4",
        description: "Test",
        amountCents: "-100",
        currency: "USD",
        categoryId: "cat-1",
      },
    ];

    const results = [
      {
        id: "tx-1",
        predictedCategoryId: "cat-1",
        confidence: 0.9,
        rationale: [],
        engine: "pass1" as const,
        timings: { totalMs: 100 },
      },
      {
        id: "tx-2",
        predictedCategoryId: "cat-1",
        confidence: 0.9,
        rationale: [],
        engine: "pass1" as const,
        timings: { totalMs: 100 },
      }, // Wrong prediction
      {
        id: "tx-3",
        predictedCategoryId: "cat-1",
        confidence: 0.5,
        rationale: [],
        engine: "pass1" as const,
        timings: { totalMs: 100 },
      },
      {
        id: "tx-4",
        predictedCategoryId: "cat-2",
        confidence: 0.5,
        rationale: [],
        engine: "pass1" as const,
        timings: { totalMs: 100 },
      }, // Wrong prediction
    ];

    const calibration = calculateCalibration(transactions, results);

    expect(calibration).toHaveLength(2); // Two bins with data

    const highConfidenceBin = calibration.find((c) => c.confidenceBin === "0.9-1.0");
    const midConfidenceBin = calibration.find((c) => c.confidenceBin === "0.5-0.6");

    expect(highConfidenceBin?.count).toBe(2);
    expect(highConfidenceBin?.accuracy).toBe(0.5); // 1 correct out of 2

    expect(midConfidenceBin?.count).toBe(2);
    expect(midConfidenceBin?.accuracy).toBe(0.5); // 1 correct out of 2
  });

  test("returns empty array when no ground truth available", () => {
    const transactions = [
      { id: "tx-1", description: "Test", amountCents: "-100", currency: "USD" },
    ];
    const results = [
      {
        id: "tx-1",
        predictedCategoryId: "cat-1",
        confidence: 0.9,
        rationale: [],
        engine: "pass1" as const,
        timings: { totalMs: 100 },
      },
    ];

    const calibration = calculateCalibration(transactions, results);

    expect(calibration).toEqual([]);
  });
});

describe("exportMetricsAsCSV", () => {
  test("exports complete metrics to CSV format", () => {
    const metrics = {
      totals: { count: 100, errors: 5, pass1Only: 70, llmUsed: 25 },
      latency: { p50: 50, p95: 200, p99: 500, mean: 75 },
      confidence: {
        mean: 0.75,
        histogram: [
          { bin: "0.0-0.1", count: 5 },
          { bin: "0.7-0.8", count: 30 },
        ],
      },
      accuracy: {
        overall: 0.85,
        perCategory: [
          {
            categoryId: "cat-1",
            accuracy: 0.9,
            precision: 0.85,
            recall: 0.95,
            f1: 0.9,
            support: 50,
          },
          {
            categoryId: "cat-2",
            accuracy: 0.8,
            precision: 0.75,
            recall: 0.85,
            f1: 0.8,
            support: 30,
          },
        ],
        confusionMatrix: [
          [45, 5],
          [6, 24],
        ],
        categoryLabels: ["cat-1", "cat-2"],
      },
      cost: { estimatedUsd: 0.025, calls: 25 },
    };

    const csv = exportMetricsAsCSV(metrics);

    expect(csv).toContain("Total Transactions,100");
    expect(csv).toContain("Errors,5");
    expect(csv).toContain("Overall Accuracy,0.850");
    expect(csv).toContain("Estimated Cost (USD),0.0250");
    expect(csv).toContain("Category,Accuracy,Precision,Recall,F1,Support");
    expect(csv).toContain("cat-1,0.900,0.850,0.950,0.900,50");
  });

  test("exports metrics without accuracy section", () => {
    const metrics = {
      totals: { count: 50, errors: 0, pass1Only: 50, llmUsed: 0 },
      latency: { p50: 25, p95: 100, p99: 150, mean: 40 },
      confidence: { mean: 0.9, histogram: [] },
    };

    const csv = exportMetricsAsCSV(metrics);

    expect(csv).toContain("Total Transactions,50");
    expect(csv).toContain("Mean Confidence,0.900");
    expect(csv).not.toContain("Overall Accuracy");
  });
});
