import type { NormalizedTransaction } from "@nexus/types";
import type { CategorizationContext } from "@nexus/categorizer";
import type { LabTransaction } from "./types";

/**
 * Map lab transaction format to NormalizedTransaction format expected by categorizer
 */
export function mapLabTransactionToNormalized(
  labTx: LabTransaction,
  orgId: string
): NormalizedTransaction {
  return {
    id: labTx.id as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Cast to branded type
    orgId: orgId as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Cast to branded type
    date: labTx.date || new Date().toISOString().split("T")[0]!,
    amountCents: labTx.amountCents,
    currency: labTx.currency || "USD",
    description: labTx.description,
    merchantName: labTx.merchantName,
    mcc: labTx.mcc,
    categoryId: labTx.categoryId as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Cast to branded type (optional)
    confidence: undefined, // Will be set by categorizer
    reviewed: false,
    needsReview: false,
    source: "manual" as const, // Lab transactions are considered manual input
    raw: {
      // Store original lab data in raw field
      labTransaction: labTx,
      source: "categorizer-lab",
    },
  };
}

/**
 * Map array of lab transactions to normalized format
 */
export function mapLabTransactionsToNormalized(
  labTransactions: LabTransaction[],
  orgId: string
): NormalizedTransaction[] {
  return labTransactions.map((tx) => mapLabTransactionToNormalized(tx, orgId));
}

/**
 * Extract timing information from categorization process
 */
export function extractTimings(
  startTime: number,
  pass1Time?: number,
  pass2Time?: number
): { totalMs: number; pass1Ms?: number; pass2Ms?: number } {
  const totalMs = Date.now() - startTime;

  const result: { totalMs: number; pass1Ms?: number; pass2Ms?: number } = { totalMs };

  if (pass1Time !== undefined) {
    result.pass1Ms = pass1Time;
  }
  if (pass2Time !== undefined) {
    result.pass2Ms = pass2Time;
  }

  return result;
}

/**
 * Map categorization result back to lab format
 */
export function mapCategorizationResultToLab(
  transactionId: string,
  result: {
    categoryId?: string | undefined;
    confidence?: number | undefined;
    rationale?: string[] | undefined;
  },
  engine: "pass1" | "llm",
  timings: { totalMs: number; pass1Ms?: number; pass2Ms?: number },
  error?: string
) {
  return {
    id: transactionId,
    predictedCategoryId: result.categoryId,
    confidence: result.confidence,
    rationale: result.rationale || [],
    engine,
    timings,
    error,
  };
}

/**
 * Create minimal categorization context for lab use
 */
export function createLabCategorizationContext(orgId: string): CategorizationContext {
  // This creates a minimal context object that satisfies the categorizer interface
  // without requiring full database connections or production dependencies
  return {
    orgId: orgId as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Cast to branded type
    // Add minimal required context properties
    // The actual categorizer functions should handle missing optional context gracefully
  } as CategorizationContext;
}

/**
 * Validate that lab transaction IDs are unique
 */
