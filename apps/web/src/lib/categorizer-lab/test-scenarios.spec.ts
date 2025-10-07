import { describe, test, expect } from "vitest";
import {
  TEST_SCENARIOS,
  getAllTestTransactions,
  getScenarioById,
  getTransactionsByScenario,
  type TestScenario,
} from "./test-scenarios.js";

describe("test-scenarios", () => {
  describe("TEST_SCENARIOS structure", () => {
    test("contains expected number of scenarios", () => {
      expect(TEST_SCENARIOS).toHaveLength(7);
    });

    test("all scenarios have required properties", () => {
      for (const scenario of TEST_SCENARIOS) {
        expect(scenario.id).toBeDefined();
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(Array.isArray(scenario.transactions)).toBe(true);
        expect(Array.isArray(scenario.expectedChallenges)).toBe(true);
        expect(scenario.transactions.length).toBeGreaterThan(0);
        expect(scenario.expectedChallenges.length).toBeGreaterThan(0);
      }
    });

    test("scenario IDs are unique", () => {
      const ids = TEST_SCENARIOS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe("individual scenarios", () => {
    test("shopify-ecosystem scenario covers platform fees and payouts", () => {
      const scenario = getScenarioById("shopify-ecosystem");
      expect(scenario).toBeDefined();
      expect(scenario!.name).toBe("Shopify Ecosystem");

      const transactions = scenario!.transactions;
      expect(transactions.some((tx) => tx.description.includes("SHOPIFY SUBSCRIPTION"))).toBe(true);
      expect(transactions.some((tx) => tx.description.includes("SHOPIFY PAYOUT"))).toBe(true);
      expect(transactions.some((tx) => tx.merchantName === "Klaviyo")).toBe(true);
    });

    test("payment-processing scenario covers different processors", () => {
      const scenario = getScenarioById("payment-processing");
      expect(scenario).toBeDefined();

      const transactions = scenario!.transactions;
      const merchants = transactions.map((tx) => tx.merchantName.toLowerCase());

      expect(merchants.some((m) => m.includes("stripe"))).toBe(true);
      expect(merchants.some((m) => m.includes("paypal"))).toBe(true);
      expect(merchants.some((m) => m.includes("afterpay"))).toBe(true);
    });

    test("digital-advertising scenario covers major platforms", () => {
      const scenario = getScenarioById("digital-advertising");
      expect(scenario).toBeDefined();

      const transactions = scenario!.transactions;
      const merchants = transactions.map((tx) => tx.merchantName.toLowerCase());

      expect(merchants.some((m) => m.includes("meta"))).toBe(true);
      expect(merchants.some((m) => m.includes("google"))).toBe(true);
      expect(merchants.some((m) => m.includes("tiktok"))).toBe(true);

      // All should be MCC 7311 (advertising)
      expect(transactions.every((tx) => tx.mcc === "7311")).toBe(true);
    });

    test("fulfillment-logistics scenario covers shipping and warehousing", () => {
      const scenario = getScenarioById("fulfillment-logistics");
      expect(scenario).toBeDefined();

      const transactions = scenario!.transactions;
      expect(transactions.some((tx) => tx.merchantName === "ShipBob")).toBe(true);
      expect(transactions.some((tx) => tx.merchantName === "UPS")).toBe(true);
      expect(transactions.some((tx) => tx.description.includes("WAREHOUSE"))).toBe(true);
    });

    test("inventory-manufacturing scenario covers COGS categories", () => {
      const scenario = getScenarioById("inventory-manufacturing");
      expect(scenario).toBeDefined();

      const transactions = scenario!.transactions;
      expect(transactions.some((tx) => tx.description.includes("WHOLESALE PRODUCT"))).toBe(true);
      expect(transactions.some((tx) => tx.description.includes("PACKAGING"))).toBe(true);
      expect(transactions.some((tx) => tx.description.includes("PRODUCTION RUN"))).toBe(true);

      // Check category mappings
      expect(transactions.some((tx) => tx.categoryId === "inventory_purchases")).toBe(true);
      expect(transactions.some((tx) => tx.categoryId === "packaging_supplies")).toBe(true);
      expect(transactions.some((tx) => tx.categoryId === "manufacturing_costs")).toBe(true);
    });

    test("refunds-contra-revenue scenario handles negative amounts", () => {
      const scenario = getScenarioById("refunds-contra-revenue");
      expect(scenario).toBeDefined();

      const transactions = scenario!.transactions;
      const refundTx = transactions.find((tx) => tx.description.includes("CUSTOMER REFUND"));
      const discountTx = transactions.find((tx) => tx.description.includes("PROMOTIONAL DISCOUNT"));

      expect(refundTx).toBeDefined();
      expect(refundTx!.amountCents).toBe("-15000");
      expect(refundTx!.categoryId).toBe("refunds_allowances_contra");

      expect(discountTx).toBeDefined();
      expect(discountTx!.amountCents).toBe("-2500");
      expect(discountTx!.categoryId).toBe("discounts_contra");
    });

    test("sales-tax-liability scenario routes to liability accounts", () => {
      const scenario = getScenarioById("sales-tax-liability");
      expect(scenario).toBeDefined();

      const transactions = scenario!.transactions;
      expect(transactions.every((tx) => tx.categoryId === "sales_tax_payable")).toBe(true);
      expect(transactions.every((tx) => tx.mcc === "9311")).toBe(true);

      const taxAuthorities = transactions.map((tx) => tx.merchantName);
      expect(taxAuthorities.some((m) => m.includes("State of"))).toBe(true);
      expect(taxAuthorities.some((m) => m.includes("City of"))).toBe(true);
    });
  });

  describe("transaction validation", () => {
    test("all transactions have required fields", () => {
      const allTransactions = getAllTestTransactions();

      for (const tx of allTransactions) {
        expect(tx.id).toBeDefined();
        expect(tx.description).toBeDefined();
        expect(tx.merchantName).toBeDefined();
        expect(tx.amountCents).toBeDefined();
        expect(tx.categoryId).toBeDefined();
        expect(tx.date).toBeDefined();
        expect(tx.currency).toBe("USD");
      }
    });

    test("transaction IDs are unique across all scenarios", () => {
      const allTransactions = getAllTestTransactions();
      const ids = allTransactions.map((tx) => tx.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    test("amount formats are consistent", () => {
      const allTransactions = getAllTestTransactions();

      for (const tx of allTransactions) {
        // Should be string representation of cents
        expect(typeof tx.amountCents).toBe("string");

        // Should be valid number when parsed
        const amount = parseInt(tx.amountCents, 10);
        expect(isNaN(amount)).toBe(false);
      }
    });

    test("dates are in consistent format", () => {
      const allTransactions = getAllTestTransactions();
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      for (const tx of allTransactions) {
        expect(dateRegex.test(tx.date)).toBe(true);
      }
    });

    test("MCC codes are valid when provided", () => {
      const allTransactions = getAllTestTransactions();

      for (const tx of allTransactions) {
        if (tx.mcc) {
          expect(typeof tx.mcc).toBe("string");
          expect(tx.mcc.length).toBe(4);
          expect(/^\d{4}$/.test(tx.mcc)).toBe(true);
        }
      }
    });
  });

  describe("helper functions", () => {
    test("getAllTestTransactions returns all transactions", () => {
      const allTransactions = getAllTestTransactions();
      const expectedCount = TEST_SCENARIOS.reduce(
        (sum, scenario) => sum + scenario.transactions.length,
        0
      );
      expect(allTransactions.length).toBe(expectedCount);
    });

    test("getScenarioById finds existing scenarios", () => {
      const scenario = getScenarioById("shopify-ecosystem");
      expect(scenario).toBeDefined();
      expect(scenario!.id).toBe("shopify-ecosystem");
    });

    test("getScenarioById returns undefined for non-existent scenarios", () => {
      const scenario = getScenarioById("non-existent");
      expect(scenario).toBeUndefined();
    });

    test("getTransactionsByScenario returns correct transactions", () => {
      const transactions = getTransactionsByScenario("payment-processing");
      expect(transactions.length).toBe(3);
      expect(
        transactions.every(
          (tx) =>
            tx.merchantName.toLowerCase().includes("stripe") ||
            tx.merchantName.toLowerCase().includes("paypal") ||
            tx.merchantName.toLowerCase().includes("afterpay")
        )
      ).toBe(true);
    });

    test("getTransactionsByScenario returns empty array for non-existent scenario", () => {
      const transactions = getTransactionsByScenario("non-existent");
      expect(transactions).toEqual([]);
    });
  });

  describe("e-commerce specificity", () => {
    test("scenarios cover e-commerce business patterns", () => {
      const scenarioIds = TEST_SCENARIOS.map((s) => s.id);

      expect(scenarioIds).toContain("shopify-ecosystem");
      expect(scenarioIds).toContain("payment-processing");
      expect(scenarioIds).toContain("digital-advertising");
      expect(scenarioIds).toContain("fulfillment-logistics");
      expect(scenarioIds).toContain("inventory-manufacturing");
    });

    test("challenges reflect e-commerce categorization difficulties", () => {
      const allChallenges = TEST_SCENARIOS.flatMap((s) => s.expectedChallenges);

      expect(allChallenges.some((c) => c.includes("platform fees"))).toBe(true);
      expect(allChallenges.some((c) => c.includes("payment processors"))).toBe(true);
      expect(allChallenges.some((c) => c.includes("revenue recognition"))).toBe(true);
      expect(allChallenges.some((c) => c.includes("COGS"))).toBe(true);
    });

    test("category mappings use e-commerce taxonomy", () => {
      const allTransactions = getAllTestTransactions();
      const categoryIds = new Set(allTransactions.map((tx) => tx.categoryId));

      // Should contain e-commerce specific categories
      expect(categoryIds.has("shopify_platform")).toBe(true);
      expect(categoryIds.has("stripe_fees")).toBe(true);
      expect(categoryIds.has("ads_meta")).toBe(true);
      expect(categoryIds.has("inventory_purchases")).toBe(true);
      expect(categoryIds.has("refunds_allowances_contra")).toBe(true);
      expect(categoryIds.has("sales_tax_payable")).toBe(true);

      // Should not contain salon-specific categories
      expect(categoryIds.has("salon_revenue")).toBe(false);
      expect(categoryIds.has("beauty_supplies")).toBe(false);
    });
  });
});
