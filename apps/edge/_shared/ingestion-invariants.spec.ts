import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  detectDuplicates,
  validateAmountSign,
  validateCurrencyCode,
  validateDateFormat,
  validateIntegerCentsConversion,
  validateNormalizedTransaction,
  validatePartialRefund,
  validatePayoutReconciliation,
  validateRequiredFields,
} from "./ingestion-invariants.ts";

// Helper to match expect API
const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => assertEquals(actual, expected),
  toEqual: (expected: unknown) => assertEquals(actual, expected),
  toContain: (expected: string) => {
    if (typeof actual !== "string") {
      throw new Error("toContain requires string");
    }
    if (!actual.includes(expected)) {
      throw new Error(`Expected "${actual}" to contain "${expected}"`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if (typeof actual !== "number") {
      throw new Error("toBeGreaterThan requires number");
    }
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
});

// Rename test to it
const test = it;

describe("Ingestion Invariants", () => {
  describe("validateIntegerCentsConversion", () => {
    test("validates correct conversion from dollars to cents", () => {
      const result = validateIntegerCentsConversion(42.50, "4250");
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("validates conversion for negative dollar amounts", () => {
      const result = validateIntegerCentsConversion(-10.99, "1099");
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("validates conversion for zero", () => {
      const result = validateIntegerCentsConversion(0, "0");
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("validates conversion with rounding", () => {
      // 10.999 should round to 11.00
      const result = validateIntegerCentsConversion(10.999, "1100");
      expect(result.valid).toBe(true);
    });

    test("detects precision loss", () => {
      const result = validateIntegerCentsConversion(42.50, "4249");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("mismatch");
    });

    test("detects invalid cents string", () => {
      const result = validateIntegerCentsConversion(42.50, "invalid");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid cents string");
    });

    test("detects overflow beyond MAX_SAFE_INTEGER", () => {
      const overflow = Number.MAX_SAFE_INTEGER + 1;
      const result = validateIntegerCentsConversion(
        overflow / 100,
        overflow.toString(),
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("MAX_SAFE_INTEGER");
    });
  });

  describe("validateAmountSign", () => {
    test("validates positive amounts (absolute value)", () => {
      const result = validateAmountSign(42.50, "4250");
      expect(result.valid).toBe(true);
    });

    test("validates negative amounts (absolute value)", () => {
      const result = validateAmountSign(-42.50, "4250");
      expect(result.valid).toBe(true);
    });

    test("rejects negative cents string", () => {
      const result = validateAmountSign(-42.50, "-4250");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("absolute value");
    });
  });

  describe("validateCurrencyCode", () => {
    test("validates supported currency codes", () => {
      const currencies = ["USD", "CAD", "EUR", "GBP", "AUD", "JPY"];
      for (const currency of currencies) {
        const result = validateCurrencyCode(currency);
        expect(result.valid).toBe(true);
      }
    });

    test("rejects unsupported currency codes", () => {
      const result = validateCurrencyCode("XXX");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid or unsupported");
    });

    test("rejects lowercase currency codes", () => {
      const result = validateCurrencyCode("usd");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateDateFormat", () => {
    test("validates correct date format", () => {
      const result = validateDateFormat("2024-01-15");
      expect(result.valid).toBe(true);
    });

    test("rejects invalid date format", () => {
      const result = validateDateFormat("01/15/2024");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid date format");
    });

    test("rejects invalid date values", () => {
      const result = validateDateFormat("2024-13-01");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid date value");
    });

    test("rejects future dates", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split("T")[0];

      const result = validateDateFormat(dateStr);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("future");
    });

    test("rejects dates older than 10 years", () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 11);
      const dateStr = oldDate.toISOString().split("T")[0];

      const result = validateDateFormat(dateStr);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("older than 10 years");
    });

    test("accepts today's date", () => {
      const today = new Date().toISOString().split("T")[0];
      const result = validateDateFormat(today);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateRequiredFields", () => {
    test("validates all required fields present", () => {
      const transaction = {
        provider_tx_id: "plaid-123",
        date: "2024-01-15",
        amount_cents: "1000",
        description: "Coffee shop",
        org_id: "org-123",
        account_id: "acc-123",
      };
      const result = validateRequiredFields(transaction);
      expect(result.valid).toBe(true);
    });

    test("detects missing provider_tx_id", () => {
      const transaction = {
        date: "2024-01-15",
        amount_cents: "1000",
        description: "Coffee shop",
        org_id: "org-123",
        account_id: "acc-123",
      };
      const result = validateRequiredFields(transaction);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("provider_tx_id");
    });

    test("detects empty string fields", () => {
      const transaction = {
        provider_tx_id: "",
        date: "2024-01-15",
        amount_cents: "1000",
        description: "Coffee shop",
        org_id: "org-123",
        account_id: "acc-123",
      };
      const result = validateRequiredFields(transaction);
      expect(result.valid).toBe(false);
    });

    test("detects whitespace-only fields", () => {
      const transaction = {
        provider_tx_id: "   ",
        date: "2024-01-15",
        amount_cents: "1000",
        description: "Coffee shop",
        org_id: "org-123",
        account_id: "acc-123",
      };
      const result = validateRequiredFields(transaction);
      expect(result.valid).toBe(false);
    });

    test("detects multiple missing fields", () => {
      const transaction = {
        provider_tx_id: "plaid-123",
      };
      const result = validateRequiredFields(transaction);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("detectDuplicates", () => {
    test("detects no duplicates in unique transactions", () => {
      const transactions = [
        { org_id: "org-1", provider_tx_id: "tx-1" },
        { org_id: "org-1", provider_tx_id: "tx-2" },
        { org_id: "org-2", provider_tx_id: "tx-1" }, // Different org, ok
      ];
      const result = detectDuplicates(transactions);
      expect(result.valid).toBe(true);
    });

    test("detects duplicate within same org", () => {
      const transactions = [
        { org_id: "org-1", provider_tx_id: "tx-1" },
        { org_id: "org-1", provider_tx_id: "tx-1" }, // Duplicate
      ];
      const result = detectDuplicates(transactions);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Duplicate transactions");
    });

    test("detects multiple duplicates", () => {
      const transactions = [
        { org_id: "org-1", provider_tx_id: "tx-1" },
        { org_id: "org-1", provider_tx_id: "tx-1" },
        { org_id: "org-1", provider_tx_id: "tx-2" },
        { org_id: "org-1", provider_tx_id: "tx-2" },
      ];
      const result = detectDuplicates(transactions);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("org-1:tx-1");
      expect(result.errors[0]).toContain("org-1:tx-2");
    });

    test("reports occurrence count", () => {
      const transactions = [
        { org_id: "org-1", provider_tx_id: "tx-1" },
        { org_id: "org-1", provider_tx_id: "tx-1" },
        { org_id: "org-1", provider_tx_id: "tx-1" },
      ];
      const result = detectDuplicates(transactions);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("(3 occurrences)");
    });
  });

  describe("validatePayoutReconciliation", () => {
    test("validates reconciled payout (exact match)", () => {
      const payout = {
        amount_cents: "10000",
        description: "Shopify Payout",
      };
      const constituents = [
        { amount_cents: "9500", description: "Sales" },
        { amount_cents: "500", description: "Fees" },
      ];
      const result = validatePayoutReconciliation(payout, constituents);
      expect(result.reconciled).toBe(true);
      expect(result.difference).toBe(0);
    });

    test("allows small rounding differences", () => {
      const payout = {
        amount_cents: "10000",
        description: "Shopify Payout",
      };
      const constituents = [
        { amount_cents: "9999", description: "Sales" }, // 1 cent off
      ];
      const result = validatePayoutReconciliation(payout, constituents);
      expect(result.reconciled).toBe(true);
      expect(result.difference).toBe(1);
    });

    test("detects significant reconciliation errors", () => {
      const payout = {
        amount_cents: "10000",
        description: "Shopify Payout",
      };
      const constituents = [
        { amount_cents: "9000", description: "Sales" },
      ];
      const result = validatePayoutReconciliation(payout, constituents);
      expect(result.reconciled).toBe(false);
      expect(result.difference).toBe(1000);
      expect(result.errors[0]).toContain("reconciliation failed");
    });

    test("handles invalid payout amount", () => {
      const payout = {
        amount_cents: "invalid",
        description: "Shopify Payout",
      };
      const constituents = [
        { amount_cents: "10000", description: "Sales" },
      ];
      const result = validatePayoutReconciliation(payout, constituents);
      expect(result.reconciled).toBe(false);
      expect(result.errors[0]).toContain("Invalid payout amount");
    });

    test("handles invalid constituent amounts", () => {
      const payout = {
        amount_cents: "10000",
        description: "Shopify Payout",
      };
      const constituents = [
        { amount_cents: "invalid", description: "Sales" },
      ];
      const result = validatePayoutReconciliation(payout, constituents);
      expect(result.errors[0]).toContain("Invalid transaction amount");
    });
  });

  describe("validatePartialRefund", () => {
    test("validates refund within original amount", () => {
      const result = validatePartialRefund(10000, 5000);
      expect(result.valid).toBe(true);
    });

    test("validates full refund", () => {
      const result = validatePartialRefund(10000, 10000);
      expect(result.valid).toBe(true);
    });

    test("rejects refund exceeding original", () => {
      const result = validatePartialRefund(10000, 15000);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("exceeds original");
    });

    test("rejects negative refund amount", () => {
      const result = validatePartialRefund(10000, -5000);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("should be positive");
    });
  });

  describe("validateNormalizedTransaction", () => {
    test("validates fully correct transaction", () => {
      const transaction = {
        org_id: "org-123",
        account_id: "acc-123",
        provider_tx_id: "plaid-tx-123",
        date: "2024-01-15",
        amount_cents: "4250",
        currency: "USD",
        description: "Coffee shop",
      };
      const result = validateNormalizedTransaction(transaction, 42.50);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test("accumulates multiple validation errors", () => {
      const transaction = {
        org_id: "",
        account_id: "acc-123",
        provider_tx_id: "plaid-tx-123",
        date: "2024-13-99", // Invalid date
        amount_cents: "4249", // Wrong conversion
        currency: "XXX", // Invalid currency
        description: "Coffee shop",
      };
      const result = validateNormalizedTransaction(transaction, 42.50);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    test("validates transaction with negative dollar amount", () => {
      const transaction = {
        org_id: "org-123",
        account_id: "acc-123",
        provider_tx_id: "plaid-tx-123",
        date: "2024-01-15",
        amount_cents: "4250",
        currency: "USD",
        description: "Coffee shop",
      };
      const result = validateNormalizedTransaction(transaction, -42.50);
      expect(result.valid).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("handles very small amounts (< $0.01)", () => {
      const result = validateIntegerCentsConversion(0.001, "0");
      expect(result.valid).toBe(true); // Rounds to 0
    });

    test("handles very large amounts", () => {
      const largeAmount = 1000000.99;
      const result = validateIntegerCentsConversion(largeAmount, "100000099");
      expect(result.valid).toBe(true);
    });

    test("handles leap year dates", () => {
      const result = validateDateFormat("2024-02-29");
      expect(result.valid).toBe(true);
    });

    test("rejects invalid leap year date", () => {
      const result = validateDateFormat("2023-02-29");
      expect(result.valid).toBe(false);
    });

    test("handles unicode in descriptions", () => {
      const transaction = {
        org_id: "org-123",
        account_id: "acc-123",
        provider_tx_id: "plaid-tx-123",
        date: "2024-01-15",
        amount_cents: "1000",
        currency: "USD",
        description: "Café ☕️",
      };
      const result = validateNormalizedTransaction(transaction, 10.00);
      expect(result.valid).toBe(true);
    });
  });
});
