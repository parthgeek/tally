# Categorizer Lab Architecture

## System Overview

The Categorizer Lab is built as a comprehensive testing platform for transaction categorization, designed with a modular architecture that supports multiple categorization approaches, real-time performance monitoring, and extensive debugging capabilities.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Next.js)                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Lab Interface │  │   Metrics       │  │   Charts &      │ │
│  │   - Controls    │  │   Dashboard     │  │   Visualizations│ │
│  │   - Dataset     │  │   - Accuracy    │  │   - Confidence  │ │
│  │   - Results     │  │   - Performance │  │   - Timing      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   /run          │  │   /health       │  │   Middleware    │ │
│  │   - Execute     │  │   - Status      │  │   - Auth        │ │
│  │   - Validate    │  │   - Features    │  │   - Rate Limit  │ │
│  │   - Metrics     │  │   - Config      │  │   - Logging     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              Categorizer Engine (@nexus/categorizer)       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Pass-1        │  │   Pass-2        │  │   Hybrid        │ │
│  │   Rules Engine  │  │   LLM Engine    │  │   Orchestrator  │ │
│  │   - Keywords    │  │   - Gemini API  │  │   - Threshold   │ │
│  │   - MCC Codes   │  │   - Prompts     │  │   - Fallback    │ │
│  │   - Vendors     │  │   - Parsing     │  │   - Confidence  │ │
│  │   - Patterns    │  │   - Validation  │  │   - Selection   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                External Services & Storage                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Gemini API    │  │   Analytics     │  │   Monitoring    │ │
│  │   - LLM Calls   │  │   - PostHog     │  │   - Sentry      │ │
│  │   - Embeddings  │  │   - Events      │  │   - Langfuse    │ │
│  │   - Completions │  │   - Metrics     │  │   - Logs        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer

#### Main Interface (`apps/web/src/app/(dev)/categorizer-lab/`)

**Client Component** (`client.tsx`):
```typescript
export default function CategorizerLabClient() {
  const [results, setResults] = useState<LabRunResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('');

  // Handles test execution and real-time updates
  const handleRunTest = useCallback(async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/dev/categorizer-lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      setResults(data);
    } finally {
      setIsRunning(false);
    }
  }, [dataset, options]);
}
```

**Key Features**:
- Real-time progress indicators
- Interactive dataset management
- Live configuration updates
- Responsive design for various screen sizes

#### Component Architecture

**Results Table** (`results-table.tsx`):
```typescript
interface ResultsTableProps {
  results: TransactionResult[];
  groundTruth?: LabTransaction[];
}

export function ResultsTable({ results, groundTruth }: ResultsTableProps) {
  return (
    <Table>
      {results.map((result) => (
        <TableRow key={result.id}>
          <TableCell>{result.id}</TableCell>
          <TableCell>
            <ConfidenceIndicator confidence={result.confidence} />
          </TableCell>
          <TableCell>
            <RationalePopover rationale={result.rationale} />
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
```

**Metrics Dashboard** (`metrics-summary.tsx`):
- Performance statistics (latency, throughput)
- Accuracy measurements (precision, recall, F1)
- Confidence distribution analysis
- Cost estimation for LLM usage

**Charts & Visualizations** (`charts.tsx`):
- Confidence distribution histograms
- Accuracy heatmaps by category
- Performance timing analysis
- Error rate trending

### 2. API Layer

#### Main Endpoint (`apps/web/src/app/api/dev/categorizer-lab/run/route.ts`)

