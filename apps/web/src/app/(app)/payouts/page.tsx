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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Download, 
  RefreshCw, 
  Eye, 
  Search, 
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentOrgId } from "@/lib/lib-get-current-org";
import { cn } from "@/lib/utils";
import { Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Types
interface ShopifyPayout {
  id: string;
  org_id: string;
  shop: string;
  shopify_payout_id: string;
  payout_date: string;
  currency: string;
  gross_cents: number;
  refunds_cents: number;
  fees_cents: number;
  net_cents: number;
  status: 'pending' | 'matched' | 'mismatched';
  bank_transaction_id: string | null;
  raw: any;
  created_at: string;
  updated_at: string;
  shopify_payout_items: ShopifyPayoutItem[];
  transactions?: any;
}

interface ShopifyPayoutItem {
  id: string;
  payout_id: string;
  org_id: string;
  item_type: string;
  amount_cents: number;
  currency: string;
  shopify_order_id: string | null;
  shopify_refund_id: string | null;
  provider_tx_id: string | null;
  raw: any;
  created_at: string;
}

interface FilterState {
  search: string;
  shop: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
}

const initialFilterState: FilterState = {
  search: "",
  shop: "__all__",
  status: "__all__",
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
};

// Helper functions
function formatAmount(amountCents: number, currency: string = "USD"): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'matched':
      return 'default';
    case 'mismatched':
      return 'destructive';
    case 'pending':
      return 'outline';
    default:
      return 'secondary';
  }
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<ShopifyPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [selectedPayout, setSelectedPayout] = useState<ShopifyPayout | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [distinctShops, setDistinctShops] = useState<string[]>([]);

  const supabase = createClient();
  const { toast } = useToast();

  const filteredPayouts = useMemo(() => {
    return payouts.filter(payout => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesId = payout.shopify_payout_id.toLowerCase().includes(searchLower);
        const matchesShop = payout.shop.toLowerCase().includes(searchLower);
        if (!matchesId && !matchesShop) return false;
      }

      // Shop filter
      if (filters.shop !== "__all__" && payout.shop !== filters.shop) {
        return false;
      }

      // Status filter
      if (filters.status !== "__all__" && payout.status !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom && payout.payout_date < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && payout.payout_date > filters.dateTo) {
        return false;
      }

      // Amount filters
      if (filters.minAmount) {
        const minAmount = parseFloat(filters.minAmount) * 100;
        if (payout.net_cents < minAmount) return false;
      }
      if (filters.maxAmount) {
        const maxAmount = parseFloat(filters.maxAmount) * 100;
        if (payout.net_cents > maxAmount) return false;
      }

      return true;
    });
  }, [payouts, filters]);

  const summary = useMemo(() => {
    return filteredPayouts.reduce(
      (acc, payout) => ({
        totalPayouts: acc.totalPayouts + 1,
        totalAmount: acc.totalAmount + payout.net_cents,
        matched: acc.matched + (payout.status === 'matched' ? 1 : 0),
        pending: acc.pending + (payout.status === 'pending' ? 1 : 0),
        mismatched: acc.mismatched + (payout.status === 'mismatched' ? 1 : 0),
      }),
      {
        totalPayouts: 0,
        totalAmount: 0,
        matched: 0,
        pending: 0,
        mismatched: 0,
      }
    );
  }, [filteredPayouts]);

  const fetchPayouts = useCallback(async () => {
    const orgId = getCurrentOrgId();
    if (!orgId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("shopify_payouts")
        .select(`
          *,
          shopify_payout_items(*),
          transactions!bank_transaction_id(*)
        `)
        .eq("org_id", orgId)
        .order("payout_date", { ascending: false });

      if (error) {
        throw error;
      }

      setPayouts(data || []);

      // Extract distinct shops
      const shops = Array.from(new Set(data?.map(p => p.shop) || []));
      setDistinctShops(shops);

    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast({
        title: "Error",
        description: "Failed to load payouts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  const syncPayouts = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/shopify/payouts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to sync payouts');
      }

      const result = await response.json();
      
      toast({
        title: "Sync Completed",
        description: `Synced ${result.totals?.payoutsSynced || 0} payouts with ${result.totals?.itemsSynced || 0} items`,
      });

      // Refresh the data
      await fetchPayouts();

    } catch (error) {
      console.error("Error syncing payouts:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync payouts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [fetchPayouts, toast]);

  const exportPayouts = useCallback(async () => {
    try {
      const response = await fetch('/api/shopify/payouts/export');
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shopify-payouts-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Started",
        description: "Payouts data is being downloaded",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export payouts. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const clearFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  const openPayoutDetail = useCallback((payout: ShopifyPayout) => {
    setSelectedPayout(payout);
    setDetailModalOpen(true);
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shopify Payouts</h1>
          <p className="text-muted-foreground">Loading your payouts...</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b">
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
    <div className="container mx-auto py-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shopify Payouts</h1>
          <p className="text-muted-foreground">
            Manage and reconcile your Shopify payouts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPayouts}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={syncPayouts} disabled={syncing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync Payouts"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Payouts</p>
                <p className="text-2xl font-bold">{summary.totalPayouts}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{formatAmount(summary.totalAmount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Matched</p>
                <p className="text-2xl font-bold text-green-600">{summary.matched}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.pending}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mismatched</p>
                <p className="text-2xl font-bold text-red-600">{summary.mismatched}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search" className="text-xs">Search</Label>
              <Input
                id="search"
                placeholder="Payout ID or shop..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop" className="text-xs">Shop</Label>
              <Select
                value={filters.shop}
                onValueChange={(value) => setFilters(prev => ({ ...prev, shop: value }))}
              >
                <SelectTrigger id="shop">
                  <SelectValue placeholder="All shops" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All shops</SelectItem>
                  {distinctShops.map(shop => (
                    <SelectItem key={shop} value={shop}>{shop}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="text-xs">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All statuses</SelectItem>
                  <SelectItem value="matched">Matched</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="mismatched">Mismatched</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="text-xs">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredPayouts.length} of {payouts.length} payouts
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      {filteredPayouts.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Shop
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Payout ID
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Gross
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fees
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Refunds
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Net
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Items
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((payout) => (
                  <tr
                    key={payout.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-4 text-sm">
                      {formatDate(payout.payout_date)}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium">
                      {payout.shop}
                    </td>
                    <td className="px-4 py-4 text-sm font-mono text-muted-foreground">
                      {payout.shopify_payout_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums">
                      {formatAmount(payout.gross_cents, payout.currency)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-red-600 tabular-nums">
                      -{formatAmount(payout.fees_cents, payout.currency)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-orange-600 tabular-nums">
                      -{formatAmount(payout.refunds_cents, payout.currency)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-bold text-green-600 tabular-nums">
                      {formatAmount(payout.net_cents, payout.currency)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant={getStatusVariant(payout.status)}>
                        {payout.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-muted-foreground">
                      {payout.shopify_payout_items.length}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPayoutDetail(payout)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View details</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <DollarSign className="h-10 w-10 text-primary" />
              </div>
              {payouts.length === 0 ? (
                <>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-semibold">No payouts found</h3>
                    <p className="text-sm text-muted-foreground">
                      Sync your Shopify payouts to see them here.
                    </p>
                  </div>
                  <Button onClick={syncPayouts} disabled={syncing} size="lg">
                    <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                    {syncing ? "Syncing..." : "Sync Payouts"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-semibold">No payouts match your filters</h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search criteria or clear filters to see all {payouts.length} payouts.
                    </p>
                  </div>
                  <Button onClick={clearFilters} size="lg">
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Detail Modal */}
      {selectedPayout && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payout Details</DialogTitle>
              <DialogDescription>
                {selectedPayout.shop} - {formatDate(selectedPayout.payout_date)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs">Gross Amount</Label>
                      <p className="text-lg font-semibold">
                        {formatAmount(selectedPayout.gross_cents, selectedPayout.currency)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Fees</Label>
                      <p className="text-lg font-semibold text-red-600">
                        -{formatAmount(selectedPayout.fees_cents, selectedPayout.currency)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Refunds</Label>
                      <p className="text-lg font-semibold text-orange-600">
                        -{formatAmount(selectedPayout.refunds_cents, selectedPayout.currency)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Net Amount</Label>
                      <p className="text-lg font-bold text-green-600">
                        {formatAmount(selectedPayout.net_cents, selectedPayout.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant={getStatusVariant(selectedPayout.status)}>
                      {selectedPayout.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      Payout ID: {selectedPayout.shopify_payout_id}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedPayout.shopify_payout_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">
                            {item.item_type}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">
                              {item.shopify_order_id && `Order: ${item.shopify_order_id}`}
                              {item.shopify_refund_id && `Refund: ${item.shopify_refund_id}`}
                              {!item.shopify_order_id && !item.shopify_refund_id && 'Adjustment'}
                            </p>
                            {item.provider_tx_id && (
                              <p className="text-xs text-muted-foreground">
                                Provider TX: {item.provider_tx_id}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          "text-sm font-semibold tabular-nums",
                          item.amount_cents < 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {item.amount_cents < 0 ? "-" : "+"}
                          {formatAmount(Math.abs(item.amount_cents), item.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}