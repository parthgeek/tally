import { z } from "zod";
import { labTransactionSchema, type LabTransaction, datasetUploadSchema } from "./types";

/**
 * Parse CSV content into lab transactions
 */
export function parseCSV(csvContent: string): LabTransaction[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const transactions: LabTransaction[] = [];

  // Required column mappings (flexible header names)
  const columnMap = {
    id: findColumn(headers, ["id", "transaction_id", "txn_id"]),
    description: findColumn(headers, ["description", "desc", "memo", "narrative"]),
    amountCents: findColumn(headers, ["amount_cents", "amount", "cents", "value"]),
    merchantName: findColumn(headers, ["merchant_name", "merchant", "vendor", "payee"], false),
    mcc: findColumn(headers, ["mcc", "merchant_category_code"], false),
    date: findColumn(headers, ["date", "transaction_date", "posted_date"], false),
    currency: findColumn(headers, ["currency", "curr"], false),
    categoryId: findColumn(headers, ["category_id", "category", "ground_truth"], false),
  };

  // Check if this CSV has mixed dollar formats (decimals or currency symbols)
  // If so, treat all amounts as dollars and convert to cents
  const hasMixedDollarFormats = csvContent.includes(".") || csvContent.includes("$");
  const amountContext = hasMixedDollarFormats ? "dollars" : "csv";

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]!.split(",").map((cell) => cell.trim());

    if (row.length < headers.length) {
      console.warn(`Row ${i + 1} has fewer columns than headers, skipping`);
      continue;
    }

    try {
      const transaction: Partial<LabTransaction> = {
        id: getValue(row, columnMap.id) || `csv-${i}`,
        description: getValue(row, columnMap.description) || "",
        amountCents: normalizeAmount(getValue(row, columnMap.amountCents) || "0", amountContext),
      };

      // Optional fields
      if (columnMap.merchantName !== -1) {
        transaction.merchantName = getValue(row, columnMap.merchantName) || undefined;
      }
      if (columnMap.mcc !== -1) {
        transaction.mcc = getValue(row, columnMap.mcc) || undefined;
      }
      if (columnMap.date !== -1) {
        transaction.date = normalizeDate(getValue(row, columnMap.date)) || undefined;
      }
      if (columnMap.currency !== -1) {
        transaction.currency = getValue(row, columnMap.currency) || "USD";
      }
      if (columnMap.categoryId !== -1) {
        transaction.categoryId = getValue(row, columnMap.categoryId) || undefined;
      }

      // Validate the transaction
      const validated = labTransactionSchema.parse(transaction);
      transactions.push(validated);
    } catch (error) {
      console.warn(`Row ${i + 1} failed validation:`, error);
    }
  }

  if (transactions.length === 0) {
    throw new Error("No valid transactions found in CSV");
  }

  return transactions;
}

/**
 * Parse JSON content into lab transactions
 */
export function parseJSON(jsonContent: string): LabTransaction[] {
  let data: unknown;
  try {
    data = JSON.parse(jsonContent);
  } catch {
    throw new Error("Invalid JSON format");
  }

  // Handle both array and object with transactions array
  let transactionsArray: unknown;
  if (Array.isArray(data)) {
    transactionsArray = data;
  } else if (typeof data === "object" && data !== null && "transactions" in data) {
    transactionsArray = (data as { transactions: unknown }).transactions;
  } else {
    throw new Error(
      'JSON must be an array of transactions or an object with a "transactions" array'
    );
  }

  if (!Array.isArray(transactionsArray)) {
    throw new Error("Transactions data must be an array");
  }

  const transactions: LabTransaction[] = [];
  for (let i = 0; i < transactionsArray.length; i++) {
    try {
      const transaction = transactionsArray[i];

      // Normalize amount if needed
      if (typeof transaction === "object" && transaction !== null && "amountCents" in transaction) {
        (transaction as { amountCents: string }).amountCents = normalizeAmount(
          String((transaction as { amountCents: unknown }).amountCents)
        );
      }

      // Normalize date if needed
      if (typeof transaction === "object" && transaction !== null && "date" in transaction) {
        const normalized = normalizeDate(String((transaction as { date: unknown }).date));
        if (normalized) {
          (transaction as { date: string }).date = normalized;
        }
      }

      const validated = labTransactionSchema.parse(transaction);
      transactions.push(validated);
    } catch (error) {
      console.warn(`Transaction ${i + 1} failed validation:`, error);
    }
  }

  if (transactions.length === 0) {
    throw new Error("No valid transactions found in JSON");
  }

  return transactions;
}

