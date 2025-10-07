"use client";

import { useState, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ReviewTable } from "@/components/review/review-table";
import { ReviewFiltersComponent } from "@/components/review/review-filters";
import { BulkActionBar } from "@/components/review/bulk-action-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { Check, AlertCircle, Zap } from "lucide-react";
import type { ReviewListResponse, ReviewFilters } from "@nexus/types";

const DEFAULT_FILTERS: ReviewFilters = {
  needsReviewOnly: true,
  minConfidence: 0,
  maxConfidence: 1,
};

export default function ReviewPageNew() {
  const [filters, setFilters] = useState<ReviewFilters>(DEFAULT_FILTERS);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Fetch review data with infinite query for performance
  const { data, fetchNextPage, hasNextPage, isFetching, isLoading, error } = useInfiniteQuery({
    queryKey: ["review", filters],
    queryFn: async ({ pageParam }: { pageParam?: string | undefined }) => {
      const params = new URLSearchParams();

      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "100");

      // Apply filters
      if (filters.needsReviewOnly !== undefined) {
        params.set("needsReviewOnly", filters.needsReviewOnly.toString());
      }
      if (filters.minConfidence !== undefined) {
        params.set("minConfidence", filters.minConfidence.toString());
      }
      if (filters.maxConfidence !== undefined) {
        params.set("maxConfidence", filters.maxConfidence.toString());
      }

      const response = await fetch(`/api/review?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch review data");
      }

      return response.json() as Promise<ReviewListResponse>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ReviewListResponse) => lastPage.nextCursor,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Calculate totals
  const allItems = data?.pages.flatMap((page) => page.items) || [];
  const totalItems = allItems.length;
  const reviewItems = allItems.filter((item) => item.needs_review);
  const lowConfidenceItems = allItems.filter(
    (item) => item.confidence !== null && item.confidence < 0.7
  );

  // Keyboard navigation
  const { selectedIndex, editingIndex, handleKeyDown, setSelectedIndex, setEditingIndex } =
    useKeyboardNavigation({
      totalItems,
      onEdit: (index) => setEditingIndex(index),
      onAccept: (index) => {
        // Handle accept action
        console.log("Accept transaction at index:", index);
      },
      onToggleSelection: (index) => {
        const transaction = allItems[index];
        if (transaction) {
          const newSelected = new Set(selectedRows);
          if (newSelected.has(transaction.id)) {
            newSelected.delete(transaction.id);
          } else {
            newSelected.add(transaction.id);
          }
          setSelectedRows(newSelected);
        }
      },
    });

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, fetchNextPage]);

  const handleClearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Transactions</h1>
          <p className="text-muted-foreground">Loading transactions that need review...</p>
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Transactions</h1>
          <p className="text-muted-foreground">Failed to load review data</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "An error occurred while loading transactions"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (totalItems === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Transactions</h1>
          <p className="text-muted-foreground">
            Review and categorize transactions that need attention
          </p>
        </div>

        <ReviewFiltersComponent filters={filters} onChange={setFilters} />

        <Card>
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <div className="rounded-full bg-green-100 p-3 w-fit mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">All caught up!</h3>
                <p className="text-muted-foreground">
                  {filters.needsReviewOnly
                    ? "There are no transactions that need review at this time."
                    : "No transactions match your current filters."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Transactions</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground">
              High-performance review interface with bulk actions
            </p>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                Virtualized
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold">{totalItems}</div>
            <div className="text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-amber-600">{reviewItems.length}</div>
            <div className="text-muted-foreground">Need Review</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-red-600">{lowConfidenceItems.length}</div>
            <div className="text-muted-foreground">Low Confidence</div>
          </div>
          {selectedRows.size > 0 && (
            <div className="text-center">
              <div className="font-semibold text-blue-600">{selectedRows.size}</div>
              <div className="text-muted-foreground">Selected</div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <ReviewFiltersComponent filters={filters} onChange={setFilters} />

      {/* Keyboard shortcuts hint */}
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          <strong>Keyboard shortcuts:</strong> ↑↓ Navigate • Enter Edit • Shift+Enter Accept •
          Ctrl+Space Select • Ctrl+R Attach Receipt • Esc Cancel
        </AlertDescription>
      </Alert>

      {/* Main Table */}
      <ReviewTable
        {...(data && { data })}
        selectedRows={selectedRows}
        onSelectRows={setSelectedRows}
        onLoadMore={handleLoadMore}
        selectedIndex={selectedIndex}
        editingIndex={editingIndex}
        onEdit={setEditingIndex}
        onKeyDown={handleKeyDown}
        className="h-[600px]"
      />

      {/* Loading indicator */}
      {isFetching && (
        <div className="text-center text-sm text-muted-foreground">
          Loading more transactions...
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar selectedTransactions={selectedRows} onClearSelection={handleClearSelection} />
    </div>
  );
}