**Request Processing Pipeline**:
```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Security & Feature Flags
  if (!isCategorizerLabEnabled()) {
    return NextResponse.json(
      { error: 'Categorizer lab is not available' },
      { status: 404 }
    );
  }

  // 2. Request Validation
  const validatedRequest = labRunRequestSchema.parse(body) as LabRunRequest;
  const { dataset, options } = validatedRequest;

  // 3. Processing Loop
  const results: TransactionResult[] = [];
  const errors: string[] = [];

  for (const labTx of dataset) {
    try {
      // 4. Transaction Normalization
      const normalizedTx = mapLabTransactionToNormalized(labTx, labOrgId);

      // 5. Categorization Execution
      const categorizationResult = await executeCategorization(
        normalizedTx,
        options,
        ctx
      );

      // 6. Result Mapping
      const result = mapCategorizationResultToLab(
        labTx.id,
        categorizationResult,
        engine,
        timings
      );

      results.push(result);
    } catch (error) {
      handleCategorizationError(error, labTx, results, errors);
    }
  }

  // 7. Metrics Calculation
  const metrics = calculateMetrics(dataset, results);

  // 8. Response Generation
  return NextResponse.json({
    results,
    metrics,
    status: determineOverallStatus(errors),
    errors,
  });
}
```

**Categorization Mode Handler**:
```typescript
async function executeCategorization(
  normalizedTx: NormalizedTransaction,
  options: LabRunOptions,
  ctx: CategorizationContext
) {
  switch (options.mode) {
    case 'pass1':
      return await executePass1Only(normalizedTx, ctx);

    case 'pass2':
      return await executePass2Only(normalizedTx, ctx);

    case 'hybrid':
      return await executeHybridApproach(normalizedTx, options, ctx);

    default:
      throw new Error(`Unsupported engine mode: ${options.mode}`);
  }
}
```

#### Health Check Endpoint (`health/route.ts`)

**System Status Monitoring**:
```typescript
export async function GET(): Promise<NextResponse> {
  if (!isCategorizerLabEnabled()) {
    return NextResponse.json(
      { available: false, message: 'Lab is disabled' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    available: true,
    message: 'Categorizer lab is available',
    features: {
      pass1: true,
      pass2: !!process.env.GEMINI_API_KEY,
      hybrid: !!process.env.GEMINI_API_KEY,
    },
    version: packageInfo.version,
    environment: process.env.NODE_ENV,
  });
}
```

### 3. Categorizer Engine

#### Enhanced Pass-1 Engine (`packages/categorizer/src/engine/pass1.ts`)

**Rule-Based Categorization**:
```typescript
export async function pass1Categorize(
  tx: NormalizedTransaction,
  ctx: Pass1Context
): Promise<EnhancedCategorizationResult> {

  // 1. Signal Collection
  const signals: CategorizationSignal[] = [];

  // Keyword matching
  const keywordSignals = await matchKeywordRules(tx, ctx);
  signals.push(...keywordSignals);

  // MCC code analysis
  const mccSignal = getMCCSignal(tx.mcc);
  if (mccSignal) signals.push(mccSignal);

  // Vendor pattern matching
  const vendorSignals = matchVendorPatterns(tx);
  signals.push(...vendorSignals);

  // 2. Signal Scoring
  const scores = scoreSignals(signals, ctx.categoryWeights);

  // 3. Guardrail Application
  const guardrailResult = applyGuardrails(scores, tx, ctx);

  // 4. Confidence Calibration
  const calibratedResult = calibrateConfidence(guardrailResult, ctx);

  return calibratedResult;
}
```

**Signal Types**:
- **Keyword Signals**: Text pattern matching with domain-specific rules
- **MCC Signals**: Merchant Category Code mapping
- **Vendor Signals**: Known merchant pattern recognition
- **Amount Signals**: Transaction size pattern analysis

#### Pass-2 LLM Engine (`packages/categorizer/src/pass2_llm.ts`)

