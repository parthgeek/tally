import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReviewTransactionItem, CategoryId } from "@nexus/types";

/**
 * Hook for optimistic updates in the review interface
 * Provides instant UI feedback while API calls are in progress
 */
export function useOptimisticUpdates() {
  const queryClient = useQueryClient();
  const [optimisticState, setOptimisticState] = useState<
    Map<string, Partial<ReviewTransactionItem>>
  >(new Map());

  const applyOptimisticUpdate = useCallback(
    (transactionId: string, updates: Partial<ReviewTransactionItem>) => {
      setOptimisticState((prev) =>
        new Map(prev).set(transactionId, {
          ...prev.get(transactionId),
          ...updates,
        })
      );
    },
    []
  );

  const clearOptimisticUpdate = useCallback((transactionId: string) => {
    setOptimisticState((prev) => {
      const next = new Map(prev);
      next.delete(transactionId);
      return next;
    });
  }, []);

  const clearAllOptimisticUpdates = useCallback(() => {
    setOptimisticState(new Map());
  }, []);

  const invalidateReviewQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["review"] });
    queryClient.invalidateQueries({ queryKey: ["transactions-review"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const getOptimisticTransaction = useCallback(
    (transaction: ReviewTransactionItem): ReviewTransactionItem => {
      const optimisticUpdates = optimisticState.get(transaction.id);
      if (!optimisticUpdates) {
        return transaction;
      }
      return { ...transaction, ...optimisticUpdates };
    },
    [optimisticState]
  );

  const handleOptimisticCorrection = useCallback(
    (transactionId: string, newCategoryId: CategoryId, newCategoryName: string) => {
      applyOptimisticUpdate(transactionId, {
        category_id: newCategoryId,
        category_name: newCategoryName,
        needs_review: false,
      });
    },
    [applyOptimisticUpdate]
  );

  const handleOptimisticBulkCorrection = useCallback(
    (transactionIds: string[], newCategoryId: CategoryId, newCategoryName: string) => {
      transactionIds.forEach((id) => {
        handleOptimisticCorrection(id, newCategoryId, newCategoryName);
      });
    },
    [handleOptimisticCorrection]
  );

  return {
    optimisticState,
    applyOptimisticUpdate,
    clearOptimisticUpdate,
    clearAllOptimisticUpdates,
    invalidateReviewQueries,
    getOptimisticTransaction,
    handleOptimisticCorrection,
    handleOptimisticBulkCorrection,
  };
}
