# Milestone 5 Implementation Plan: Review UI + Corrections

## Overview
This milestone implements a high-performance transaction review interface with inline corrections, bulk operations, and analytics tracking. The implementation follows established patterns from the existing codebase and maintains consistency with architectural decisions.

## Prerequisites Verification
- ✅ M3 tables exist: `decisions`, `corrections`, `rules`, `transactions.needs_review`
- ✅ Categories seeded and dashboard working
- ✅ PostHog and Langfuse analytics infrastructure present

## Architecture Decisions

### 1. Technology Stack
- **Frontend**: Next.js 14 App Router + React 18
- **State Management**: TanStack Query v5 for server state
- **UI Components**: Radix UI + Tailwind CSS (existing shadcn/ui pattern)
- **Table Virtualization**: `@tanstack/react-virtual` for performance
- **Database**: Supabase with RLS policies
- **Analytics**: PostHog (client + server) + Langfuse for LLM traces

### 2. API Design Patterns
Following existing patterns from `apps/web/src/app/api/`:
- Use `withOrgFromRequest()` for auth and org context
- Zod schemas for request/response validation  
- Consistent error handling with `createErrorResponse()`
- TypeScript contracts in `@nexus/types`

### 3. Database Strategy
- Leverage existing schema from `006_categorization_v0.sql`
- Add recommended indexes for performance
- Maintain RLS policies for multi-tenancy
- Use database transactions for consistency

## Implementation Plan

### Phase 1: Database Optimizations
**Files**: `packages/db/migrations/009_review_optimization.sql`

```sql
-- Performance indexes for review queue
CREATE INDEX IF NOT EXISTS tx_needs_review_idx 
ON transactions(org_id, needs_review, date DESC, confidence ASC) 
WHERE needs_review = true;

-- Prevent duplicate rules
CREATE UNIQUE INDEX IF NOT EXISTS rules_sig_uniq 
ON rules(org_id, (pattern->>'vendor'), (pattern->>'mcc')) 
WHERE pattern ? 'vendor';

-- Optimize decisions lookup
CREATE INDEX IF NOT EXISTS decisions_tx_latest_idx 
ON decisions(tx_id, created_at DESC);

-- Optimize corrections tracking
CREATE INDEX IF NOT EXISTS corrections_org_user_idx 
ON corrections(org_id, user_id, created_at DESC);
```

### Phase 2: Type Definitions and Contracts
**Files**: `packages/types/src/review.ts`

```typescript
// Review API contracts
export interface ReviewListRequest {
  cursor?: string;
  limit?: number;
  filter?: {
    needsReviewOnly?: boolean;
    minConfidence?: number;
  };
}

export interface ReviewTransactionItem {
  id: TransactionId;
  date: string;
  merchant_name: string | null;
  description: string;
  amount_cents: string;
  category_id: CategoryId | null;
  category_name: string | null;
  confidence: number | null;
  needs_review: boolean;
  why: string[]; // Top 2 rationale strings
}

export interface ReviewListResponse {
  items: ReviewTransactionItem[];
  nextCursor?: string;
}

// Correction contracts
export interface TransactionBulkCorrectRequest {
  tx_ids: string[];
  new_category_id: string;
}

export interface RuleUpsertRequest {
  vendor: string;
  mcc?: string;
  category_id: string;
  description?: string;
}
```

### Phase 3: Review Queue API
**Files**: `apps/web/src/app/api/review/route.ts`

**Key Features**:
- Cursor-based pagination for performance
- Join categories for display names
- Include latest decision rationale 
- Optimized query with proper indexing
- Filtering by review status and confidence

```typescript
export async function GET(request: NextRequest) {
  const { orgId } = await withOrgFromRequest(request);
  
  // Parse query params with validation
  const url = new URL(request.url);
  const validatedRequest = reviewListRequestSchema.parse({
    cursor: url.searchParams.get("cursor") || undefined,
    limit: parseInt(url.searchParams.get("limit") || "100"),
    filter: {
      needsReviewOnly: url.searchParams.get("needsReviewOnly") === "true",
      minConfidence: parseFloat(url.searchParams.get("minConfidence") || "0"),
    }
  });

  // Optimized query with joins
  let query = supabase
    .from('transactions')
    .select(`
      id, date, merchant_name, description, amount_cents,
      category_id, confidence, needs_review,
      categories(name),
      decisions!inner(rationale)
    `)
    .eq('org_id', orgId)
    .order('date', { ascending: false })
    .order('confidence', { ascending: true });

  // Apply filters
  if (validatedRequest.filter?.needsReviewOnly) {
    query = query.eq('needs_review', true);
  }
  
  // Execute with cursor pagination
  // Transform results with rationale extraction
  // Return formatted response
}
```

