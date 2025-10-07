import { describe, test, expect } from "vitest";
import { generateSyntheticData, generateScenario } from "./synthetic";

describe("generateSyntheticData", () => {
  test("generates correct number of transactions", () => {
    const options = {
      count: 50,
      vendorNoisePercent: 0,
      mccMix: "balanced" as const,
      positiveNegativeRatio: 0.8,
    };

    const transactions = generateSyntheticData(options);

    expect(transactions).toHaveLength(50);
  });

  test("generates transactions with required fields", () => {
    const options = {
      count: 5,
      vendorNoisePercent: 0,
      mccMix: "balanced" as const,
      positiveNegativeRatio: 0.8,
    };

    const transactions = generateSyntheticData(options);

    transactions.forEach((tx) => {
      expect(tx.id).toMatch(/^synthetic-\d+$/);
      expect(tx.description).toBeDefined();
      expect(tx.amountCents).toBeDefined();
      expect(tx.currency).toBe("USD");
      expect(tx.categoryId).toBeDefined();
    });
  });

  test("generates deterministic results with same seed", () => {
    const options = {
      count: 10,
      vendorNoisePercent: 0,
      mccMix: "balanced" as const,
      positiveNegativeRatio: 0.8,
      seed: "test-seed",
    };

    const transactions1 = generateSyntheticData(options);
    const transactions2 = generateSyntheticData(options);

    expect(transactions1).toEqual(transactions2);
  });

  test("generates different results with different seeds", () => {
    const baseOptions = {
      count: 10,
      vendorNoisePercent: 0,
      mccMix: "balanced" as const,
      positiveNegativeRatio: 0.8,
    };

    const transactions1 = generateSyntheticData({ ...baseOptions, seed: "seed1" });
    const transactions2 = generateSyntheticData({ ...baseOptions, seed: "seed2" });

    expect(transactions1).not.toEqual(transactions2);
  });

  test("respects mccMix parameter", () => {
    const restaurantOptions = {
      count: 20,
      vendorNoisePercent: 0,
      mccMix: "restaurant-heavy" as const,
      positiveNegativeRatio: 0.8,
      seed: "restaurant-test",
    };

    const transactions = generateSyntheticData(restaurantOptions);

    // Count restaurant MCCs (5812, 5814, 5813)
    const restaurantMCCs = ["5812", "5814", "5813"];
    const restaurantCount = transactions.filter(
      (tx) => tx.mcc && restaurantMCCs.includes(tx.mcc)
    ).length;

    // Should have more restaurant transactions than other types
    expect(restaurantCount).toBeGreaterThan(transactions.length * 0.4);
  });

  test("applies vendor noise when specified", () => {
    const noisyOptions = {
      count: 20,
      vendorNoisePercent: 100, // Always add noise
      mccMix: "balanced" as const,
      positiveNegativeRatio: 0.8,
      seed: "noise-test",
    };

    const cleanOptions = {
      ...noisyOptions,
      vendorNoisePercent: 0, // Never add noise
    };

    const noisyTransactions = generateSyntheticData(noisyOptions);
    const cleanTransactions = generateSyntheticData(cleanOptions);

    // Noisy transactions should have different descriptions/merchant names
    const noisyDescriptions = noisyTransactions.map((tx) => tx.description);
    const cleanDescriptions = cleanTransactions.map((tx) => tx.description);

    expect(noisyDescriptions).not.toEqual(cleanDescriptions);
  });

  test("respects positive/negative ratio", () => {
    const allExpensesOptions = {
      count: 20,
      vendorNoisePercent: 0,
      mccMix: "balanced" as const,
      positiveNegativeRatio: 1.0, // All expenses
      seed: "expenses-test",
    };

    const transactions = generateSyntheticData(allExpensesOptions);

    // Filter out revenue transactions which are naturally positive
    const nonRevenueTransactions = transactions.filter((tx) => tx.categoryId !== "revenue");
    const expenseCount = nonRevenueTransactions.filter((tx) => parseInt(tx.amountCents) < 0).length;

    // Most non-revenue transactions should be expenses (negative)
    expect(expenseCount).toBeGreaterThan(nonRevenueTransactions.length * 0.8);
  });

  test("generates valid date formats", () => {
    const options = {
      count: 10,
      vendorNoisePercent: 0,
      mccMix: "balanced" as const,
      positiveNegativeRatio: 0.8,
    };

    const transactions = generateSyntheticData(options);

    transactions.forEach((tx) => {
      if (tx.date) {
        // Should match YYYY-MM-DD format
        expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Should be a valid date within last 90 days
        const txDate = new Date(tx.date);
        const now = new Date();
        const daysDiff = (now.getTime() - txDate.getTime()) / (24 * 60 * 60 * 1000);

        expect(daysDiff).toBeGreaterThanOrEqual(0);
        expect(daysDiff).toBeLessThanOrEqual(90);
      }
    });
  });

  test("generates valid amount formats", () => {
    const options = {
      count: 10,
      vendorNoisePercent: 0,
      mccMix: "balanced" as const,
      positiveNegativeRatio: 0.8,
    };

    const transactions = generateSyntheticData(options);

    transactions.forEach((tx) => {
      // Should be a valid integer string
      expect(tx.amountCents).toMatch(/^-?\d+$/);

      const amount = parseInt(tx.amountCents);
      expect(Number.isInteger(amount)).toBe(true);
      expect(Math.abs(amount)).toBeGreaterThan(0);
    });
  });
});

describe("generateScenario", () => {
  test("generates clear scenario", () => {
    const transactions = generateScenario("clear");

    expect(transactions).toHaveLength(2);

    // Clear scenarios should have predictable patterns
    transactions.forEach((tx) => {
      expect(tx.description).toBeDefined();
      expect(tx.merchantName).toBeDefined();
      expect(tx.mcc).toBeDefined();
      expect(tx.categoryId).toBeDefined();
    });
  });

  test("generates ambiguous scenario", () => {
    const transactions = generateScenario("ambiguous");

    expect(transactions).toHaveLength(2);

    // Ambiguous scenarios should have unclear categorization
    transactions.forEach((tx) => {
      expect(tx.description).toBeDefined();
      expect(tx.categoryId).toBe("unclear");
    });
  });

  test("generates mixed scenario", () => {
    const transactions = generateScenario("mixed");

    expect(transactions).toHaveLength(4); // clear + ambiguous

    const clearCount = transactions.filter((tx) => tx.categoryId !== "unclear").length;
    const ambiguousCount = transactions.filter((tx) => tx.categoryId === "unclear").length;

    expect(clearCount).toBe(2);
    expect(ambiguousCount).toBe(2);
  });

  test("scenario transactions have valid structure", () => {
    const scenarios = ["clear", "ambiguous", "mixed"] as const;

    scenarios.forEach((scenarioType) => {
      const transactions = generateScenario(scenarioType);

      transactions.forEach((tx) => {
        expect(tx.id).toBeDefined();
        expect(tx.description).toBeDefined();
        expect(tx.amountCents).toBeDefined();
        expect(tx.categoryId).toBeDefined();

        // Should be valid amount format
        expect(tx.amountCents).toMatch(/^-?\d+$/);
      });
    });
  });
});
