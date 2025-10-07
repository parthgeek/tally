import { describe, test, expect } from "vitest";
import { parseCSV, parseJSON, parseDataset, validateDataset } from "./parsers";

describe("parseCSV", () => {
  test("parses valid CSV with all columns", () => {
    const csvContent = `id,description,amount_cents,merchant_name,mcc,date,currency,category_id
tx-1,STARBUCKS STORE #123,-500,STARBUCKS,5814,2024-01-15,USD,meals
tx-2,ELECTRIC BILL,-15000,ELECTRIC CO,4900,2024-01-01,USD,utilities`;

    const transactions = parseCSV(csvContent);

    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toEqual({
      id: "tx-1",
      description: "STARBUCKS STORE #123",
      amountCents: "-500",
      merchantName: "STARBUCKS",
      mcc: "5814",
      date: "2024-01-15",
      currency: "USD",
      categoryId: "meals",
    });
  });

  test("handles minimal required columns", () => {
    const csvContent = `id,description,amount_cents
tx-1,COFFEE SHOP,-500`;

    const transactions = parseCSV(csvContent);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual({
      id: "tx-1",
      description: "COFFEE SHOP",
      amountCents: "-500",
      currency: "USD",
    });
  });

  test("normalizes amount formats", () => {
    const csvContent = `id,description,amount_cents
tx-1,Test 1,123.45
tx-2,Test 2,1234
tx-3,Test 3,$56.78`;

    const transactions = parseCSV(csvContent);

    expect(transactions[0]!.amountCents).toBe("12345"); // 123.45 * 100
    expect(transactions[1]!.amountCents).toBe("123400"); // 1234 * 100 (assuming dollars)
    expect(transactions[2]!.amountCents).toBe("5678"); // $56.78 -> 56.78 * 100
  });

  test("normalizes dates", () => {
    const csvContent = `id,description,amount_cents,date
tx-1,Test,-500,2024-01-15
tx-2,Test,-500,01/15/2024
tx-3,Test,-500,invalid-date`;

    const transactions = parseCSV(csvContent);

    expect(transactions[0]!.date).toBe("2024-01-15");
    expect(transactions[1]!.date).toBe("2024-01-15");
    expect(transactions[2]!.date).toBeUndefined();
  });

  test("throws error for empty CSV", () => {
    expect(() => parseCSV("")).toThrow("CSV must have a header row");
  });

  test("throws error for header-only CSV", () => {
    expect(() => parseCSV("id,description,amount_cents")).toThrow("CSV must have a header row");
  });

  test("throws error for missing required columns", () => {
    const csvContent = `id,other_column
tx-1,value`;

    expect(() => parseCSV(csvContent)).toThrow("Required column not found");
  });
});

describe("parseJSON", () => {
  test("parses array of transactions", () => {
    const jsonContent = JSON.stringify([
      {
        id: "tx-1",
        description: "STARBUCKS",
        amountCents: "-500",
        merchantName: "STARBUCKS",
        categoryId: "meals",
      },
    ]);

    const transactions = parseJSON(jsonContent);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.id).toBe("tx-1");
  });

  test("parses object with transactions array", () => {
    const jsonContent = JSON.stringify({
      transactions: [
        {
          id: "tx-1",
          description: "STARBUCKS",
          amountCents: "-500",
        },
      ],
    });

    const transactions = parseJSON(jsonContent);

    expect(transactions).toHaveLength(1);
  });

  test("normalizes amount in JSON", () => {
    const jsonContent = JSON.stringify([
      {
        id: "tx-1",
        description: "Test",
        amountCents: 123.45,
      },
    ]);

    const transactions = parseJSON(jsonContent);

    expect(transactions[0]!.amountCents).toBe("12345");
  });

  test("throws error for invalid JSON", () => {
    expect(() => parseJSON("invalid json")).toThrow("Invalid JSON format");
  });

  test("throws error for non-array format", () => {
    const jsonContent = JSON.stringify({ notTransactions: [] });

    expect(() => parseJSON(jsonContent)).toThrow("JSON must be an array");
  });
});

describe("parseDataset", () => {
  test("delegates to parseCSV for CSV format", () => {
    const csvContent = `id,description,amount_cents
tx-1,Test,-500`;

    const transactions = parseDataset({ format: "csv", data: csvContent });

    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.id).toBe("tx-1");
  });

  test("delegates to parseJSON for JSON format", () => {
    const jsonContent = JSON.stringify([{ id: "tx-1", description: "Test", amountCents: "-500" }]);

    const transactions = parseDataset({ format: "json", data: jsonContent });

    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.id).toBe("tx-1");
  });

  test("throws error for unsupported format", () => {
    expect(() => parseDataset({ format: "xml" as "json", data: "" })).toThrow("Unsupported format");
  });
});

describe("validateDataset", () => {
  test("validates and cleans good transactions", () => {
    const transactions = [
      {
        id: "tx-1",
        description: "Test",
        amountCents: "-500",
      },
    ];

    const validated = validateDataset(transactions);

    expect(validated).toHaveLength(1);
    expect(validated[0]!.currency).toBe("USD"); // Default added
  });

  test("filters out invalid transactions", () => {
    const transactions = [
      {
        id: "tx-1",
        description: "Valid",
        amountCents: "-500",
      },
      {
        id: "tx-2",
        // Missing required description
        amountCents: "-500",
      },
    ];

    const validated = validateDataset(transactions);

    expect(validated).toHaveLength(1);
    expect(validated[0]!.id).toBe("tx-1");
  });

  test("throws error when no valid transactions found", () => {
    const transactions = [
      {
        // Missing required fields
        id: "tx-1",
      },
    ];

    expect(() => validateDataset(transactions)).toThrow("No valid transactions found");
  });
});