### Phase 4: Correction Endpoints
**Files**: 
- `apps/web/src/app/api/transactions/bulk-correct/route.ts`
- `apps/web/src/app/api/rules/upsert-signature/route.ts`
- Update existing `apps/web/src/app/api/transactions/correct/route.ts`

**Enhanced Correction Logic**:
```typescript
// Single correction (enhance existing)
export async function POST(request: NextRequest) {
  // 1. Validate and load transaction
  // 2. Update transaction with optimistic locking
  // 3. Insert correction audit record  
  // 4. Generate rule signature and upsert
  // 5. Track analytics (PostHog + Langfuse)
  // 6. Return success response
}

// Bulk correction (new)
export async function POST(request: NextRequest) {
  const { tx_ids, new_category_id } = await validateRequest();
  
  // Use database transaction for atomicity
  const { data, error } = await supabase.rpc('bulk_correct_transactions', {
    p_tx_ids: tx_ids,
    p_new_category_id: new_category_id,
    p_org_id: orgId,
    p_user_id: userId
  });
  
  // Track bulk analytics event
  await trackBulkCorrection(tx_ids.length, old_category, new_category);
}
```

### Phase 5: React Components Architecture

#### 5.1 Main Review Page
**Files**: `apps/web/src/app/(app)/review/page.tsx`

```typescript
export default function ReviewPage() {
  const [filters, setFilters] = useState<ReviewFilters>();
  const [selectedRows, setSelectedRows] = useState<Set<string>>();
  
  // Infinite query for performance
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['review', filters],
    queryFn: ({ pageParam }) => fetchReviewData(pageParam, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  return (
    <div className="space-y-6">
      <ReviewHeader />
      <ReviewFilters filters={filters} onChange={setFilters} />
      <ReviewTable 
        data={data} 
        selectedRows={selectedRows}
        onSelectRows={setSelectedRows}
        onLoadMore={fetchNextPage}
      />
      <BulkActionBar 
        selectedCount={selectedRows.size}
        onBulkAction={handleBulkAction}
      />
    </div>
  );
}
```

