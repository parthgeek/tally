// PostHog and Sentry integration for Edge Functions
// Note: These are simple implementations. In production, you might want to use SDKs if available

interface PostHogEvent {
  event: string;
  properties: Record<string, any>;
  distinct_id: string;
  timestamp?: string;
}

interface SentryEvent {
  message: string;
  level: 'info' | 'warning' | 'error' | 'fatal';
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
}

/**
 * Send event to PostHog
 */
export async function trackEvent(event: string, properties: Record<string, any>, userId?: string): Promise<void> {
  const posthogApiKey = Deno.env.get('POSTHOG_API_KEY');
  const posthogHost = Deno.env.get('POSTHOG_HOST') || 'https://app.posthog.com';

  if (!posthogApiKey) {
    console.warn('PostHog tracking skipped - POSTHOG_API_KEY not configured');
    return;
  }

  try {
    const eventData: PostHogEvent = {
      event,
      properties: {
        ...properties,
        $lib: 'nexus-edge-functions',
        $lib_version: '1.0.0',
      },
      distinct_id: userId || 'anonymous',
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${posthogHost}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${posthogApiKey}`,
      },
      body: JSON.stringify({
        api_key: posthogApiKey,
        event: eventData.event,
        properties: eventData.properties,
        distinct_id: eventData.distinct_id,
        timestamp: eventData.timestamp,
      }),
    });

    if (!response.ok) {
      console.error('PostHog tracking failed:', await response.text());
    }
  } catch (error) {
    console.error('PostHog tracking error:', error);
  }
}

/**
 * Send error to Sentry
 */
export async function captureException(
  error: Error | string, 
  level: SentryEvent['level'] = 'error',
  context?: { user?: SentryEvent['user']; tags?: Record<string, string>; extra?: Record<string, any> }
): Promise<void> {
  const sentryDsn = Deno.env.get('SENTRY_DSN');
  
  if (!sentryDsn) {
    console.warn('Sentry error capture skipped - SENTRY_DSN not configured');
    return;
  }

  try {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const eventData: SentryEvent & { exception?: any; stacktrace?: any } = {
      message,
      level,
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
      timestamp: new Date().toISOString(),
    };

    if (stack) {
      eventData.exception = {
        values: [{
          type: error.constructor.name,
          value: message,
          stacktrace: { frames: parseStackTrace(stack) }
        }]
      };
    }

    // Simple Sentry API call - in production, consider using the Sentry SDK
    const response = await fetch(`${getDsnEndpoint(sentryDsn)}/api/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': getSentryAuthHeader(sentryDsn),
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      console.error('Sentry capture failed:', await response.text());
    }
  } catch (captureError) {
    console.error('Sentry capture error:', captureError);
  }
}

function parseStackTrace(stack: string): any[] {
  // Simple stack trace parsing - improve as needed
  return stack.split('\n').map((line, index) => ({
    filename: line.includes('(') ? line.split('(')[1]?.split(':')[0] : 'unknown',
    function: line.includes('at ') ? line.split('at ')[1]?.split(' ')[0] : 'anonymous',
    lineno: index + 1,
  }));
}

function getDsnEndpoint(dsn: string): string {
  // Extract endpoint from DSN - simplified version
  const url = new URL(dsn);
  return `${url.protocol}//${url.host}`;
}

function getSentryAuthHeader(dsn: string): string {
  // Extract auth info from DSN - simplified version
  const url = new URL(dsn);
  const key = url.username;
  const projectId = url.pathname.split('/').pop();
  
  return `Sentry sentry_version=7, sentry_client=nexus-edge-functions/1.0.0, sentry_key=${key}, sentry_secret=`;
}

/**
 * Track Plaid sync metrics
 */
export async function trackPlaidSync(
  connectionId: string,
  operation: 'sync' | 'backfill' | 'webhook',
  result: { success: boolean; inserted?: number; updated?: number; removed?: number; error?: string },
  orgId?: string
): Promise<void> {
  await trackEvent('plaid_sync_completed', {
    connection_id: connectionId,
    operation,
    success: result.success,
    inserted_count: result.inserted || 0,
    updated_count: result.updated || 0,
    removed_count: result.removed || 0,
    error_message: result.error,
  }, orgId);

  if (!result.success && result.error) {
    await captureException(result.error, 'error', {
      tags: {
        operation,
        connection_id: connectionId,
      },
      extra: {
        result,
      },
    });
  }
}

