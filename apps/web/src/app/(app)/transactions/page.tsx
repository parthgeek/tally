"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CategoryPill, type CategoryTier1 } from "@/components/ui/category-pill";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { MoreHorizontal, Receipt, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  filterTransactions,
  isLowConfidence,
  getActiveFilterKeys,
  type FilterState,
} from "@/lib/transaction-filters";
import {
  UI_FEATURE_FLAGS,
  isUIFeatureEnabled,
  ANALYTICS_EVENTS,
  type TransactionsFilterChangedProps,
  type TransactionCategoryCorrectedProps,
  type TransactionLowConfWarningShownProps,
  type TransactionsDeletedProps,
} from "@nexus/types";
import { getPosthogClientBrowser } from "@nexus/analytics/client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Local currency formatting function
function formatAmount(amountCents: string, currency: string = "USD"): string {
  const amount = parseInt(amountCents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

// Map category type to tier1
function getCategoryTier1(categoryType?: string | null): CategoryTier1 {
  if (!categoryType) return null;
  if (categoryType === "revenue") return "revenue";
  if (categoryType === "cogs") return "cogs";
  if (categoryType === "opex") return "opex";
  return null;
}

interface Account {
  name: string;
}

interface Category {
  id: string;
  name: string;
  type?: string;
}

interface Transaction {
  id: string;
  date: string;
  amount_cents: string;
  currency: string;
  description: string;
  merchant_name?: string;
  source: string;
  raw: Record<string, unknown>;
  account_id: string;
  category_id?: string | null;
  confidence?: number | null;
  needs_review?: boolean;
  accounts?: Account | Account[] | null;
  categories?: Category | Category[] | null;
  account_name?: string;
  category_name?: string;
  category_type?: string | null;
}

interface TransactionWithNormalized extends Omit<Transaction, "category_name" | "account_name"> {
  account_name: string;
  category_name: string | null;
  category_type?: string | null;
}

const initialFilterState: FilterState = {
  search: "",
  merchant: "",
  account: "__all__",
  categoryId: "__all__",
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
  lowConfidenceOnly: false,
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithNormalized[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithNormalized | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [updatingCategories, setUpdatingCategories] = useState<Set<string>>(new Set());
  const [shownLowConfWarnings, setShownLowConfWarnings] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [deletingTransactions, setDeletingTransactions] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const supabase = createClient();
  const posthog = getPosthogClientBrowser();
  const { toast } = useToast();

  const isEnhancedUIEnabled = isUIFeatureEnabled(UI_FEATURE_FLAGS.TRANSACTIONS_ENHANCED_UI);

  useEffect(() => {
    fetchTransactions();
  }, [isEnhancedUIEnabled]);

  useEffect(() => {
    if (currentOrgId) {
      fetchCategories();
    }
  }, [currentOrgId, isEnhancedUIEnabled]);

  const filteredTransactions = useMemo(() => {
    if (!isEnhancedUIEnabled) return transactions;
    return filterTransactions(transactions, filters);
  }, [transactions, filters, isEnhancedUIEnabled]);

  const distinctAccounts = useMemo(() => {
    const accounts = transactions
      .map((tx) => tx.account_name)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);
    return accounts.sort();
  }, [transactions]);

  useEffect(() => {
    if (!isEnhancedUIEnabled || !posthog || !currentUserId || !currentOrgId) return;

    const timer = setTimeout(() => {
      const activeFilters = getActiveFilterKeys(filters);

      if (activeFilters.length > 0) {
        const props: TransactionsFilterChangedProps = {
          filter_keys: activeFilters,
          low_conf_only: filters.lowConfidenceOnly,
          results_count: filteredTransactions.length,
          org_id: currentOrgId,
          user_id: currentUserId,
        };

        posthog.capture(ANALYTICS_EVENTS.TRANSACTIONS_FILTER_CHANGED, props);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    filters,
    filteredTransactions.length,
    isEnhancedUIEnabled,
    posthog,
    currentUserId,
    currentOrgId,
  ]);

  const handleCategoryChange = useCallback(
    async (txId: string, newCategoryId: string) => {
      if (!currentUserId || !currentOrgId) return;

      const transaction = transactions.find((tx) => tx.id === txId) as TransactionWithNormalized;
      if (!transaction) return;

      if (newCategoryId === "__none__") {
        setUpdatingCategories((prev) => new Set(prev).add(txId));

        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === txId
              ? ({
                  ...tx,
                  category_id: null,
                  category_name: null,
                  category_type: null,
                  needs_review: false,
                } as TransactionWithNormalized)
              : tx
          )
        );

        try {
          const response = await fetch("/api/transactions/correct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txId, newCategoryId: null }),
          });

          if (!response.ok) {
            throw new Error("Failed to update category");
          }

          if (posthog) {
            const props: TransactionCategoryCorrectedProps = {
              old_category_id: transaction.category_id || null,
              new_category_id: null,
              confidence: transaction.confidence || null,
              tx_amount_cents: parseInt(transaction.amount_cents),
              org_id: currentOrgId,
              user_id: currentUserId,
              transaction_id: txId,
            };

            posthog.capture(ANALYTICS_EVENTS.TRANSACTION_CATEGORY_CORRECTED, props);
          }

          toast({
            title: "Category Updated",
            description: "Transaction set to uncategorized",
          });
        } catch (error) {
          console.error("Failed to update category:", error);

          setTransactions((prev) =>
            prev.map((tx) =>
              tx.id === txId
                ? ({
                    ...tx,
                    category_id: transaction.category_id,
                    category_name: transaction.category_name,
                    category_type: transaction.category_type,
                    needs_review: transaction.needs_review,
                  } as TransactionWithNormalized)
                : tx
            )
          );

          toast({
            title: "Error",
            description: "Failed to update category. Please try again.",
            variant: "destructive",
          });
        } finally {
          setUpdatingCategories((prev) => {
            const next = new Set(prev);
            next.delete(txId);
            return next;
          });
        }
        return;
      }

      const newCategory = categories.find((cat) => cat.id === newCategoryId);
      if (!newCategory) return;

      setUpdatingCategories((prev) => new Set(prev).add(txId));

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === txId
            ? ({
                ...tx,
                category_id: newCategoryId,
                category_name: newCategory.name,
                category_type: newCategory.type ?? null,
                needs_review: false,
              } as TransactionWithNormalized)
            : tx
        )
      );

      try {
        const response = await fetch("/api/transactions/correct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txId, newCategoryId }),
        });

        if (!response.ok) {
          throw new Error("Failed to update category");
        }

        if (posthog) {
          const props: TransactionCategoryCorrectedProps = {
            old_category_id: transaction.category_id || null,
            new_category_id: newCategoryId,
            confidence: transaction.confidence || null,
            tx_amount_cents: parseInt(transaction.amount_cents),
            org_id: currentOrgId,
            user_id: currentUserId,
            transaction_id: txId,
          };

          posthog.capture(ANALYTICS_EVENTS.TRANSACTION_CATEGORY_CORRECTED, props);
        }

        toast({
          title: "Category Updated",
          description: `Transaction categorized as "${newCategory.name}"`,
        });
      } catch (error) {
        console.error("Failed to update category:", error);

        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === txId
              ? ({
                  ...tx,
                  category_id: transaction.category_id,
                  category_name: transaction.category_name,
                  category_type: transaction.category_type,
                  needs_review: transaction.needs_review,
                } as TransactionWithNormalized)
              : tx
          )
        );

        toast({
          title: "Error",
          description: "Failed to update category. Please try again.",
          variant: "destructive",
        });
      } finally {
        setUpdatingCategories((prev) => {
          const next = new Set(prev);
          next.delete(txId);
          return next;
        });
      }
    },
    [transactions, categories, currentUserId, currentOrgId, posthog, toast]
  );

  const clearFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  const refreshData = useCallback(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  const toggleSelect = useCallback((txId: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = new Set(filteredTransactions.map((tx) => tx.id));
    setSelectedTransactions(allIds);
  }, [filteredTransactions]);

  const clearSelection = useCallback(() => {
    setSelectedTransactions(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    // Clear selections when exiting selection mode
    if (selectionMode) {
      setSelectedTransactions(new Set());
    }
  }, [selectionMode]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedTransactions.size === 0 || !currentUserId || !currentOrgId) return;

    // Confirmation dialog
    if (
      !confirm(
        `Are you sure you want to delete ${selectedTransactions.size} transaction(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingTransactions(true);

    const MAX_PER_REQUEST = 100;
    const ids = Array.from(selectedTransactions);

    // Chunk IDs into batches
    const chunk = <T,>(items: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
      }
      return chunks;
    };

    const batches = chunk(ids, MAX_PER_REQUEST);
    let totalDeleted = 0;
    const allErrors: Array<{ tx_id: string; error: string }> = [];
    const processedIds = new Set<string>();

    try {
      // Process batches sequentially
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]!;

        // Update progress
        setDeletionProgress({ done: i, total: batches.length });

        try {
          const response = await fetch("/api/transactions/delete", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txIds: batch,
            }),
          });

          if (!response.ok) {
            // Treat entire batch as failed
            const errorMessage = `Batch ${i + 1} failed with status ${response.status}`;
            console.error(errorMessage);
            batch.forEach((id) => {
              allErrors.push({ tx_id: id, error: errorMessage });
            });
            continue;
          }

          const result = await response.json();

          // Accumulate results
          totalDeleted += result.deleted_count || 0;
          if (result.errors && Array.isArray(result.errors)) {
            allErrors.push(...result.errors);
          }

          // Track successfully processed IDs from this batch
          batch.forEach((id) => processedIds.add(id));
        } catch (batchError) {
          console.error(`Error processing batch ${i + 1}:`, batchError);
          batch.forEach((id) => {
            allErrors.push({
              tx_id: id,
              error: batchError instanceof Error ? batchError.message : "Network error",
            });
          });
        }
      }

      // Clear progress
      setDeletionProgress(null);

      // Track single aggregated analytics event
      if (posthog) {
        const props: TransactionsDeletedProps = {
          org_id: currentOrgId,
          user_id: currentUserId,
          transaction_count: ids.length,
          deleted_count: totalDeleted,
          error_count: allErrors.length,
        };

        posthog.capture(ANALYTICS_EVENTS.TRANSACTIONS_DELETED, props);
      }

      // Optimistically update UI - remove only successfully processed IDs
      if (processedIds.size > 0) {
        setTransactions((prev) => prev.filter((tx) => !processedIds.has(tx.id)));

        clearSelection();
        setSelectionMode(false); // Exit selection mode after deletion
      }

      // Show summary toast
      if (allErrors.length === 0) {
        toast({
          title: "Transactions Deleted",
          description: `Successfully deleted ${totalDeleted} transaction(s)`,
        });
      } else if (totalDeleted > 0) {
        toast({
          title: "Partial Success",
          description: `Deleted ${totalDeleted} of ${ids.length} transaction(s). ${allErrors.length} failed.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Deletion Failed",
          description: `Failed to delete transactions. ${allErrors.length} error(s) occurred.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete transactions:", error);
      toast({
        title: "Error",
        description: "Failed to delete transactions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingTransactions(false);
      setDeletionProgress(null);
    }
  }, [selectedTransactions, currentUserId, currentOrgId, posthog, toast, clearSelection]);

  useEffect(() => {
    if (!isEnhancedUIEnabled || !posthog || !currentUserId || !currentOrgId) return;

    filteredTransactions.forEach((tx) => {
      const lowConfidence = isLowConfidence(tx.confidence);

      if (lowConfidence && !shownLowConfWarnings.has(tx.id)) {
        setShownLowConfWarnings((prev) => new Set(prev).add(tx.id));

        const props: TransactionLowConfWarningShownProps = {
          transaction_id: tx.id,
          confidence: tx.confidence!,
          category_id: tx.category_id || null,
          org_id: currentOrgId,
          user_id: currentUserId,
        };

        posthog.capture(ANALYTICS_EVENTS.TRANSACTION_CATEGORY_LOW_CONF_WARNING_SHOWN, props);
      }
    });
  }, [
    filteredTransactions,
    shownLowConfWarnings,
    isEnhancedUIEnabled,
    posthog,
    currentUserId,
    currentOrgId,
  ]);

  const fetchTransactions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const cookies = document.cookie.split(";");
      const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
      const orgId = orgCookie ? orgCookie.split("=")[1] : null;

      if (!orgId) return;
      setCurrentOrgId(orgId);

      const selectQuery = isEnhancedUIEnabled
        ? `
          id, date, amount_cents, currency, description, merchant_name, source, account_id, raw,
          category_id, confidence, needs_review,
          accounts(name),
          categories(name, type)
        `
        : "*";

      const { data, error } = await supabase
        .from("transactions")
        .select(selectQuery)
        .eq("org_id", orgId)
        .order("date", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Error fetching transactions:", error);
        return;
      }

      const normalizedTransactions = (data || []).map((t) => {
        const accountName = (t as any).accounts
          ? Array.isArray((t as any).accounts)
            ? (t as any).accounts?.[0]?.name
            : (t as any).accounts?.name
          : undefined;

        const categoryData = (t as any).categories
          ? Array.isArray((t as any).categories)
            ? (t as any).categories?.[0]
            : (t as any).categories
          : undefined;

        return {
          ...(t as any),
          account_name: accountName || "Unknown",
          category_name: categoryData?.name || null,
          category_type: categoryData?.type || null,
        } as TransactionWithNormalized;
      });

      setTransactions(normalizedTransactions);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!isEnhancedUIEnabled || !currentOrgId) return;

    try {
      // Fetch active categories only (filters out legacy fine-grained categories)
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, type, org_id")
        .or(`org_id.eq.${currentOrgId},org_id.is.null`)
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching categories:", error);
        return;
      }

      // All returned categories are active (database filters inactive ones)
      const filteredData = data || [];

      const categoriesMap = new Map<string, { category: Category; orgSpecific: boolean }>();
      filteredData.forEach((category: any) => {
        const existing = categoriesMap.get(category.name);
        const isOrgSpecific = category.org_id === currentOrgId;

        if (!existing || (isOrgSpecific && !existing.orgSpecific)) {
          categoriesMap.set(category.name, {
            category: { id: category.id, name: category.name, type: category.type },
            orgSpecific: isOrgSpecific,
          });
        }
      });

      const deduplicatedCategories = Array.from(categoriesMap.values())
        .map((item) => item.category)
        .sort((a, b) => a.name.localeCompare(b.name));
      setCategories(deduplicatedCategories);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Loading your transactions...</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          All your financial transactions from connected accounts
        </p>
      </div>

      {/* Enhanced Filters */}
      {isEnhancedUIEnabled && filteredTransactions.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-xs">
                  Search
                </Label>
                <Input
                  id="search"
                  placeholder="Description or merchant..."
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account" className="text-xs">
                  Account
                </Label>
                <Select
                  value={filters.account}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, account: value }))}
                >
                  <SelectTrigger id="account">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All accounts</SelectItem>
                    {distinctAccounts.map((account) => (
                      <SelectItem key={account} value={account}>
                        {account}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs">
                  Category
                </Label>
                <Select
                  value={filters.categoryId}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFrom" className="text-xs">
                  Date Range
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lowConfOnly"
                  checked={filters.lowConfidenceOnly}
                  onCheckedChange={(checked) =>
                    setFilters((prev) => ({ ...prev, lowConfidenceOnly: !!checked }))
                  }
                />
                <Label htmlFor="lowConfOnly" className="text-sm font-normal">
                  Only low-confidence (&lt;95%)
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleSelectionMode}
                >
                  {selectionMode ? "Done Selecting" : "Select"}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Button variant="ghost" size="sm" onClick={refreshData}>
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Toolbar */}
      {selectionMode && selectedTransactions.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedTransactions.size} transaction(s) selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectionMode}
                  disabled={deletingTransactions}
                >
                  Cancel
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={deletingTransactions}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deletingTransactions
                  ? deletionProgress
                    ? `Deleting... (${deletionProgress.done + 1}/${deletionProgress.total})`
                    : "Deleting..."
                  : "Delete Selected"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredTransactions.length > 0 ? (
        <>
          {/* Desktop Table View - hidden on mobile */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {selectionMode && (
                      <th className="px-4 py-3 text-center">
                        <Checkbox
                          checked={
                            selectedTransactions.size === filteredTransactions.length &&
                            filteredTransactions.length > 0
                          }
                          onCheckedChange={(checked) => (checked ? selectAll() : clearSelection())}
                          aria-label="Select all transactions"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Amount
                    </th>
                    {isEnhancedUIEnabled && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Category
                      </th>
                    )}
                    {isEnhancedUIEnabled && (
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Confidence
                      </th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => {
                    const isUpdating = updatingCategories.has(transaction.id);
                    const tier1 = getCategoryTier1(transaction.category_type);
                    const isSelected = selectedTransactions.has(transaction.id);

                    return (
                      <tr
                        key={transaction.id}
                        className={cn(
                          "border-b border-border-subtle last:border-0 hover:bg-muted/30 transition-colors",
                          isSelected && selectionMode && "bg-primary/5"
                        )}
                      >
                        {selectionMode && (
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(transaction.id)}
                              aria-label={`Select transaction ${transaction.description}`}
                            />
                          </td>
                        )}
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
                        {isEnhancedUIEnabled && (
                          <td className="px-4 py-3">
                            {isUpdating ? (
                              <span className="text-xs text-muted-foreground">Saving...</span>
                            ) : (
                              <Select
                                value={transaction.category_id || "__none__"}
                                onValueChange={(value) =>
                                  handleCategoryChange(transaction.id, value)
                                }
                                disabled={isUpdating}
                              >
                                <SelectTrigger className="h-8 w-full border-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 transition-colors">
                                  <SelectValue>
                                    <CategoryPill
                                      tier1={tier1}
                                      {...(transaction.category_name
                                        ? { tier2: transaction.category_name }
                                        : {})}
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
                        )}
                        {isEnhancedUIEnabled && (
                          <td className="px-4 py-3 text-center">
                            <ConfidenceBadge
                              confidence={transaction.confidence ?? null}
                              size="sm"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <button
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            onClick={() => setSelectedTransaction(transaction)}
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
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
            {filteredTransactions.map((transaction) => {
              const isUpdating = updatingCategories.has(transaction.id);
              const tier1 = getCategoryTier1(transaction.category_type);

              return (
                <Card key={transaction.id} className="p-4">
                  <div className="space-y-3">
                    {/* Header: Date and Amount */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-base font-semibold mt-1">
                          {formatAmount(transaction.amount_cents, transaction.currency)}
                        </div>
                      </div>
                      <button
                        className="p-2 rounded-md hover:bg-muted transition-colors -mr-2 -mt-2"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Vendor/Description */}
                    <div>
                      <div className="text-sm font-medium">
                        {transaction.merchant_name || transaction.description}
                      </div>
                      {transaction.merchant_name && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {transaction.description}
                        </div>
                      )}
                    </div>

                    {/* Category and Confidence - Enhanced UI Only */}
                    {isEnhancedUIEnabled && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {isUpdating ? (
                          <span className="text-xs text-muted-foreground">Saving...</span>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <Select
                              value={transaction.category_id || "__none__"}
                              onValueChange={(value) => handleCategoryChange(transaction.id, value)}
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="h-9 w-full border-none bg-muted/50 hover:bg-muted">
                                <SelectValue>
                                  {transaction.category_name ? (
                                    <CategoryPill
                                      tier1={tier1}
                                      tier2={transaction.category_name}
                                      size="sm"
                                    />
                                  ) : (
                                    <CategoryPill tier1={null} tier2="Uncategorized" size="sm" />
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  <CategoryPill tier1={null} tier2="Uncategorized" size="sm" />
                                </SelectItem>
                                {categories.map((category) => {
                                  const catTier1 = getCategoryTier1(category.type);
                                  return (
                                    <SelectItem key={category.id} value={category.id}>
                                      <CategoryPill
                                        tier1={catTier1}
                                        tier2={category.name}
                                        size="sm"
                                      />
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <ConfidenceBadge confidence={transaction.confidence ?? null} size="sm" />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Receipt className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-semibold">No transactions found</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your bank accounts to start importing transaction data automatically.
                </p>
              </div>
              <Button asChild size="lg" className="mt-2">
                <a href="/settings/connections">Connect Bank Account</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Data Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle">
              <h3 className="font-semibold">Raw Transaction Data</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(null)}>
                Close
              </Button>
            </div>
            <CardContent className="p-4 overflow-auto max-h-[60vh]">
              <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded font-mono">
                {JSON.stringify(selectedTransaction.raw, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