export function validateUniqueIds(transactions: LabTransaction[]): void {
  const ids = new Set<string>();
  const duplicates: string[] = [];

  for (const tx of transactions) {
    if (ids.has(tx.id)) {
      duplicates.push(tx.id);
    } else {
      ids.add(tx.id);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(`Duplicate transaction IDs found: ${duplicates.join(", ")}`);
  }
}

/**
 * Sanitize transaction descriptions for consistent processing
 */
export function sanitizeDescription(description: string): string {
  return description
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .toUpperCase(); // Consistent casing
}

/**
 * Extract vendor information from description using common patterns
 */
export function extractVendorFromDescription(description: string): string | undefined {
  let sanitized = sanitizeDescription(description);

  // Handle specific patterns before general punctuation cleanup
  // AMZN.COM/BILL special case
  sanitized = sanitized.replace(/\s*AMZN\.COM\/BILL\s*$/, "");

  // Strip punctuation except spaces, &, .
  sanitized = sanitized
    .replace(/[^A-Z0-9\s&.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const suffixPatterns = [
    /\s+POS$/,
    /\s+AUTH$/,
    /\s+CARD$/,
    /\s+REF$/,
    /\s+WEB$/,
    /\s+VISA$/,
    /\s+ONLINE$/,
    /\s+ECOM$/,
    /\s+EC$/,
  ];

  for (const pattern of suffixPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Remove boilerplate tokens
  const boilerplateTokens = ["PAYMENT", "THANK", "YOU", "TRANSFER", "DEBIT", "CREDIT"];
  const words = sanitized.split(/\s+/);
  const filteredWords = words.filter((word) => !boilerplateTokens.includes(word));

  // If only boilerplate remains, return undefined
  if (filteredWords.length === 0) {
    return undefined;
  }

  sanitized = filteredWords.join(" ");

  // Trim store numbers and trailing patterns like #123, T-1234
  // Note: punctuation cleanup above converts "T-1234" to "T 1234"
  sanitized = sanitized.replace(/\s+#\s*\d+$/, "").replace(/\s+T\s+\d+$/, "");

  // Remove trailing state codes (2 uppercase letters at end)
  sanitized = sanitized.replace(/\s+[A-Z]{2}$/, "");

  // Remove trailing numbers
  sanitized = sanitized.replace(/\s+\d+$/, "");

  // If the remaining token length < 3, return undefined
  if (sanitized.length < 3) {
    return undefined;
  }

  // If only boilerplate patterns remain, return undefined
  const remainingWords = sanitized.split(/\s+/);
  if (remainingWords.every((word) => boilerplateTokens.includes(word) || word.length < 3)) {
    return undefined;
  }

  return sanitized.trim();
}

/**
 * Normalize currency codes
 */
export function normalizeCurrency(currency?: string): string {
  if (!currency) return "USD";

  const normalized = currency.toUpperCase().trim();

  // Common currency mappings
  const currencyMap: Record<string, string> = {
    US: "USD",
    DOLLAR: "USD",
    DOLLARS: "USD",
    $: "USD",
  };

  return currencyMap[normalized] || normalized;
}

/**
 * Validate amount format and convert to cents string
 * Always converts dollars to integer cents using integer math
 */
export function validateAndNormalizeAmount(amount: string | number): string {
  let amountStr: string;

  if (typeof amount === "number") {
    amountStr = amount.toString();
  } else {
    amountStr = amount;
  }

  // Remove currency symbols, commas, and spaces; detect sign
  const sign = amountStr.trim().startsWith("-") ? -1 : 1;
  const cleaned = amountStr.replace(/[-$,\s]/g, "");

  // Validate it's a valid number
  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  // Convert dollars to integer cents using integer math
  // Always treat input as dollars and convert to cents
  const cents = Math.round(num * 100) * sign;

  return cents.toString();
}

/**
 * Create a summary of the dataset for validation
 */
export function createDatasetSummary(transactions: LabTransaction[]) {
  const summary = {
    count: transactions.length,
    dateRange: {
      earliest: null as string | null,
      latest: null as string | null,
    },
    amountRange: {
      min: Infinity,
      max: -Infinity,
    },
    currencies: new Set<string>(),
    hasMCC: 0,
    hasGroundTruth: 0,
    uniqueVendors: new Set<string>(),
  };

  for (const tx of transactions) {
    // Date range
    if (tx.date) {
      if (!summary.dateRange.earliest || tx.date < summary.dateRange.earliest) {
        summary.dateRange.earliest = tx.date;
      }
      if (!summary.dateRange.latest || tx.date > summary.dateRange.latest) {
        summary.dateRange.latest = tx.date;
      }
    }

    // Amount range
    const amount = parseInt(tx.amountCents, 10);
    if (!isNaN(amount)) {
      summary.amountRange.min = Math.min(summary.amountRange.min, amount);
      summary.amountRange.max = Math.max(summary.amountRange.max, amount);
    }

    // Currencies
    summary.currencies.add(tx.currency || "USD");

    // Features
    if (tx.mcc) summary.hasMCC++;
    if (tx.categoryId) summary.hasGroundTruth++;
    if (tx.merchantName) summary.uniqueVendors.add(tx.merchantName);
  }

  return {
    ...summary,
    currencies: Array.from(summary.currencies),
    uniqueVendors: summary.uniqueVendors.size,
    coverage: {
      mccPercent: (summary.hasMCC / summary.count) * 100,
      groundTruthPercent: (summary.hasGroundTruth / summary.count) * 100,
    },
  };
}
