'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase';
import { filterTransactions, isLowConfidence, getActiveFilterKeys, type FilterState } from '@/lib/transaction-filters';
import { UI_FEATURE_FLAGS, isUIFeatureEnabled, ANALYTICS_EVENTS, type TransactionsFilterChangedProps, type TransactionCategoryCorrectedProps, type TransactionLowConfWarningShownProps } from '@nexus/types';
import { getPosthogClientBrowser } from '@nexus/analytics/client';
import { useToast } from '@/components/ui/use-toast';

// Local currency formatting function to avoid package import issues
function formatAmount(amountCents: string, currency: string = 'USD'): string {
  const amount = parseInt(amountCents) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

interface Account {
  name: string;
}

interface Category {
  id: string;
  name: string;
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
}

interface TransactionWithNormalized extends Omit<Transaction, 'category_name'> {
  account_name: string;
  category_name: string | null;
}


const initialFilterState: FilterState = {
  search: '',
  merchant: '',
  account: '',
  categoryId: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  lowConfidenceOnly: false,
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithNormalized[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithNormalized | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [updatingCategories, setUpdatingCategories] = useState<Set<string>>(new Set());
  const [shownLowConfWarnings, setShownLowConfWarnings] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  const supabase = createClient();
  const posthog = getPosthogClientBrowser();
  const { toast } = useToast();

  // Check if enhanced UI is enabled
  const isEnhancedUIEnabled = isUIFeatureEnabled(UI_FEATURE_FLAGS.TRANSACTIONS_ENHANCED_UI);

  useEffect(() => {
    fetchTransactions();
  }, [isEnhancedUIEnabled]);

  useEffect(() => {
    if (currentOrgId) {
      fetchCategories();
    }
  }, [currentOrgId, isEnhancedUIEnabled]);

  // Filter transactions based on current filter state
  const filteredTransactions = useMemo(() => {
    if (!isEnhancedUIEnabled) return transactions;

    return filterTransactions(transactions, filters);
  }, [transactions, filters, isEnhancedUIEnabled]);

  // Get distinct account names for filter dropdown
  const distinctAccounts = useMemo(() => {
    const accounts = transactions
      .map(tx => tx.account_name)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);
    return accounts.sort();
  }, [transactions]);

  // Debounced analytics for filter changes
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
  }, [filters, filteredTransactions.length, isEnhancedUIEnabled, posthog, currentUserId, currentOrgId]);

  const handleCategoryChange = useCallback(async (txId: string, newCategoryId: string) => {
    if (!currentUserId || !currentOrgId) return;

    const transaction = transactions.find(tx => tx.id === txId) as TransactionWithNormalized;
    if (!transaction) return;

    const newCategory = categories.find(cat => cat.id === newCategoryId);
    if (!newCategory) return;

    setUpdatingCategories(prev => new Set(prev).add(txId));

    // Optimistic update
    setTransactions(prev => prev.map(tx =>
      tx.id === txId
        ? {
            ...tx,
            category_id: newCategoryId,
            category_name: newCategory.name,
            needs_review: false
          } as TransactionWithNormalized
        : tx
    ));

    try {
      const response = await fetch('/api/transactions/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId, newCategoryId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      // Analytics event
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
      console.error('Failed to update category:', error);

      // Revert optimistic update
      setTransactions(prev => prev.map(tx =>
        tx.id === txId
          ? {
              ...tx,
              category_id: transaction.category_id,
              category_name: transaction.category_name,
              needs_review: transaction.needs_review
            } as TransactionWithNormalized
          : tx
      ));

      toast({
        title: "Error",
        description: "Failed to update category. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingCategories(prev => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });
    }
  }, [transactions, categories, currentUserId, currentOrgId, posthog]);

  const clearFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  const refreshData = useCallback(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  // Track low confidence warnings shown
  useEffect(() => {
    if (!isEnhancedUIEnabled || !posthog || !currentUserId || !currentOrgId) return;

    filteredTransactions.forEach(tx => {
      const lowConfidence = isLowConfidence(tx.confidence);

      if (lowConfidence && !shownLowConfWarnings.has(tx.id)) {
        setShownLowConfWarnings(prev => new Set(prev).add(tx.id));

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
  }, [filteredTransactions, shownLowConfWarnings, isEnhancedUIEnabled, posthog, currentUserId, currentOrgId]);

  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Get current org from cookie
      const cookies = document.cookie.split(';');
      const orgCookie = cookies.find(cookie => cookie.trim().startsWith('orgId='));
      const orgId = orgCookie ? orgCookie.split('=')[1] : null;

      if (!orgId) return;
      setCurrentOrgId(orgId);

      const selectQuery = isEnhancedUIEnabled
        ? `
          id, date, amount_cents, currency, description, merchant_name, source, account_id, raw,
          category_id, confidence, needs_review,
          accounts(name),
          categories(name)
        `
        : '*';

      const { data, error } = await supabase
        .from('transactions')
        .select(selectQuery)
        .eq('org_id', orgId)
        .order('date', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      const normalizedTransactions = (data || []).map(t => {
        const accountName = (t as any).accounts
          ? Array.isArray((t as any).accounts)
            ? (t as any).accounts?.[0]?.name
            : (t as any).accounts?.name
          : undefined;

        const categoryName = (t as any).categories
          ? Array.isArray((t as any).categories)
            ? (t as any).categories?.[0]?.name
            : (t as any).categories?.name
          : undefined;

        return {
          ...(t as any),
          account_name: accountName || 'Unknown',
          category_name: categoryName || null,
        } as TransactionWithNormalized;
      });

      setTransactions(normalizedTransactions);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!isEnhancedUIEnabled || !currentOrgId) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .or(`org_id.is.null,org_id.eq.${currentOrgId}`)
        .order('name');

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="p-4 space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="animate-pulse flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">
          All your financial transactions from connected accounts
        </p>
      </div>

      {/* Enhanced Filters Toolbar */}
      {isEnhancedUIEnabled && filteredTransactions.length > 0 && (
        <div className="mb-6 p-4 border rounded-lg bg-card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Description or merchant..."
                value={filters.search}
                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                placeholder="Merchant name..."
                value={filters.merchant}
                onChange={e => setFilters(prev => ({ ...prev, merchant: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="account">Account</Label>
              <Select value={filters.account} onValueChange={value => setFilters(prev => ({ ...prev, account: value }))}>
                <SelectTrigger id="account">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All accounts</SelectItem>
                  {distinctAccounts.map(account => (
                    <SelectItem key={account} value={account}>{account}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={filters.categoryId} onValueChange={value => setFilters(prev => ({ ...prev, categoryId: value }))}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="minAmount">Min Amount ($)</Label>
              <Input
                id="minAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.minAmount}
                onChange={e => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="maxAmount">Max Amount ($)</Label>
              <Input
                id="maxAmount"
                type="number"
                step="0.01"
                placeholder="1000.00"
                value={filters.maxAmount}
                onChange={e => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="lowConfOnly"
                checked={filters.lowConfidenceOnly}
                onCheckedChange={checked => setFilters(prev => ({ ...prev, lowConfidenceOnly: !!checked }))}
              />
              <Label htmlFor="lowConfOnly">Only low-confidence (&lt;95%)</Label>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
              <Button variant="outline" onClick={refreshData}>Refresh</Button>
            </div>
          </div>
        </div>
      )}

      {filteredTransactions.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Merchant</th>
                {isEnhancedUIEnabled && <th className="px-4 py-3 text-left text-sm font-medium">Account</th>}
                {isEnhancedUIEnabled && <th className="px-4 py-3 text-left text-sm font-medium">Category</th>}
                <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                {!isEnhancedUIEnabled && <th className="px-4 py-3 text-left text-sm font-medium">Source</th>}
                <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction, index) => {
                const lowConfidence = isLowConfidence(transaction.confidence);
                const isUpdating = updatingCategories.has(transaction.id);

                return (
                  <tr key={transaction.id} className={`border-t hover:bg-muted/50 ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/25'
                  }`}>
                    <td className="px-4 py-3 text-sm">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {transaction.merchant_name || '-'}
                    </td>
                    {isEnhancedUIEnabled && (
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="secondary" className="text-xs">
                          {transaction.account_name}
                        </Badge>
                      </td>
                    )}
                    {isEnhancedUIEnabled && (
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {lowConfidence && (
                            <Badge variant="destructive" className="text-xs" title="Low confidence">
                              Low
                            </Badge>
                          )}
                          <Select
                            value={transaction.category_id || ''}
                            onValueChange={value => handleCategoryChange(transaction.id, value)}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="h-8 text-xs min-w-[120px]">
                              <SelectValue placeholder="Uncategorized" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isUpdating && (
                            <Badge variant="outline" className="text-xs">
                              Saving...
                            </Badge>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {formatAmount(transaction.amount_cents, transaction.currency)}
                    </td>
                    {!isEnhancedUIEnabled && (
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 capitalize">
                          {transaction.source}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
                        View Raw
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-12">
              <div className="rounded-full bg-accent p-3">
                <svg className="h-8 w-8 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">No transactions found</h3>
                <p className="text-muted-foreground max-w-md">
                  Connect your bank accounts to start importing transaction data automatically.
                </p>
              </div>
              <Button asChild>
                <a href="/settings/connections">Connect Bank Account</a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Data Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-lg">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold">Raw Transaction Data</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
              >
                Close
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded">
                {JSON.stringify(selectedTransaction.raw, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}