/**
 * Track connection events
 */
export async function trackConnection(
  event: 'connected' | 'disconnected' | 'error',
  connectionId: string,
  provider: string,
  orgId?: string,
  error?: string
): Promise<void> {
  await trackEvent('connection_event', {
    event,
    connection_id: connectionId,
    provider,
    error_message: error,
  }, orgId);

  if (event === 'error' && error) {
    await captureException(error, 'warning', {
      tags: {
        connection_id: connectionId,
        provider,
      },
    });
  }
}

/**
 * Enhanced categorizer metrics tracking
 */

export interface CategorizerMetrics {
  transactionId: string;
  orgId?: string;
  engine: 'pass1' | 'llm' | 'hybrid';
  mode: 'pass1' | 'pass2' | 'hybrid' | 'shadow';
  result: {
    categoryId?: string;
    confidence?: number;
    success: boolean;
    error?: string;
  };
  timing: {
    totalMs: number;
    pass1Ms?: number;
    pass2Ms?: number;
  };
  signals?: Array<{
    type: string;
    evidence: string;
    confidence: number;
    strength: string;
  }>;
  guardrails?: {
    applied: boolean;
    violations: string[];
    preGuardrailsPassed: boolean;
    postGuardrailsPassed: boolean;
  };
  pass1Context?: {
    confidence: number;
    topSignals: string[];
    mccMapping?: string;
    vendorMatch?: string;
  };
  featureFlags?: Record<string, boolean | number>;
}

/**
 * Track categorizer transaction processing
 */
export async function trackCategorizerTransaction(metrics: CategorizerMetrics): Promise<void> {
  const baseProperties = {
    transaction_id: metrics.transactionId,
    engine: metrics.engine,
    mode: metrics.mode,
    success: metrics.result.success,
    category_id: metrics.result.categoryId,
    confidence: metrics.result.confidence,
    total_latency_ms: metrics.timing.totalMs,
    pass1_latency_ms: metrics.timing.pass1Ms,
    pass2_latency_ms: metrics.timing.pass2Ms,
    error_message: metrics.result.error,
  };

  // Track main categorization event
  await trackEvent('categorizer_transaction_processed', baseProperties, metrics.orgId);

  // Track engine-specific metrics
  if (metrics.engine === 'pass1' || metrics.mode === 'hybrid') {
    await trackEvent('categorizer_pass1_execution', {
      ...baseProperties,
      signals_count: metrics.signals?.length || 0,
      top_signal_types: metrics.signals?.slice(0, 3).map(s => s.type) || [],
      pass1_confidence: metrics.pass1Context?.confidence,
      mcc_mapping_used: !!metrics.pass1Context?.mccMapping,
      vendor_match_used: !!metrics.pass1Context?.vendorMatch,
    }, metrics.orgId);
  }

  if (metrics.engine === 'llm' || (metrics.mode === 'hybrid' && metrics.timing.pass2Ms)) {
    await trackEvent('categorizer_llm_execution', {
      ...baseProperties,
      pass1_context_provided: !!metrics.pass1Context,
      pass1_confidence: metrics.pass1Context?.confidence,
      llm_latency_ms: metrics.timing.pass2Ms,
    }, metrics.orgId);
  }

  // Track guardrail metrics
  if (metrics.guardrails) {
    await trackEvent('categorizer_guardrails_executed', {
      ...baseProperties,
      guardrails_applied: metrics.guardrails.applied,
      violations_count: metrics.guardrails.violations.length,
      pre_guardrails_passed: metrics.guardrails.preGuardrailsPassed,
      post_guardrails_passed: metrics.guardrails.postGuardrailsPassed,
      violation_types: metrics.guardrails.violations,
    }, metrics.orgId);
  }

  // Track feature flag usage
  if (metrics.featureFlags) {
    await trackEvent('categorizer_feature_flags_used', {
      ...baseProperties,
      ...metrics.featureFlags,
    }, metrics.orgId);
  }

  // Track errors
  if (!metrics.result.success && metrics.result.error) {
    await captureException(metrics.result.error, 'error', {
      tags: {
        component: 'categorizer',
        engine: metrics.engine,
        mode: metrics.mode,
        transaction_id: metrics.transactionId,
      },
      extra: {
        timing: metrics.timing,
        guardrails: metrics.guardrails,
        pass1Context: metrics.pass1Context,
      },
      user: metrics.orgId ? { id: metrics.orgId } : undefined,
    });
  }
}