#### 5.2 Virtualized Table Component
**Files**: `apps/web/src/components/review/review-table.tsx`

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export function ReviewTable({ data, selectedRows, onSelectRows }) {
  const parentRef = useRef<HTMLDivElement>();
  
  const virtualizer = useVirtualizer({
    count: data?.pages.flatMap(p => p.items).length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Row height
    overscan: 10,
  });

  // Keyboard navigation
  const { selectedIndex, handleKeyDown } = useKeyboardNavigation({
    totalItems: data?.pages.flatMap(p => p.items).length ?? 0,
    onEdit: handleInlineEdit,
    onAccept: handleAcceptAsIs,
    onAttach: handleAttachReceipt,
  });

  return (
    <div 
      ref={parentRef}
      className="h-[600px] overflow-auto border rounded-lg"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <ReviewTableRow
            key={virtualItem.key}
            virtualItem={virtualItem}
            transaction={items[virtualItem.index]}
            isSelected={selectedRows.has(items[virtualItem.index].id)}
            onSelect={onSelectRows}
            onEdit={handleInlineEdit}
          />
        ))}
      </div>
    </div>
  );
}
```

#### 5.3 Inline Editing Components
**Files**: 
- `apps/web/src/components/review/category-cell.tsx`
- `apps/web/src/components/review/bulk-action-bar.tsx`

```typescript
// Category combobox with autocomplete
export function CategoryCell({ transaction, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: categories } = useQuery(['categories']);
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="justify-start">
          {transaction.category_name || "Uncategorized"}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            {categories?.map((category) => (
              <CommandItem
                key={category.id}
                onSelect={() => handleCategorySelect(category)}
              >
                {category.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Bulk action bar
export function BulkActionBar({ selectedCount, onBulkAction }) {
  if (selectedCount === 0) return null;
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white border shadow-lg rounded-lg p-4">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium">
          {selectedCount} transactions selected
        </span>
        <Button onClick={() => onBulkAction('accept')}>
          Accept All
        </Button>
        <Button onClick={() => onBulkAction('categorize')}>
          Always Categorize Like This
        </Button>
        <Button variant="outline" onClick={() => onBulkAction('clear')}>
          Clear Selection
        </Button>
      </div>
    </div>
  );
}
```

#### 5.4 "Why?" Information Component
**Files**: `apps/web/src/components/review/why-popover.tsx`

```typescript
export function WhyPopover({ transaction, decision }) {
  const confidenceColor = getConfidenceColor(decision?.confidence);
  const reasonText = extractRationale(decision?.rationale);
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Badge className={confidenceColor}>
            {Math.round((decision?.confidence ?? 0) * 100)}%
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">Why this category?</h4>
            <p className="text-sm text-muted-foreground">
              Confidence: {Math.round((decision?.confidence ?? 0) * 100)}%
            </p>
          </div>
          
          <div className="space-y-2">
            {reasonText.map((reason, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <p className="text-sm">{reason}</p>
              </div>
            ))}
          </div>
          
          {decision?.source === 'pass1' && (
            <div className="text-xs text-muted-foreground">
              Based on rule: MCC {transaction.mcc}, vendor pattern
            </div>
          )}
          
          {decision?.source === 'llm' && (
            <div className="text-xs text-muted-foreground">
              AI categorization using transaction context
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Phase 6: Receipt Management (Stub for M6)
**Files**: `apps/web/src/app/api/receipts/upload/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { orgId } = await withOrgFromRequest(request);
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  // Validate file type and size
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
    return createErrorResponse("Invalid file type", 400);
  }
  
  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const year = new Date().getFullYear();
  const storagePath = `receipts/${orgId}/${year}/${fileName}`;
  
  // Upload to Supabase Storage
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(storagePath, file);
    
  if (error) {
    return createErrorResponse("Upload failed", 500);
  }
  
  // Create receipt record
  const { data: receipt, error: dbError } = await supabase
    .from('receipts')
    .insert({
      org_id: orgId,
      storage_path: storagePath,
      // OCR processing can be added in M6
    })
    .select('id')
    .single();
    
  return Response.json({ 
    id: receipt.id,
    url: data.path 
  });
}
```

### Phase 7: Analytics Integration

#### 7.1 Langfuse Tracking
**Files**: `apps/web/src/lib/analytics/correction-tracking.ts`

```typescript
import { getLangfuse } from '@nexus/analytics/server';

export async function trackCorrectionOutcome(
  txId: string,
  oldCategoryId: string | null,
  newCategoryId: string,
  confidence: number | null,
  source: 'pass1' | 'llm',
  llmTraceId?: string
) {
  const langfuse = getLangfuse();
  if (!langfuse) return;
  
  try {
    const wasCorrect = oldCategoryId === newCategoryId;
    
    // Create or update trace with outcome
    if (llmTraceId) {
      // Link to existing LLM trace
      const trace = langfuse.trace({ id: llmTraceId });
      await trace.score({
        name: 'categorization_accuracy',
        value: wasCorrect ? 1 : 0,
        metadata: {
          tx_id: txId,
          confidence,
          source,
          old_category: oldCategoryId,
          new_category: newCategoryId,
        }
      });
    } else {
      // Create new trace for pass1 corrections
      await langfuse.trace({
        name: 'categorization_outcome',
        metadata: {
          tx_id: txId,
          source,
          accuracy: wasCorrect ? 1 : 0,
          confidence,
        }
      });
    }
  } catch (error) {
    console.error('Failed to track correction outcome:', error);
  }
}
```

#### 7.2 PostHog Events
**Files**: `apps/web/src/lib/analytics/review-events.ts`

```typescript
import { getPosthogClientServer } from '@nexus/analytics/server';

export async function trackReviewEvents(
  eventName: string,
  userId: string,
  orgId: string,
  properties: Record<string, any>
) {
  const posthog = await getPosthogClientServer();
  if (!posthog) return;
  
  try {
    await posthog.capture({
      distinctId: userId,
      event: eventName,
      properties: {
        ...properties,
        $groups: { organization: orgId },
      }
    });
  } catch (error) {
    console.error('Failed to track PostHog event:', error);
  }
}

// Specific event tracking functions
export const reviewEvents = {
  reviewOpened: (userId: string, orgId: string) =>
    trackReviewEvents('review_opened', userId, orgId, {}),
    
  transactionCorrected: (userId: string, orgId: string, data: {
    source: string;
    confidence: number;
    newCategory: string;
  }) =>
    trackReviewEvents('tx_corrected', userId, orgId, data),
    
  bulkRuleCreated: (userId: string, orgId: string, data: {
    vendor: string;
    count: number;
  }) =>
    trackReviewEvents('bulk_rule_created', userId, orgId, data),
    
  receiptAttached: (userId: string, orgId: string, data: {
    ext: string;
  }) =>
    trackReviewEvents('receipt_attached', userId, orgId, data),
};
```

### Phase 8: Performance Optimizations

#### 8.1 Database Function for Bulk Operations
**Files**: `packages/db/migrations/010_bulk_functions.sql`

```sql
-- Bulk correction function for atomicity
CREATE OR REPLACE FUNCTION bulk_correct_transactions(
  p_tx_ids uuid[],
  p_new_category_id uuid,
  p_org_id uuid,
  p_user_id uuid
) RETURNS TABLE(corrected_count int, rule_signature text) AS $$
DECLARE
  tx_count int;
  vendor_name text;
  mcc_code text;
  normalized_vendor text;
BEGIN
  -- Update transactions
  UPDATE transactions 
  SET 
    category_id = p_new_category_id,
    reviewed = true,
    needs_review = false
  WHERE 
    id = ANY(p_tx_ids) 
    AND org_id = p_org_id;
    
  GET DIAGNOSTICS tx_count = ROW_COUNT;
  
  -- Insert correction records
  INSERT INTO corrections (org_id, tx_id, old_category_id, new_category_id, user_id)
  SELECT 
    p_org_id,
    t.id,
    t.category_id,
    p_new_category_id,
    p_user_id
  FROM transactions t
  WHERE t.id = ANY(p_tx_ids);
  
  -- Generate rule for most common vendor
  SELECT 
    merchant_name,
    mcc,
    normalize_vendor(merchant_name) as normalized
  INTO vendor_name, mcc_code, normalized_vendor
  FROM transactions 
  WHERE id = ANY(p_tx_ids) 
    AND merchant_name IS NOT NULL
  GROUP BY merchant_name, mcc, normalize_vendor(merchant_name)
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- Upsert rule if we found a vendor
  IF normalized_vendor IS NOT NULL THEN
    INSERT INTO rules (org_id, pattern, category_id, weight)
    VALUES (
      p_org_id,
      jsonb_build_object('vendor', normalized_vendor, 'mcc', mcc_code),
      p_new_category_id,
      tx_count
    )
    ON CONFLICT (org_id, (pattern->>'vendor'), (pattern->>'mcc'))
    DO UPDATE SET weight = rules.weight + tx_count;
  END IF;
  
  RETURN QUERY SELECT tx_count, normalized_vendor;
END;
$$ LANGUAGE plpgsql;
```

#### 8.2 Client-Side Optimizations
- Implement optimistic updates for instant UI feedback
- Use React.memo and useMemo for expensive computations
- Implement proper error boundaries
- Add retry logic for failed requests

### Phase 9: Testing Strategy

#### 9.1 Unit Tests
- API endpoint tests with mocked dependencies
- Component tests with React Testing Library
- Database function tests

#### 9.2 Integration Tests
- End-to-end correction flow
- Bulk operation scenarios
- Analytics tracking verification

#### 9.3 Performance Tests
- Table virtualization with large datasets
- API response times under load
- Database query performance

### Phase 10: Deployment and Rollout

#### 10.1 Feature Flags
- Implement PostHog feature flags for gradual rollout
- A/B test new review interface vs. current implementation

#### 10.2 Monitoring
- Set up alerts for API response times
- Monitor correction accuracy metrics
- Track user engagement with review interface

## Success Criteria

### Performance Metrics
- [ ] Table renders 10,000+ transactions smoothly
- [ ] API responses under 200ms for review data
- [ ] Zero-lag inline editing experience
- [ ] Keyboard navigation response under 50ms

### Functionality Requirements
- [ ] Single-click accept marks transaction as reviewed
- [ ] Inline category editing with autocomplete
- [ ] Bulk "Always categorize like this" creates rules
- [ ] "Why?" popover shows decision rationale
- [ ] Receipt attachment links to transactions
- [ ] Analytics tracking for all user actions

### Data Integrity
- [ ] All corrections tracked in audit table
- [ ] Rules generated from user feedback
- [ ] RLS policies prevent cross-org data access
- [ ] Database transactions ensure consistency

### User Experience
- [ ] Empty state explains review process
- [ ] Loading states for all async operations
- [ ] Error handling with user-friendly messages
- [ ] Responsive design works on all screen sizes

## Risk Mitigation

### Performance Risks
- **Risk**: Large datasets causing UI lag
- **Mitigation**: Virtualized table + cursor pagination + proper indexing

### Data Consistency Risks  
- **Risk**: Concurrent updates causing data corruption
- **Mitigation**: Database transactions + optimistic locking + conflict resolution

### User Experience Risks
- **Risk**: Complex interface overwhelming users
- **Mitigation**: Progressive disclosure + tooltips + empty states + keyboard shortcuts

### Analytics Risks
- **Risk**: Missing or inaccurate tracking data
- **Mitigation**: Fallback tracking + error handling + validation + retry logic

## Future Enhancements (Post-M5)

1. **Advanced Filtering**: Date ranges, amount filters, category filters
2. **Export Functionality**: Export review data to CSV/Excel
3. **Smart Suggestions**: ML-powered category suggestions
4. **Collaborative Review**: Multi-user review assignments
5. **Automated Rules**: Learning from user patterns to create rules automatically
6. **Mobile Optimization**: Touch-friendly review interface
7. **Batch Operations**: More bulk actions like delete, merge, split
8. **Advanced Analytics**: Correction trends, accuracy improvements over time

This implementation plan provides a solid foundation for Milestone 5 while maintaining consistency with the existing codebase architecture and patterns.
