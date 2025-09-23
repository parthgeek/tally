/**
 * Transaction filtering utilities
 * Extracted for testability and reusability
 */

export interface FilterState {
  search: string;
  merchant: string;
  account: string;
  categoryId: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  lowConfidenceOnly: boolean;
}

export interface TransactionForFilter {
  id: string;
  date: string;
  amount_cents: string;
  currency: string;
  description: string;
  merchant_name?: string;
  source: string;
  raw: Record<string, unknown>;
  account_id: string;
  account_name: string;
  category_id?: string | null;
  category_name: string | null;
  confidence?: number | null;
  needs_review?: boolean;
  accounts?: any;
  categories?: any;
}

export const LOW_CONFIDENCE_THRESHOLD = 0.95;

export function filterTransactions(
  transactions: TransactionForFilter[],
  filters: FilterState
): TransactionForFilter[] {
  return transactions.filter(tx => {
    // Search filter (description or merchant)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesDescription = tx.description.toLowerCase().includes(searchLower);
      const matchesMerchant = tx.merchant_name?.toLowerCase().includes(searchLower) || false;
      if (!matchesDescription && !matchesMerchant) return false;
    }

    // Merchant filter
    if (filters.merchant) {
      const merchantLower = filters.merchant.toLowerCase();
      if (!tx.merchant_name?.toLowerCase().includes(merchantLower)) return false;
    }

    // Account filter
    if (filters.account && tx.account_name !== filters.account) {
      return false;
    }

    // Category filter
    if (filters.categoryId && tx.category_id !== filters.categoryId) {
      return false;
    }

    // Date range filter
    if (filters.dateFrom) {
      const txDate = new Date(tx.date);
      const fromDate = new Date(filters.dateFrom);
      if (txDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const txDate = new Date(tx.date);
      const toDate = new Date(filters.dateTo);
      if (txDate > toDate) return false;
    }

    // Amount range filter
    if (filters.minAmount) {
      const minAmountCents = parseFloat(filters.minAmount) * 100;
      if (parseInt(tx.amount_cents) < minAmountCents) return false;
    }
    if (filters.maxAmount) {
      const maxAmountCents = parseFloat(filters.maxAmount) * 100;
      if (parseInt(tx.amount_cents) > maxAmountCents) return false;
    }

    // Low confidence filter
    if (filters.lowConfidenceOnly) {
      const isLowConfidence = typeof tx.confidence === 'number' && tx.confidence < LOW_CONFIDENCE_THRESHOLD;
      if (!isLowConfidence) return false;
    }

    return true;
  });
}

export function isLowConfidence(confidence: number | null | undefined): boolean {
  return typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function getActiveFilterKeys(filters: FilterState): string[] {
  return Object.entries(filters)
    .filter(([_, value]) => {
      if (typeof value === 'boolean') return value;
      return value !== '';
    })
    .map(([key]) => key);
}