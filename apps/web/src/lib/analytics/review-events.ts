import { getPosthogClientServer } from '@nexus/analytics/server';

/**
 * Core function for tracking PostHog review events
 */
export async function trackReviewEvents(
  eventName: string,
  userId: string,
  orgId: string,
  properties: Record<string, unknown> = {}
) {
  const posthog = await getPosthogClientServer();
  if (!posthog) {
    console.warn('PostHog not initialized, skipping event tracking');
    return;
  }

  try {
    await posthog.capture({
      distinctId: userId,
      event: eventName,
      properties: {
        ...properties,
        $groups: { organization: orgId },
        timestamp: new Date().toISOString(),
      },
      groups: { organization: orgId },
    });
  } catch (error) {
    console.error(`Failed to track PostHog event '${eventName}':`, error);
  }
}

/**
 * Specialized review event tracking functions
 * These provide a type-safe interface for common review actions
 */
export const reviewEvents = {
  // Core review page events
  reviewPageOpened: async (userId: string, orgId: string, filters?: Record<string, unknown>) =>
    await trackReviewEvents('review_page_opened', userId, orgId, {
      filters_applied: !!filters && Object.keys(filters).length > 0,
      active_filters: filters ? Object.keys(filters) : [],
    }),

  reviewFiltersChanged: async (userId: string, orgId: string, data: {
    filter_type: string;
    old_value: unknown;
    new_value: unknown;
    total_active_filters: number;
  }) =>
    await trackReviewEvents('review_filters_changed', userId, orgId, data),

  // Single transaction correction events
  transactionCorrected: async (userId: string, orgId: string, data: {
    transaction_id: string;
    source: 'pass1' | 'llm';
    old_category_id: string | null;
    new_category_id: string;
    old_confidence: number | null;
    method: 'dropdown' | 'keyboard';
    correction_time_ms?: number;
  }) =>
    await trackReviewEvents('transaction_corrected', userId, orgId, {
      ...data,
      was_correction: data.old_category_id !== data.new_category_id,
      confidence_bucket: data.old_confidence 
        ? data.old_confidence < 0.5 ? 'low' 
          : data.old_confidence < 0.8 ? 'medium' 
          : 'high'
        : 'none',
    }),

  transactionAccepted: async (userId: string, orgId: string, data: {
    transaction_id: string;
    category_id: string | null;
    confidence: number | null;
    method: 'button' | 'keyboard';
  }) =>
    await trackReviewEvents('transaction_accepted', userId, orgId, data),

  // Bulk operations
  bulkSelectionChanged: async (userId: string, orgId: string, data: {
    selected_count: number;
    total_visible: number;
    selection_method: 'checkbox' | 'select_all' | 'keyboard';
  }) =>
    await trackReviewEvents('bulk_selection_changed', userId, orgId, data),

  bulkCorrectionStarted: async (userId: string, orgId: string, data: {
    transaction_count: number;
    target_category_id: string;
    create_rule: boolean;
  }) =>
    await trackReviewEvents('bulk_correction_started', userId, orgId, data),

  bulkCorrectionCompleted: async (userId: string, orgId: string, data: {
    transaction_count: number;
    success_count: number;
    error_count: number;
    rule_created: boolean;
    rule_signature?: string;
    duration_ms: number;
  }) =>
    await trackReviewEvents('bulk_correction_completed', userId, orgId, {
      ...data,
      success_rate: data.success_count / data.transaction_count,
    }),

  // Rule creation events
  ruleCreatedFromCorrection: async (userId: string, orgId: string, data: {
    rule_signature: string;
    category_id: string;
    vendor: string;
    mcc?: string;
    transaction_count: number;
    method: 'single' | 'bulk';
  }) =>
    await trackReviewEvents('rule_created_from_correction', userId, orgId, data),

  ruleUpdated: async (userId: string, orgId: string, data: {
    rule_id: string;
    old_weight: number;
    new_weight: number;
    category_changed: boolean;
  }) =>
    await trackReviewEvents('rule_updated', userId, orgId, data),

  // Receipt attachment events
  receiptUploadStarted: async (userId: string, orgId: string, data: {
    file_type: string;
    file_size: number;
    transaction_ids?: string[];
  }) =>
    await trackReviewEvents('receipt_upload_started', userId, orgId, data),

  receiptAttached: async (userId: string, orgId: string, data: {
    receipt_id: string;
    transaction_ids: string[];
    file_type: string;
    attachment_method: 'drag_drop' | 'button';
  }) =>
    await trackReviewEvents('receipt_attached', userId, orgId, {
      ...data,
      transaction_count: data.transaction_ids.length,
    }),

  // Performance and UX events
  tableVirtualizationPerformance: async (userId: string, orgId: string, data: {
    total_items: number;
    rendered_items: number;
    scroll_performance_ms: number;
    fps?: number;
  }) =>
    await trackReviewEvents('table_virtualization_performance', userId, orgId, data),

  keyboardNavigationUsed: async (userId: string, orgId: string, data: {
    key_combination: string;
    action: string;
    context: 'table' | 'dropdown' | 'modal';
  }) =>
    await trackReviewEvents('keyboard_navigation_used', userId, orgId, data),

  confidencePopoverOpened: async (userId: string, orgId: string, data: {
    transaction_id: string;
    confidence: number;
    source: 'pass1' | 'llm';
    rationale_count: number;
  }) =>
    await trackReviewEvents('confidence_popover_opened', userId, orgId, data),

  // Error and edge case tracking
  reviewError: async (userId: string, orgId: string, data: {
    error_type: string;
    error_message: string;
    context: string;
    transaction_id?: string;
  }) =>
    await trackReviewEvents('review_error', userId, orgId, data),

  apiResponseTime: async (userId: string, orgId: string, data: {
    endpoint: string;
    response_time_ms: number;
    status_code: number;
    items_count?: number;
  }) =>
    await trackReviewEvents('api_response_time', userId, orgId, data),
};

/**
 * Utility function to track timing for operations
 */
export function createTimingTracker() {
  const startTime = performance.now();
  
  return {
    stop: () => performance.now() - startTime,
    track: async (eventName: string, userId: string, orgId: string, additionalProps: Record<string, unknown> = {}) => {
      const duration = performance.now() - startTime;
      await trackReviewEvents(eventName, userId, orgId, {
        ...additionalProps,
        duration_ms: Math.round(duration),
      });
    }
  };
}