/**
 * Parse uploaded dataset based on format
 */
export function parseDataset(upload: { format: string; data: string }): LabTransaction[] {
  // Validate format before Zod parsing to match test expectations
  if (!upload.format || !["json", "csv"].includes(upload.format)) {
    throw new Error("Unsupported format");
  }

  const validated = datasetUploadSchema.parse(upload);

  switch (validated.format) {
    case "csv":
      return parseCSV(validated.data);
    case "json":
      return parseJSON(validated.data);
    default:
      throw new Error(`Unsupported format: ${validated.format}`);
  }
}

// Helper functions

function findColumn(headers: string[], candidates: string[], required = true): number {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index !== -1) return index;
  }

  if (required) {
    throw new Error(`Required column not found. Looking for one of: ${candidates.join(", ")}`);
  }

  return -1;
}

function getValue(row: string[], index: number): string | null {
  if (index === -1 || index >= row.length) return null;
  const value = row[index]?.trim();
  return value && value !== "" ? value : null;
}

/**
 * Normalize amount to cents string format
 * Intelligently handles both dollar and cent inputs based on context
 */
function normalizeAmount(
  input: string,
  context: "csv" | "json" | "dollars" | boolean = false
): string {
  // Remove currency symbols and commas
  const cleaned = input.replace(/[$,\s]/g, "").trim();

  // Handle empty or invalid input
  if (!cleaned || cleaned === "") return "0";

  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";

  // Handle different contexts
  if (context === "csv") {
    // For CSV, check if input looks like dollars (has decimal or $ symbol)
    // or if it's clearly a dollar amount (large round numbers)
    if (input.includes(".") || input.includes("$")) {
      // Has decimal or currency symbol - treat as dollars and convert to cents
      return Math.round(num * 100).toString();
    } else {
      // No decimal or currency symbol - treat as already in cents
      return Math.round(num).toString();
    }
  } else if (context === "dollars") {
    // All amounts should be treated as dollars and converted to cents
    return Math.round(num * 100).toString();
  } else if (context === "json" || context === false) {
    // JSON context or legacy - always convert dollars to cents
    const cents = Math.round(num * 100);
    return cents.toString();
  } else {
    // Legacy boolean true - treat as already in cents
    return Math.round(num).toString();
  }
}

/**
 * Normalize date to YYYY-MM-DD format
 * Accepts: "2024-01-15", "01/15/2024", "15-Jan-2024", ISO strings
 */
function normalizeDate(input: string | null | undefined): string | null {
  if (!input || input.trim() === "") return null;

  try {
    const date = new Date(input);
    if (isNaN(date.getTime())) return null;

    // Return in YYYY-MM-DD format
    return date.toISOString().split("T")[0] || null;
  } catch {
    return null;
  }
}

/**
 * Validate and clean a dataset of transactions
 */
export function validateDataset(transactions: unknown[]): LabTransaction[] {
  const validated: LabTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < transactions.length; i++) {
    try {
      const transaction = labTransactionSchema.parse(transactions[i]);
      validated.push(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(
          `Transaction ${i + 1}: ${error.issues.map((e: z.ZodIssue) => e.message).join(", ")}`
        );
      } else {
        errors.push(`Transaction ${i + 1}: Unknown validation error`);
      }
    }
  }

  if (validated.length === 0) {
    throw new Error(`No valid transactions found. Errors:\n${errors.join("\n")}`);
  }

  if (errors.length > 0) {
    console.warn(`${errors.length} transactions failed validation:`, errors);
  }

  return validated;
}
