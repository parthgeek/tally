import { describe, test, expect } from "vitest";
import {
  mapLabTransactionToNormalized,
  mapLabTransactionsToNormalized,
  extractTimings,
  mapCategorizationResultToLab,
  validateUniqueIds,
  sanitizeDescription,
  extractVendorFromDescription,
  normalizeCurrency,
  validateAndNormalizeAmount,
  createDatasetSummary,
} from "./mappers";
import type { LabTransaction } from "./types";

describe("mapLabTransactionToNormalized", () => {
  test("maps lab transaction to normalized format", () => {
    const labTx: LabTransaction = {
      id: "tx-1",
      description: "STARBUCKS STORE #123",
      merchantName: "STARBUCKS",
      mcc: "5814",
      amountCents: "-500",
      date: "2024-01-15",
      currency: "USD",
      categoryId: "meals",
    };

    const normalized = mapLabTransactionToNormalized(labTx, "org-123");

    expect(normalized.id).toBe("tx-1");
    expect(normalized.orgId).toBe("org-123");
    expect(normalized.description).toBe("STARBUCKS STORE #123");
    expect(normalized.merchantName).toBe("STARBUCKS");
    expect(normalized.mcc).toBe("5814");
    expect(normalized.amountCents).toBe("-500");
    expect(normalized.date).toBe("2024-01-15");
    expect(normalized.currency).toBe("USD");
    expect(normalized.categoryId).toBe("meals");
    expect(normalized.source).toBe("manual");
    expect(normalized.reviewed).toBe(false);
    expect(normalized.needsReview).toBe(false);
    expect(normalized.raw).toEqual({
      labTransaction: labTx,
      source: "categorizer-lab",
    });
  });

  test("handles minimal lab transaction", () => {
    const labTx: LabTransaction = {
      id: "tx-1",
      description: "Simple transaction",
      amountCents: "-1000",
      currency: "USD",
    };

    const normalized = mapLabTransactionToNormalized(labTx, "org-123");

    expect(normalized.id).toBe("tx-1");
    expect(normalized.description).toBe("Simple transaction");
    expect(normalized.amountCents).toBe("-1000");
    expect(normalized.merchantName).toBeUndefined();
    expect(normalized.mcc).toBeUndefined();
    expect(normalized.categoryId).toBeUndefined();
    expect(normalized.currency).toBe("USD"); // Default
    expect(normalized.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Today's date
  });
});

describe("mapLabTransactionsToNormalized", () => {
  test("maps array of lab transactions", () => {
    const labTxs: LabTransaction[] = [
      { id: "tx-1", description: "Test 1", amountCents: "-100", currency: "USD" },
      { id: "tx-2", description: "Test 2", amountCents: "-200", currency: "USD" },
    ];

    const normalized = mapLabTransactionsToNormalized(labTxs, "org-123");

    expect(normalized).toHaveLength(2);
    expect(normalized[0]!.id).toBe("tx-1");
    expect(normalized[1]!.id).toBe("tx-2");
    expect(normalized[0]!.orgId).toBe("org-123");
    expect(normalized[1]!.orgId).toBe("org-123");
  });
});

describe("extractTimings", () => {
  test("calculates total timing correctly", () => {
    const startTime = Date.now() - 1000; // 1 second ago
    const timings = extractTimings(startTime, 500, 300);

    expect(timings.totalMs).toBeGreaterThanOrEqual(1000);
    expect(timings.totalMs).toBeLessThan(1100); // Allow some variance
    expect(timings.pass1Ms).toBe(500);
    expect(timings.pass2Ms).toBe(300);
  });

  test("handles undefined timing values", () => {
    const startTime = Date.now() - 500;
    const timings = extractTimings(startTime);

    expect(timings.totalMs).toBeGreaterThanOrEqual(500);
    expect(timings.pass1Ms).toBeUndefined();
    expect(timings.pass2Ms).toBeUndefined();
  });
});

describe("mapCategorizationResultToLab", () => {
  test("maps complete categorization result", () => {
    const result = {
      categoryId: "meals",
      confidence: 0.85,
      rationale: ["MCC matches restaurant", "Vendor pattern recognized"],
    };

    const labResult = mapCategorizationResultToLab("tx-1", result, "llm", {
      totalMs: 1500,
      pass1Ms: 200,
      pass2Ms: 1300,
    });

    expect(labResult.id).toBe("tx-1");
    expect(labResult.predictedCategoryId).toBe("meals");
    expect(labResult.confidence).toBe(0.85);
    expect(labResult.rationale).toEqual(["MCC matches restaurant", "Vendor pattern recognized"]);
    expect(labResult.engine).toBe("llm");
    expect(labResult.timings.totalMs).toBe(1500);
    expect(labResult.error).toBeUndefined();
  });

  test("maps error result", () => {
    const labResult = mapCategorizationResultToLab(
      "tx-1",
      {},
      "pass1",
      { totalMs: 100 },
      "API timeout"
    );

    expect(labResult.id).toBe("tx-1");
    expect(labResult.predictedCategoryId).toBeUndefined();
    expect(labResult.confidence).toBeUndefined();
    expect(labResult.rationale).toEqual([]);
    expect(labResult.error).toBe("API timeout");
  });
});

describe("validateUniqueIds", () => {
  test("passes validation for unique IDs", () => {
    const transactions: LabTransaction[] = [
      { id: "tx-1", description: "Test 1", amountCents: "-100", currency: "USD" },
      { id: "tx-2", description: "Test 2", amountCents: "-200", currency: "USD" },
    ];

    expect(() => validateUniqueIds(transactions)).not.toThrow();
  });

  test("throws error for duplicate IDs", () => {
    const transactions: LabTransaction[] = [
      { id: "tx-1", description: "Test 1", amountCents: "-100", currency: "USD" },
      { id: "tx-1", description: "Test 2", amountCents: "-200", currency: "USD" },
    ];

    expect(() => validateUniqueIds(transactions)).toThrow("Duplicate transaction IDs found: tx-1");
  });
});

describe("sanitizeDescription", () => {
  test("normalizes whitespace and casing", () => {
    expect(sanitizeDescription("  starbucks  store  #123  ")).toBe("STARBUCKS STORE #123");
    expect(sanitizeDescription("Multiple   spaces")).toBe("MULTIPLE SPACES");
    expect(sanitizeDescription("mixed Case TEXT")).toBe("MIXED CASE TEXT");
  });

  test("handles empty and whitespace strings", () => {
    expect(sanitizeDescription("")).toBe("");
    expect(sanitizeDescription("   ")).toBe("");
  });
});

describe("extractVendorFromDescription", () => {
  test("extracts vendor from common patterns", () => {
    expect(extractVendorFromDescription("STARBUCKS STORE #12345")).toBe("STARBUCKS STORE");
    expect(extractVendorFromDescription("AMAZON.COM AMZN.COM/BILL")).toBe("AMAZON.COM");
    expect(extractVendorFromDescription("TARGET STORE T-1234")).toBe("TARGET STORE");
  });

  test("extracts vendor with state codes", () => {
    expect(extractVendorFromDescription("SHELL OIL CA")).toBe("SHELL OIL");
    expect(extractVendorFromDescription("WALMART SUPERCENTER TX")).toBe("WALMART SUPERCENTER");
  });

  test("handles short descriptions", () => {
    expect(extractVendorFromDescription("COFFEE")).toBe("COFFEE");
    expect(extractVendorFromDescription("ATM WITHDRAWAL")).toBe("ATM WITHDRAWAL");
  });

  test("returns undefined for unclear patterns", () => {
    expect(extractVendorFromDescription("PAYMENT THANK YOU")).toBeUndefined();
    expect(extractVendorFromDescription("XX")).toBeUndefined();
    expect(extractVendorFromDescription("")).toBeUndefined();
  });
});

describe("normalizeCurrency", () => {
  test("normalizes common currency formats", () => {
    expect(normalizeCurrency("usd")).toBe("USD");
    expect(normalizeCurrency("US")).toBe("USD");
    expect(normalizeCurrency("dollar")).toBe("USD");
    expect(normalizeCurrency("$")).toBe("USD");
    expect(normalizeCurrency("EUR")).toBe("EUR");
  });

  test("defaults to USD for undefined input", () => {
    expect(normalizeCurrency()).toBe("USD");
    expect(normalizeCurrency("")).toBe("USD");
  });
});

describe("validateAndNormalizeAmount", () => {
  test("converts dollar amounts to cents", () => {
    expect(validateAndNormalizeAmount("123.45")).toBe("12345");
    expect(validateAndNormalizeAmount("0.50")).toBe("50");
    expect(validateAndNormalizeAmount("-123.45")).toBe("-12345");
  });

  test("handles whole dollar amounts", () => {
    expect(validateAndNormalizeAmount("123")).toBe("12300");
    expect(validateAndNormalizeAmount("-50")).toBe("-5000");
  });

  test("handles numeric input", () => {
    expect(validateAndNormalizeAmount(123.45)).toBe("12345");
    expect(validateAndNormalizeAmount(-50)).toBe("-5000");
  });

  test("removes currency symbols", () => {
    expect(validateAndNormalizeAmount("$123.45")).toBe("12345");
    expect(validateAndNormalizeAmount("$1,234.56")).toBe("123456");
  });

  test("throws error for invalid amounts", () => {
    expect(() => validateAndNormalizeAmount("invalid")).toThrow("Invalid amount");
    expect(() => validateAndNormalizeAmount("$abc")).toThrow("Invalid amount");
  });
});

describe("createDatasetSummary", () => {
  test("creates comprehensive dataset summary", () => {
    const transactions: LabTransaction[] = [
      {
        id: "tx-1",
        description: "Starbucks",
        merchantName: "STARBUCKS",
        mcc: "5814",
        amountCents: "-500",
        date: "2024-01-15",
        currency: "USD",
        categoryId: "meals",
      },
      {
        id: "tx-2",
        description: "Electric Bill",
        merchantName: "ELECTRIC CO",
        mcc: "4900",
        amountCents: "-15000",
        date: "2024-01-01",
        currency: "USD",
        categoryId: "utilities",
      },
      {
        id: "tx-3",
        description: "Cash Deposit",
        amountCents: "10000",
        date: "2024-01-10",
        currency: "USD",
      },
    ];

    const summary = createDatasetSummary(transactions);

    expect(summary.count).toBe(3);
    expect(summary.dateRange.earliest).toBe("2024-01-01");
    expect(summary.dateRange.latest).toBe("2024-01-15");
    expect(summary.amountRange.min).toBe(-15000);
    expect(summary.amountRange.max).toBe(10000);
    expect(summary.currencies).toEqual(["USD"]);
    expect(summary.hasMCC).toBe(2);
    expect(summary.hasGroundTruth).toBe(2);
    expect(summary.uniqueVendors).toBe(2);
    expect(summary.coverage.mccPercent).toBeCloseTo(66.67);
    expect(summary.coverage.groundTruthPercent).toBeCloseTo(66.67);
  });

  test("handles empty dataset", () => {
    const summary = createDatasetSummary([]);

    expect(summary.count).toBe(0);
    expect(summary.dateRange.earliest).toBeNull();
    expect(summary.dateRange.latest).toBeNull();
    expect(summary.amountRange.min).toBe(Infinity);
    expect(summary.amountRange.max).toBe(-Infinity);
    expect(summary.currencies).toEqual([]);
    expect(summary.uniqueVendors).toBe(0);
  });

  test("handles transactions with missing optional fields", () => {
    const transactions: LabTransaction[] = [
      { id: "tx-1", description: "Simple transaction", amountCents: "-1000", currency: "USD" },
      { id: "tx-2", description: "Another transaction", amountCents: "500", currency: "USD" },
    ];

    const summary = createDatasetSummary(transactions);

    expect(summary.count).toBe(2);
    expect(summary.hasMCC).toBe(0);
    expect(summary.hasGroundTruth).toBe(0);
    expect(summary.uniqueVendors).toBe(0);
    expect(summary.currencies).toEqual(["USD"]); // Default currency
  });
});
