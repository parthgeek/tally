/**
 * Analytics event constants for tracking user interactions
 * These should be used consistently across the application
 */

export const ANALYTICS_EVENTS = {
  TRANSACTIONS_FILTER_CHANGED: 'TRANSACTIONS_FILTER_CHANGED',
  TRANSACTION_CATEGORY_CORRECTED: 'TRANSACTION_CATEGORY_CORRECTED',
  TRANSACTION_CATEGORY_LOW_CONF_WARNING_SHOWN: 'TRANSACTION_CATEGORY_LOW_CONF_WARNING_SHOWN',
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];

/**
 * Properties for transactions filter changed event
 */
export interface TransactionsFilterChangedProps {
  filter_keys: string[];
  low_conf_only: boolean;
  results_count: number;
  org_id: string;
  user_id: string;
}

/**
 * Properties for transaction category corrected event
 */
export interface TransactionCategoryCorrectedProps {
  old_category_id: string | null;
  new_category_id: string;
  confidence: number | null;
  tx_amount_cents: number;
  org_id: string;
  user_id: string;
  transaction_id: string;
}

/**
 * Properties for low confidence warning shown event
 */
export interface TransactionLowConfWarningShownProps {
  transaction_id: string;
  confidence: number;
  category_id: string | null;
  org_id: string;
  user_id: string;
}