/**
 * Track batch categorization metrics
 */
export async function trackCategorizerBatch(
  batchId: string,
  batchMetrics: {
    totalTransactions: number;
    successCount: number;
    errorCount: number;
    pass1OnlyCount: number;
    llmUsedCount: number;
    averageLatencyMs: number;
    averageConfidence: number;
    confidenceHistogram: Array<{ bin: string; count: number }>;
    guardrailViolations: number;
    totalCostUsd?: number;
  },
  orgId?: string
): Promise<void> {
  await trackEvent('categorizer_batch_completed', {
    batch_id: batchId,
    total_transactions: batchMetrics.totalTransactions,
    success_count: batchMetrics.successCount,
    error_count: batchMetrics.errorCount,
    success_rate: batchMetrics.successCount / batchMetrics.totalTransactions,
    pass1_only_count: batchMetrics.pass1OnlyCount,
    llm_used_count: batchMetrics.llmUsedCount,
    pass1_hit_rate: batchMetrics.pass1OnlyCount / batchMetrics.totalTransactions,
    llm_usage_rate: batchMetrics.llmUsedCount / batchMetrics.totalTransactions,
    average_latency_ms: batchMetrics.averageLatencyMs,
    average_confidence: batchMetrics.averageConfidence,
    guardrail_violations: batchMetrics.guardrailViolations,
    total_cost_usd: batchMetrics.totalCostUsd,
  }, orgId);

  // Track confidence distribution
  for (const bin of batchMetrics.confidenceHistogram) {
    if (bin.count > 0) {
      await trackEvent('categorizer_confidence_distribution', {
        batch_id: batchId,
        confidence_bin: bin.bin,
        transaction_count: bin.count,
        percentage_of_batch: (bin.count / batchMetrics.totalTransactions) * 100,
      }, orgId);
    }
  }
}

/**
 * Track categorizer engine performance over time
 */
export async function trackCategorizerPerformance(
  timeWindow: string, // e.g., 'hourly', 'daily'
  performanceMetrics: {
    totalTransactions: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    errorRate: number;
    pass1HitRate: number;
    llmUsageRate: number;
    averageConfidence: number;
    confidenceVariance: number;
    guardrailEffectiveness: number; // % of violations caught
    costPerTransaction?: number;
  },
  orgId?: string
): Promise<void> {
  await trackEvent('categorizer_performance_summary', {
    time_window: timeWindow,
    ...performanceMetrics,
  }, orgId);
}

/**
 * Track A/B test metrics for categorizer improvements
 */
export async function trackCategorizerABTest(
  testName: string,
  variant: 'control' | 'treatment',
  transactionId: string,
  metrics: {
    categoryId?: string;
    confidence?: number;
    latencyMs: number;
    accuracy?: number; // If ground truth available
    userSatisfaction?: number; // If feedback available
  },
  orgId?: string
): Promise<void> {
  await trackEvent('categorizer_ab_test_result', {
    test_name: testName,
    variant,
    transaction_id: transactionId,
    category_id: metrics.categoryId,
    confidence: metrics.confidence,
    latency_ms: metrics.latencyMs,
    accuracy: metrics.accuracy,
    user_satisfaction: metrics.userSatisfaction,
  }, orgId);
}

/**
 * Track categorizer shadow mode comparison
 */
export async function trackCategorizerShadowMode(
  transactionId: string,
  comparison: {
    legacyCategoryId?: string;
    legacyConfidence?: number;
    newCategoryId?: string;
    newConfidence?: number;
    categoriesMatch: boolean;
    confidenceDelta: number;
    latencyDelta: number;
  },
  orgId?: string
): Promise<void> {
  await trackEvent('categorizer_shadow_mode_comparison', {
    transaction_id: transactionId,
    legacy_category_id: comparison.legacyCategoryId,
    legacy_confidence: comparison.legacyConfidence,
    new_category_id: comparison.newCategoryId,
    new_confidence: comparison.newConfidence,
    categories_match: comparison.categoriesMatch,
    confidence_delta: comparison.confidenceDelta,
    latency_delta: comparison.latencyDelta,
  }, orgId);
}