**LLM Integration Architecture**:
```typescript
export async function scoreWithLLM(
  tx: NormalizedTransaction,
  ctx: CategorizationContext & { config?: LLMConfig }
): Promise<LLMCategorizationResult> {

  // 1. Client Initialization
  const geminiClient = new GeminiClient({
    apiKey: ctx.config?.geminiApiKey || process.env.GEMINI_API_KEY,
    model: ctx.config?.model || 'gemini-2.5-flash-lite'
  });

  // 2. Context Preparation
  const priorContext = await fetchPriorCategoryContext(tx, ctx);

  // 3. Prompt Engineering
  const prompt = buildCategorizationPrompt(tx, priorContext);

  // 4. LLM Execution with Monitoring
  const generation = startLangfuseTrace(tx, ctx);
  const startTime = Date.now();

  try {
    const response = await geminiClient.generateContent(prompt);
    const latency = Date.now() - startTime;

    // 5. Response Parsing & Validation
    const parsed = parseLLMResponse(response.text);
    const categoryId = mapCategorySlugToId(parsed.category_slug);

    // 6. Success Metrics
    recordSuccessMetrics(ctx, tx, parsed, latency, response.usage);
    generation.end({ output: parsed, usage: response.usage });

    return {
      categoryId,
      confidence: parsed.confidence,
      rationale: [
        `LLM: ${parsed.rationale}`,
        `Model: ${geminiClient.getModelName()} (${latency}ms)`
      ]
    };

  } catch (error) {
    // 7. Error Handling & Fallback
    recordErrorMetrics(ctx, tx, error);
    generation.end({ error: error.message });

    return createFallbackResult();
  }
}
```

**Prompt Engineering Strategy**:
```typescript
function buildCategorizationPrompt(
  tx: NormalizedTransaction,
  priorContext?: string
): string {
  return `You are a financial categorization expert for salon businesses. Always respond with valid JSON only.

Categorize this business transaction for a salon:

Transaction Details:
- Merchant: ${tx.merchantName || 'Unknown'}
- Description: ${trimDescription(tx.description)}
- Amount: $${formatAmount(tx.amountCents)}
- MCC: ${tx.mcc || 'Not provided'}
- Industry: salon
${priorContext ? `- Prior category: ${priorContext}` : ''}

Available categories:
Revenue: hair_services, nail_services, skin_care, massage, product_sales, gift_cards
Expenses: rent_utilities, supplies, equipment, staff_wages, marketing, professional_services, insurance, licenses, training, software, bank_fees, travel, office_supplies, other_expenses

Return JSON only:
{
  "category_slug": "most_appropriate_category",
  "confidence": 0.85,
  "rationale": "Brief explanation of why this category fits"
}

Choose the most specific category that matches. If uncertain, use a broader category with lower confidence.`;
}
```

#### Hybrid Orchestrator

**Intelligent Mode Selection**:
```typescript
async function executeHybridApproach(
  tx: NormalizedTransaction,
  options: LabRunOptions,
  ctx: CategorizationContext
): Promise<CategorizationResult> {

  // 1. Pass-1 Attempt
  const pass1Result = await enhancedPass1Categorize(tx, createPass1Context(ctx));
  const threshold = options.hybridThreshold || 0.85;

  // 2. Confidence-Based Decision
  if (pass1Result.confidence && pass1Result.confidence >= threshold) {
    // High confidence - use Pass-1 result
    return {
      categoryId: pass1Result.categoryId,
      confidence: pass1Result.confidence,
      rationale: [
        ...pass1Result.rationale,
        `Pass-1 confidence (${pass1Result.confidence}) >= threshold (${threshold})`
      ],
      engine: 'pass1',
      signals: pass1Result.signals
    };
  }

  // 3. Low Confidence - Escalate to LLM
  const llmResult = await scoreWithLLM(tx, ctx);

  return {
    categoryId: llmResult.categoryId,
    confidence: llmResult.confidence,
    rationale: [
      `Pass-1 confidence (${pass1Result.confidence || 'unknown'}) < threshold (${threshold})`,
      ...llmResult.rationale
    ],
    engine: 'llm',
    escalationReason: 'low_confidence'
  };
}
```

## Data Flow Architecture

### 1. Transaction Processing Pipeline

