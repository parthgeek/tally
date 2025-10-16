/**
 * Ingestion Invariants Validation Module
 *
 * Validates data quality and correctness invariants for transaction ingestion from Plaid/Square.
 *
 * Invariants covered:
 * 1. Integer-cents conversion (no precision loss)
 * 2. Amount sign consistency
 * 3. Currency code validation
 * 4. Date format validation
 * 5. Required field presence
 * 6. Duplicate detection
 * 7. Payout reconciliation (clearing accounts sum to zero)
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PayoutReconciliationResult {
  reconciled: boolean;
  payoutAmount: number;
  totalTransactions: number;
  difference: number;
  errors: string[];
}

/**
 * Validates integer-cents conversion is lossless
 */
export function validateIntegerCentsConversion(
  dollarAmount: number,
  centsString: string,
): ValidationResult {
  const errors: string[] = [];

  // Reconstruct the cents value from string
  const cents = parseInt(centsString, 10);

  // Check if conversion is valid
  if (isNaN(cents)) {
    errors.push(`Invalid cents string: "${centsString}"`);
    return { valid: false, errors };
  }

  // Check for precision loss
  // Convert dollar amount to cents using same algorithm as production
  const expectedCents = Math.round(Math.abs(dollarAmount) * 100);

  if (cents !== expectedCents) {
    errors.push(
      `Cents conversion mismatch: ${dollarAmount} → expected ${expectedCents}, got ${cents}`,
    );
    return { valid: false, errors };
  }

  // Check for overflow (max safe integer is 2^53 - 1)
  if (cents > Number.MAX_SAFE_INTEGER) {
    errors.push(`Cents value exceeds MAX_SAFE_INTEGER: ${cents}`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates amount sign is preserved correctly
 * Plaid convention: negative = money out (expenses), positive = money in (income)
 */
export function validateAmountSign(
  originalAmount: number,
  centsString: string,
): ValidationResult {
  const errors: string[] = [];
  const cents = parseInt(centsString, 10);

  if (isNaN(cents)) {
    errors.push(`Invalid cents string: "${centsString}"`);
    return { valid: false, errors };
  }

  // Verify sign is preserved correctly
  const originalSign = Math.sign(originalAmount);
  const centsSign = Math.sign(cents);
  
  if (originalSign !== centsSign && originalAmount !== 0) {
    errors.push(`Sign mismatch: original=${originalAmount} (${originalSign}), cents=${cents} (${centsSign})`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates currency code is ISO 4217 compliant
 */
export function validateCurrencyCode(currency: string): ValidationResult {
  const errors: string[] = [];

  // Common ISO 4217 currency codes
  const validCurrencies = new Set([
    "USD",
    "CAD",
    "EUR",
    "GBP",
    "AUD",
    "JPY",
    "CHF",
    "CNY",
    "INR",
    "MXN",
  ]);

  if (!validCurrencies.has(currency)) {
    errors.push(`Invalid or unsupported currency code: "${currency}"`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates date format is YYYY-MM-DD
 */
export function validateDateFormat(dateString: string): ValidationResult {
  const errors: string[] = [];

  // Check format with regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    errors.push(`Invalid date format (expected YYYY-MM-DD): "${dateString}"`);
    return { valid: false, errors };
  }

  // Check if date is valid and matches the original string
  // This prevents JavaScript from auto-converting invalid dates like 2023-02-29 → 2023-03-01
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    errors.push(`Invalid date value: "${dateString}"`);
    return { valid: false, errors };
  }

  // Verify the date wasn't auto-corrected by comparing formatted date
  const reconstructed = date.toISOString().split("T")[0];
  if (reconstructed !== dateString) {
    errors.push(`Invalid date value: "${dateString}"`);
    return { valid: false, errors };
  }

  // Check if date is not in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    errors.push(`Transaction date is in the future: "${dateString}"`);
    return { valid: false, errors };
  }

  // Check if date is not too old (> 10 years)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  if (date < tenYearsAgo) {
    errors.push(`Transaction date is older than 10 years: "${dateString}"`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates required fields are present and non-empty
 */
export function validateRequiredFields(
  transaction: {
    provider_tx_id?: string;
    date?: string;
    amount_cents?: string;
    description?: string;
    org_id?: string;
    account_id?: string;
  },
): ValidationResult {
  const errors: string[] = [];

  if (!transaction.provider_tx_id || transaction.provider_tx_id.trim() === "") {
    errors.push("Missing required field: provider_tx_id");
  }

  if (!transaction.date || transaction.date.trim() === "") {
    errors.push("Missing required field: date");
  }

  if (!transaction.amount_cents || transaction.amount_cents.trim() === "") {
    errors.push("Missing required field: amount_cents");
  }

  if (!transaction.description || transaction.description.trim() === "") {
    errors.push("Missing required field: description");
  }

  if (!transaction.org_id || transaction.org_id.trim() === "") {
    errors.push("Missing required field: org_id");
  }

  if (!transaction.account_id || transaction.account_id.trim() === "") {
    errors.push("Missing required field: account_id");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detects duplicate transactions by (org_id, provider_tx_id)
 */
export function detectDuplicates(
  transactions: Array<{
    org_id: string;
    provider_tx_id: string;
  }>,
): ValidationResult {
  const errors: string[] = [];
  const seen = new Map<string, number>();

  for (const tx of transactions) {
    const key = `${tx.org_id}:${tx.provider_tx_id}`;
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
  }

  // Find duplicates
  const duplicates: string[] = [];
  for (const [key, count] of seen.entries()) {
    if (count > 1) {
      duplicates.push(`${key} (${count} occurrences)`);
    }
  }

  if (duplicates.length > 0) {
    errors.push(
      `Duplicate transactions detected:\n  ${duplicates.join("\n  ")}`,
    );
  }

  return {
    valid: duplicates.length === 0,
    errors,
  };
}

/**
 * Validates payout reconciliation: sum of payout-related transactions should equal payout amount
 *
 * For Shopify/Square payouts:
 * - Payout transaction (clearing → bank) should equal sum of constituent transactions
 * - Fees should be accounted for
 */
export function validatePayoutReconciliation(
  payoutTransaction: {
    amount_cents: string;
    description: string;
  },
  constituentTransactions: Array<{
    amount_cents: string;
    description: string;
  }>,
): PayoutReconciliationResult {
  const errors: string[] = [];

  const payoutAmount = parseInt(payoutTransaction.amount_cents, 10);
  if (isNaN(payoutAmount)) {
    errors.push(`Invalid payout amount: "${payoutTransaction.amount_cents}"`);
    return {
      reconciled: false,
      payoutAmount: 0,
      totalTransactions: 0,
      difference: 0,
      errors,
    };
  }

  let totalTransactions = 0;
  for (const tx of constituentTransactions) {
    const amount = parseInt(tx.amount_cents, 10);
    if (isNaN(amount)) {
      errors.push(`Invalid transaction amount: "${tx.amount_cents}"`);
      continue;
    }
    totalTransactions += amount;
  }

  const difference = Math.abs(payoutAmount - totalTransactions);

  // Allow small differences (<= $0.01) for rounding
  const reconciled = difference <= 1;

  if (!reconciled) {
    errors.push(
      `Payout reconciliation failed: payout=${payoutAmount} cents, ` +
        `sum=${totalTransactions} cents, difference=${difference} cents`,
    );
  }

  return {
    reconciled,
    payoutAmount,
    totalTransactions,
    difference,
    errors,
  };
}

/**
 * Validates a partial refund is correctly represented
 * - Refund amount should be <= original transaction amount
 * - Both should reference same original transaction
 */
export function validatePartialRefund(
  originalAmount: number,
  refundAmount: number,
): ValidationResult {
  const errors: string[] = [];

  // Refund should be positive (we store absolute values)
  if (refundAmount < 0) {
    errors.push(`Refund amount should be positive: ${refundAmount}`);
  }

  // Refund should not exceed original
  if (refundAmount > originalAmount) {
    errors.push(
      `Refund amount (${refundAmount}) exceeds original (${originalAmount})`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive validation for a normalized transaction
 */
export function validateNormalizedTransaction(
  transaction: {
    org_id: string;
    account_id: string;
    provider_tx_id: string;
    date: string;
    amount_cents: string;
    currency: string;
    description: string;
  },
  originalDollarAmount: number,
): ValidationResult {
  const errors: string[] = [];

  // Required fields
  const requiredFieldsResult = validateRequiredFields(transaction);
  if (!requiredFieldsResult.valid) {
    errors.push(...requiredFieldsResult.errors);
  }

  // Integer-cents conversion
  const centsResult = validateIntegerCentsConversion(
    originalDollarAmount,
    transaction.amount_cents,
  );
  if (!centsResult.valid) {
    errors.push(...centsResult.errors);
  }

  // Amount sign
  const signResult = validateAmountSign(
    originalDollarAmount,
    transaction.amount_cents,
  );
  if (!signResult.valid) {
    errors.push(...signResult.errors);
  }

  // Currency code
  const currencyResult = validateCurrencyCode(transaction.currency);
  if (!currencyResult.valid) {
    errors.push(...currencyResult.errors);
  }

  // Date format
  const dateResult = validateDateFormat(transaction.date);
  if (!dateResult.valid) {
    errors.push(...dateResult.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
