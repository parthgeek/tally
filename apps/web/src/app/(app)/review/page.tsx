"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryPill, type CategoryTier1 } from "@/components/ui/category-pill";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { createClient } from "@/lib/supabase";
import { Check, X, CheckCircle, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransactionCorrectRequest } from "@nexus/types/contracts";

// Map category type to tier1
function getCategoryTier1(categoryType?: string | null): CategoryTier1 {
  if (!categoryType) return null;
  if (categoryType === "revenue") return "revenue";
  if (categoryType === "cogs") return "cogs";
  if (categoryType === "opex") return "opex";
  return null;
}

// Local currency formatting function
function formatAmount(amountCents: string, currency: string = "USD"): string {
  const amount = parseInt(amountCents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

interface CategoryInfo {
  name: string;
  type?: string | null;
}

interface Transaction {
  id: string;
  date: string;
  amount_cents: string;
  currency: string;
  description: string;
  merchant_name?: string;
  category_id?: string;
  confidence?: number;
  needs_review: boolean;
  categories?: CategoryInfo | null;
}

interface Category {
  id: string;
  name: string;
  type?: string | null;
}

export default function ReviewPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const getCurrentOrgId = () => {
    const cookies = document.cookie.split(";");
    const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
    return orgCookie ? orgCookie.split("=")[1] : null;
  };

  // Fetch transactions that need review
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions-review"],
    queryFn: async () => {
      const orgId = getCurrentOrgId();
      if (!orgId) throw new Error("No org ID");

      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          date,
          amount_cents,
          currency,
          description,
          merchant_name,
          category_id,
          confidence,
          needs_review,
          categories(name, type)
        `
        )
        .eq("org_id", orgId)
        .eq("needs_review", true)
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((item) => {
        const catData = Array.isArray(item.categories) ? item.categories[0] : item.categories;
        return {
          ...item,
          categories: catData || null,
        };
      }) as Transaction[];
    },
  });

  // Fetch available categories (active categories only - filters out legacy)
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const orgId = getCurrentOrgId();
      if (!orgId) throw new Error("No org ID");

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, type, org_id")
        .or(`org_id.eq.${orgId},org_id.is.null`)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      return (data || []) as Category[];
    },
  });

  // Mutation to correct a transaction category
  const correctTransactionMutation = useMutation({
    mutationFn: async ({ txId, newCategoryId }: { txId: string; newCategoryId: string | null }) => {
      const request: TransactionCorrectRequest = {
        txId: txId as any,
        newCategoryId: newCategoryId as any,
      };

      const response = await fetch("/api/transactions/correct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to correct transaction");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions-review"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const handleCategoryChange = async (txId: string, newCategoryId: string) => {
    setProcessingIds((prev) => new Set(prev).add(txId));
    try {
      await correctTransactionMutation.mutateAsync({
        txId,
        newCategoryId: newCategoryId === "__none__" ? null : newCategoryId,
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });
    }
  };

  const handleApprove = async (txId: string) => {
    setProcessingIds((prev) => new Set(prev).add(txId));
    try {
      const transaction = transactions.find((t) => t.id === txId);
      if (transaction?.category_id) {
        await correctTransactionMutation.mutateAsync({
          txId,
          newCategoryId: transaction.category_id,
        });
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });
    }
  };

  const handleBulkApprove = async () => {
    const selectedIds = Array.from(selectedTransactions);
    setProcessingIds(new Set(selectedIds));

    try {
      for (const txId of selectedIds) {
        const transaction = transactions.find((t) => t.id === txId);
        if (transaction?.category_id) {
          await correctTransactionMutation.mutateAsync({
            txId,
            newCategoryId: transaction.category_id,
          });
        }
      }
      setSelectedTransactions(new Set());
    } finally {
      setProcessingIds(new Set());
    }
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map((t) => t.id)));
    }
  };

  const toggleSelect = (txId: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  };

  if (transactionsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Queue</h1>
          <p className="text-muted-foreground">Loading transactions that need review...</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-border-subtle last:border-0"
                >
                  <div className="animate-pulse flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-3 bg-muted rounded w-1/3"></div>
                  </div>
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Queue</h1>
          <p className="text-muted-foreground">
            {transactions.length === 0
              ? "All transactions have been reviewed"
              : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} need${transactions.length === 1 ? "s" : ""} your attention`}
          </p>
        </div>
        {transactions.length > 0 && selectedTransactions.size > 0 && (
          <div className="text-sm text-muted-foreground">{selectedTransactions.size} selected</div>
        )}
      </div>

      {transactions.length > 0 ? (
        <>
          {/* Desktop Table View - hidden on mobile */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={selectedTransactions.size === transactions.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Category
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Confidence
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const isProcessing = processingIds.has(transaction.id);
                    const isSelected = selectedTransactions.has(transaction.id);
                    const tier1 = getCategoryTier1(transaction.categories?.type);
                    const categoryName = transaction.categories?.name || null;

                    return (
                      <tr
                        key={transaction.id}
                        className={cn(
                          "border-b border-border-subtle last:border-0 transition-colors",
                          isSelected && "bg-primary/5",
                          !isSelected && "hover:bg-muted/30"
                        )}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(transaction.id)}
                            disabled={isProcessing}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(transaction.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {transaction.merchant_name || transaction.description}
                            </span>
                            {transaction.merchant_name && (
                              <span className="text-xs text-muted-foreground">
                                {transaction.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                          {formatAmount(transaction.amount_cents, transaction.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {isProcessing ? (
                            <span className="text-xs text-muted-foreground">Saving...</span>
                          ) : (
                            <Select
                              value={transaction.category_id || "__none__"}
                              onValueChange={(value) => handleCategoryChange(transaction.id, value)}
                              disabled={isProcessing}
                            >
                              <SelectTrigger className="h-8 w-full border-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 transition-colors">
                                <SelectValue>
                                  <CategoryPill
                                    tier1={tier1}
                                    {...(categoryName ? { tier2: categoryName } : {})}
                                    size="sm"
                                  />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  <span className="text-muted-foreground">Uncategorized</span>
                                </SelectItem>
                                {categories.map((category) => {
                                  const catTier1 = getCategoryTier1(category.type);
                                  return (
                                    <SelectItem key={category.id} value={category.id}>
                                      <div className="flex items-center gap-2">
                                        <CategoryPill
                                          tier1={catTier1}
                                          tier2={category.name}
                                          size="sm"
                                        />
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ConfidenceBadge confidence={transaction.confidence ?? null} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(transaction.id)}
                              disabled={isProcessing || !transaction.category_id}
                              className="h-7 px-2"
                              title="Approve categorization"
                            >
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Card View - visible on mobile only */}
          <div className="md:hidden space-y-3">
            {transactions.map((transaction) => {
              const isProcessing = processingIds.has(transaction.id);
              const isSelected = selectedTransactions.has(transaction.id);
              const tier1 = getCategoryTier1(transaction.categories?.type);
              const categoryName = transaction.categories?.name || null;

              return (
                <Card
                  key={transaction.id}
                  className={cn("p-4", isSelected && "ring-2 ring-primary/20 bg-primary/5")}
                >
                  <div className="space-y-3">
                    {/* Header: Checkbox, Date, and Amount */}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(transaction.id)}
                        disabled={isProcessing}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-base font-semibold tabular-nums">
                            {formatAmount(transaction.amount_cents, transaction.currency)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vendor/Description */}
                    <div className="pl-9">
                      <div className="text-sm font-medium">
                        {transaction.merchant_name || transaction.description}
                      </div>
                      {transaction.merchant_name && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {transaction.description}
                        </div>
                      )}
                    </div>

                    {/* Category Selector */}
                    <div className="pl-9">
                      {isProcessing ? (
                        <span className="text-xs text-muted-foreground">Saving...</span>
                      ) : (
                        <Select
                          value={transaction.category_id || "__none__"}
                          onValueChange={(value) => handleCategoryChange(transaction.id, value)}
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="h-10 w-full border-border-subtle bg-muted/30 hover:bg-muted/50">
                            <SelectValue>
                              <CategoryPill
                                tier1={tier1}
                                {...(categoryName ? { tier2: categoryName } : {})}
                                size="sm"
                              />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">Uncategorized</span>
                            </SelectItem>
                            {categories.map((category) => {
                              const catTier1 = getCategoryTier1(category.type);
                              return (
                                <SelectItem key={category.id} value={category.id}>
                                  <CategoryPill tier1={catTier1} tier2={category.name} size="sm" />
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Footer: Confidence and Approve Button */}
                    <div className="flex items-center justify-between pl-9">
                      <ConfidenceBadge confidence={transaction.confidence ?? null} size="sm" />
                      <Button
                        size="sm"
                        onClick={() => handleApprove(transaction.id)}
                        disabled={isProcessing || !transaction.category_id}
                        className="h-9 px-4"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <div className="rounded-full bg-success-background p-3 w-fit mx-auto">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">All caught up!</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  There are no transactions that need review at this time. New transactions will
                  appear here automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedTransactions.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-background/95 backdrop-blur-sm shadow-notion-lg">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4">
                <span className="text-sm font-medium">{selectedTransactions.size} selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTransactions(new Set())}
                  className="h-9"
                >
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="default"
                  onClick={handleBulkApprove}
                  disabled={processingIds.size > 0}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Approve {selectedTransactions.size} transaction
                    {selectedTransactions.size === 1 ? "" : "s"}
                  </span>
                  <span className="sm:hidden">Approve ({selectedTransactions.size})</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