```
Input Transaction
       │
       ▼
┌─────────────────┐
│   Validation    │ ── Schema validation, type checking
│   & Parsing     │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  Normalization  │ ── Convert to standard format
│                 │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Mode Selection  │ ── pass1/pass2/hybrid decision
│                 │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Categorization  │ ── Execute chosen approach
│   Execution     │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Result Mapping  │ ── Convert to lab format
│ & Validation    │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Metrics Calc    │ ── Performance & accuracy metrics
│ & Response      │
└─────────────────┘
```

### 2. Signal Processing (Pass-1)

```
Normalized Transaction
       │
       ▼
┌─────────────────┐
│ Signal          │ ── Multiple parallel extractors
│ Extraction      │
└─────────────────┘
       │
       ├─── Keyword Signals
       ├─── MCC Signals
       ├─── Vendor Signals
       └─── Amount Signals
       │
       ▼
┌─────────────────┐
│ Signal Scoring  │ ── Weight application & ranking
│                 │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Guardrail       │ ── Business rule validation
│ Application     │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Confidence      │ ── Final confidence calibration
│ Calibration     │
└─────────────────┘
```

### 3. LLM Processing (Pass-2)

```
Normalized Transaction
       │
       ▼
┌─────────────────┐
│ Context         │ ── Prior category lookup, history
│ Preparation     │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Prompt          │ ── Dynamic prompt construction
│ Engineering     │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ LLM API Call    │ ── Gemini API with monitoring
│                 │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Response        │ ── JSON parsing & validation
│ Processing      │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Category        │ ── Slug to ID mapping
│ Mapping         │
└─────────────────┘
```

## State Management

### 1. Frontend State Architecture

**React State Management**:
```typescript
interface LabState {
  // Test execution state
  isRunning: boolean;
  results: LabRunResponse | null;
  errors: string[];

  // Configuration state
  selectedMode: 'pass1' | 'pass2' | 'hybrid';
  hybridThreshold: number;
  selectedScenario: string;

  // Dataset state
  customDataset: LabTransaction[];
  currentDataset: LabTransaction[];

  // UI state
  activeTab: string;
  expandedResults: Set<string>;
  sortConfig: SortConfig;
}
```

**State Management Patterns**:
- **Local State**: Component-specific UI state using `useState`
- **Derived State**: Computed values using `useMemo`
- **Effect Management**: Side effects using `useEffect` and `useCallback`
- **Performance**: Memoization for expensive calculations

### 2. Server State Management

**API Route State**:
```typescript
interface ProcessingState {
  // Request context
  orgId: string;
  requestId: string;
  startTime: number;

  // Processing state
  currentTransaction: number;
  totalTransactions: number;
  errors: string[];

  // Results accumulation
  results: TransactionResult[];
  timings: ProcessingTimings;

  // Resource management
  llmCallsUsed: number;
  rateLimitStatus: RateLimitState;
}
```

## Performance Optimizations

### 1. Frontend Optimizations

**Component Performance**:
```typescript
// Memoized expensive calculations
const processedMetrics = useMemo(() => {
  if (!results?.metrics) return null;
  return calculateDerivedMetrics(results.metrics);
}, [results?.metrics]);

// Memoized components
const MemoizedResultsTable = memo(ResultsTable, (prev, next) => {
  return prev.results.length === next.results.length &&
         prev.results.every((r, i) => r.id === next.results[i]?.id);
});

// Optimized event handlers
const handleResultClick = useCallback((resultId: string) => {
  setExpandedResults(prev => {
    const next = new Set(prev);
    if (next.has(resultId)) {
      next.delete(resultId);
    } else {
      next.add(resultId);
    }
    return next;
  });
}, []);
```

**Data Loading Strategies**:
- **Lazy Loading**: Load test scenarios on demand
- **Pagination**: Large result sets with virtual scrolling
- **Caching**: Cache API responses for repeated queries
- **Prefetching**: Preload common test scenarios

### 2. Backend Optimizations

**Processing Optimizations**:
```typescript
// Parallel processing for independent operations
const results = await Promise.allSettled(
  dataset.map(async (tx) => {
    return processSingleTransaction(tx, ctx);
  })
);

// Streaming responses for large datasets
export async function* streamResults(dataset: LabTransaction[]) {
  for (const transaction of dataset) {
    const result = await processTransaction(transaction);
    yield { type: 'result', data: result };
  }

  const metrics = calculateFinalMetrics();
  yield { type: 'complete', data: metrics };
}
```

**Caching Strategy**:
```typescript
// LRU cache for repeated categorizations
const categorizationCache = new LRUCache<string, CategorizationResult>({
  max: 1000,
  ttl: 1000 * 60 * 60 // 1 hour
});

// Cache key generation
function getCacheKey(tx: NormalizedTransaction, mode: string): string {
  return `${mode}:${tx.merchantName}:${tx.description}:${tx.amountCents}`;
}
```

## Security Architecture

### 1. Authentication & Authorization

**Feature Flag Security**:
```typescript
export function isCategorizerLabEnabled(): boolean {
  // Environment-based feature flagging
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_CATEGORIZER_LAB_ENABLED === 'true';
  }

  // Always enabled in development
  return true;
}
```

**API Security**:
```typescript
// Rate limiting per session
const rateLimiter = new Map<string, RateLimitState>();

export async function checkRateLimit(sessionId: string): Promise<boolean> {
  const limit = rateLimiter.get(sessionId) || { count: 0, resetTime: Date.now() + 60000 };

  if (Date.now() > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = Date.now() + 60000;
  }

  if (limit.count >= 100) { // 100 requests per minute
    return false;
  }

  limit.count++;
  rateLimiter.set(sessionId, limit);
  return true;
}
```

### 2. Data Protection

**Input Sanitization**:
```typescript
// Zod-based validation with sanitization
const labRunRequestSchema = z.object({
  dataset: z.array(labTransactionSchema).max(1000), // Limit dataset size
  options: z.object({
    mode: z.enum(['pass1', 'pass2', 'hybrid']),
    hybridThreshold: z.number().min(0).max(1).optional(),
  })
}).transform((data) => ({
  ...data,
  dataset: data.dataset.map(sanitizeTransaction)
}));
```

**API Key Management**:
```typescript
// Secure API key handling
function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('test-')) {
    throw new Error('Valid GEMINI_API_KEY required for LLM operations');
  }
  return apiKey;
}
```

## Monitoring & Observability

### 1. Performance Monitoring

**Metrics Collection**:
```typescript
interface PerformanceMetrics {
  // Response time metrics
  latency: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
  };

  // Throughput metrics
  requestsPerSecond: number;
  transactionsPerSecond: number;

  // Resource utilization
  memoryUsage: number;
  cpuUsage: number;

  // Error rates
  errorRate: number;
  timeoutRate: number;
}
```

**Real-time Monitoring**:
```typescript
// Performance tracking middleware
export function withPerformanceTracking<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return fn()
    .then(result => {
      const latency = Date.now() - startTime;
      analytics.captureEvent('operation_performance', {
        operation,
        latency,
        success: true
      });
      return result;
    })
    .catch(error => {
      const latency = Date.now() - startTime;
      analytics.captureEvent('operation_performance', {
        operation,
        latency,
        success: false,
        error: error.message
      });
      throw error;
    });
}
```

### 2. Error Tracking

**Structured Error Handling**:
```typescript
interface ErrorContext {
  operation: string;
  transactionId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  additionalContext?: Record<string, any>;
}

export function captureError(error: Error, context: ErrorContext): void {
  // Sentry integration
  Sentry.captureException(error, {
    tags: {
      operation: context.operation,
      component: 'categorizer-lab'
    },
    extra: context
  });

  // PostHog analytics
  analytics.captureEvent('error_occurred', {
    error_type: error.constructor.name,
    error_message: error.message,
    ...context
  });

  // Custom logging
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    ...context
  });
}
```

This architecture provides a robust, scalable foundation for the Categorizer Lab while maintaining excellent performance, security, and observability characteristics.