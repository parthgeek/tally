"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Receipt, Trash2, Loader2, Eye, Upload, Download, FileText, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase";
import { getCategoryIcon } from "@/lib/category-icons";
import { InstitutionLogo } from "@/components/ui/institution-logo";
import { TransactionDetailModal } from "@/components/transaction-detail-modal";
import { getCurrentOrgId } from "@/lib/lib-get-current-org";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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

// Receipt interface
interface Receipt {
  id: string;
  org_id: string;
  transaction_id: string;
  file_path: string;
  uploaded_by: string;
  created_at: string;
  checksum: string;
  ocr_text?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description?: string;
  amount?: number;
  date?: string;
  vendor?: string;
  category?: string;
  updated_at: string;
  processing_status: string;
}

// Note: Account data is not currently stored in a separate table
// The account_id is used directly as the account identifier
interface Account {
  name: string;
  mask?: string | null;
  institution_name?: string | null;
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
  account_mask?: string | null;
  category_name?: string;
  category_type?: string | null;
  provider_tx_id?: string;
  normalized_vendor?: string | null;
}

interface TransactionWithNormalized extends Omit<Transaction, "category_name" | "account_name" | "account_mask"> {
  account_name: string;
  account_mask: string | null;
  institution_name: string | null;
  category_name: string | null;
  category_type?: string | null;
  receipts?: Receipt[];
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
  month: new Date().toISOString().slice(0, 7), // Current month: "YYYY-MM"
};

// Receipt Management Modal Component
function ReceiptManagementModal({
  transaction,
  receipts,
  open,
  onOpenChange,
  onUploadReceipt,
  onDeleteReceipt,
  uploading,
  deleting,
}: {
  transaction: TransactionWithNormalized | null;
  receipts: Receipt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadReceipt: (file: File) => Promise<void>;
  onDeleteReceipt: (receiptId: string) => Promise<void>;
  uploading: boolean;
  deleting: Set<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await onUploadReceipt(files[0]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await onUploadReceipt(files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Receipts</DialogTitle>
          <DialogDescription>
            Upload and manage receipts for transaction: {transaction?.description}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            uploading && "opacity-50"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {uploading ? "Uploading..." : "Drag and drop your receipt here"}
              </p>
              <p className="text-sm text-muted-foreground">
                or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:underline"
                  disabled={uploading}
                >
                  browse files
                </button>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports images, PDF, Word documents (Max: 10MB)
            </p>
          </div>
        </div>

        {/* Receipts List */}
        <div className="space-y-3">
          <h4 className="font-medium">Attached Receipts ({receipts.length})</h4>
          {receipts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No receipts attached to this transaction
            </p>
          ) : (
            receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{receipt.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(receipt.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(receipt.created_at).toLocaleDateString()}</span>
                      {receipt.processing_status && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            {receipt.processing_status}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`/api/receipts/${receipt.id}/download`, '_blank')}
                    disabled={deleting.has(receipt.id)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteReceipt(receipt.id)}
                    disabled={deleting.has(receipt.id)}
                  >
                    {deleting.has(receipt.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithNormalized[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [uncategorizedCount, setUncategorizedCount] = useState<number>(0);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithNormalized | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Receipt management state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedTransactionForReceipt, setSelectedTransactionForReceipt] = useState<TransactionWithNormalized | null>(null);
  const [uploadingReceipts, setUploadingReceipts] = useState<Set<string>>(new Set());
  const [deletingReceipts, setDeletingReceipts] = useState<Set<string>>(new Set());

  const supabase = createClient();
  const posthog = getPosthogClientBrowser();
  const { toast } = useToast();

  const isEnhancedUIEnabled = isUIFeatureEnabled(UI_FEATURE_FLAGS.TRANSACTIONS_ENHANCED_UI);

  // Initialize org ID on mount
  useEffect(() => {
    const orgId = getCurrentOrgId();
    if (orgId) {
      setCurrentOrgId(orgId);
    }
  }, []);

  useEffect(() => {
    if (currentOrgId) {
      fetchTransactions();
    }
  }, [currentOrgId, isEnhancedUIEnabled]);

  useEffect(() => {
    if (currentOrgId) {
      fetchCategories();
    }
  }, [currentOrgId, isEnhancedUIEnabled]);

  // Poll for uncategorized transaction count
  useEffect(() => {
    const fetchUncategorizedCount = async () => {
      try {
        const response = await fetch('/api/transactions/uncategorized-count');
        if (response.ok) {
          const data = await response.json();
          const newCount = data.uncategorizedCount || 0;
          
          // If categorization just completed, refresh transactions
          if (uncategorizedCount > 0 && newCount === 0) {
            fetchTransactions();
          }
          
          setUncategorizedCount(newCount);
        }
      } catch (error) {
        console.error('Failed to fetch uncategorized count:', error);
      }
    };

    // Fetch immediately
    fetchUncategorizedCount();

    // Poll every 5 seconds if there are uncategorized transactions
    const pollInterval = setInterval(() => {
      if (uncategorizedCount > 0) {
        fetchUncategorizedCount();
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [uncategorizedCount]);

  const filteredTransactions = useMemo(() => {
    if (!isEnhancedUIEnabled) return transactions;
    return filterTransactions(transactions, filters);
  }, [transactions, filters, isEnhancedUIEnabled]);

  // Note: Currently using account_id as account_name since there's no accounts relationship
  // In the future, create an accounts table and add foreign key relationship
  const distinctAccounts = useMemo(() => {
    const accountIds = transactions
      .map((tx) => tx.account_id)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);
    return accountIds.sort();
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

  // Receipt CRUD Operations using Supabase Storage directly
  const handleUploadReceipt = useCallback(async (file: File) => {
    if (!selectedTransactionForReceipt || !currentOrgId || !currentUserId) return;

    const transactionId = selectedTransactionForReceipt.id;
    setUploadingReceipts(prev => new Set(prev).add(transactionId));

    try {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${transactionId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `receipts/${currentOrgId}/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      // Create receipt record in database
      const receiptData = {
        org_id: currentOrgId,
        transaction_id: transactionId,
        file_path: filePath,
        uploaded_by: currentUserId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        processing_status: 'uploaded',
        checksum: '', // You might want to generate a checksum here
      };

      const { data: receipt, error: dbError } = await supabase
        .from('receipts')
        .insert(receiptData)
        .select()
        .single();

      if (dbError) {
        // If database insert fails, delete the uploaded file
        await supabase.storage.from('receipts').remove([filePath]);
        throw new Error(`Failed to create receipt record: ${dbError.message}`);
      }

      // Update transactions with new receipt
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionId 
          ? { ...tx, receipts: [...(tx.receipts || []), receipt] }
          : tx
      ));

      toast({
        title: "Receipt Uploaded",
        description: "Receipt has been successfully uploaded",
      });
    } catch (error) {
      console.error('Failed to upload receipt:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingReceipts(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  }, [selectedTransactionForReceipt, currentOrgId, currentUserId, supabase, toast]);

  const handleDownloadReceipt = useCallback(async (receipt: Receipt) => {
    try {
      // Get signed URL for download (valid for 1 hour)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.file_path, 3600); // 1 hour expiry

      if (signedUrlError) {
        throw new Error(`Failed to generate download URL: ${signedUrlError.message}`);
      }

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = signedUrlData.signedUrl;
      link.download = receipt.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download Started",
        description: "Receipt download has started",
      });
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download receipt. Please try again.",
        variant: "destructive",
      });
    }
  }, [supabase, toast]);

  const handleViewReceipt = useCallback(async (receipt: Receipt) => {
    try {
      // Get public URL for viewing
      const { data: publicUrlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(receipt.file_path);

      // Open in new tab
      window.open(publicUrlData.publicUrl, '_blank');
    } catch (error) {
      console.error('Failed to view receipt:', error);
      toast({
        title: "View Failed",
        description: "Failed to open receipt. Please try again.",
        variant: "destructive",
      });
    }
  }, [supabase, toast]);

  const handleDeleteReceipt = useCallback(async (receiptId: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    setDeletingReceipts(prev => new Set(prev).add(receiptId));

    try {
      // First get the receipt to get the file path
      const { data: receipt, error: fetchError } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch receipt: ${fetchError.message}`);
      }

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([receipt.file_path]);

      if (storageError) {
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }

      // Delete receipt record from database
      const { error: dbError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      if (dbError) {
        throw new Error(`Failed to delete receipt record: ${dbError.message}`);
      }

      // Remove receipt from transactions state
      setTransactions(prev => prev.map(tx => 
        tx.receipts 
          ? { ...tx, receipts: tx.receipts.filter(r => r.id !== receiptId) }
          : tx
      ));

      toast({
        title: "Receipt Deleted",
        description: "Receipt has been successfully deleted",
      });
    } catch (error) {
      console.error('Failed to delete receipt:', error);
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingReceipts(prev => {
        const next = new Set(prev);
        next.delete(receiptId);
        return next;
      });
    }
  }, [supabase, toast]);

  const handleManageReceipts = useCallback((transaction: TransactionWithNormalized) => {
    setSelectedTransactionForReceipt(transaction);
    setReceiptModalOpen(true);
  }, []);

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
    setFilters({
      ...initialFilterState,
      month: new Date().toISOString().slice(0, 7), // Reset to current month
    });
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

  const openTransactionDetail = useCallback((transaction: TransactionWithNormalized) => {
    setSelectedTransaction(transaction);
    setDetailModalOpen(true);
  }, []);

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
    if (!currentOrgId) {
      console.warn('No org ID available, skipping transaction fetch');
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No user found');
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const selectQuery = isEnhancedUIEnabled
        ? `
          id, date, amount_cents, currency, description, merchant_name, source, account_id, raw,
          category_id, confidence, needs_review, provider_tx_id, normalized_vendor,
          categories(name, type)
        `
        : "*";

      const { data, error } = await supabase
        .from("transactions")
        .select(selectQuery)
        .eq("org_id", currentOrgId)
        .order("date", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Error fetching transactions:", error);
        toast({
          title: "Error",
          description: "Failed to load transactions. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Fetch receipts for each transaction
      const transactionsWithReceipts = await Promise.all(
        (data || []).map(async (t:any) => {
          const categoryData = (t as any).categories
            ? Array.isArray((t as any).categories)
              ? (t as any).categories?.[0]
              : (t as any).categories
            : undefined;

          // Fetch receipts for this transaction
          const { data: receiptsData } = await supabase
            .from('receipts')
            .select('*')
            .eq('transaction_id', t.id)
            .eq('org_id', currentOrgId);

          return {
            ...(t as any),
            account_name: (t as any).account_id || "Unknown Account",
            account_mask: null,
            institution_name: (t as any).source || null,
            category_name: categoryData?.name || null,
            category_type: categoryData?.type || null,
            receipts: receiptsData || [],
          } as TransactionWithNormalized;
        })
      );

      setTransactions(transactionsWithReceipts);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load transactions. Please try again.",
        variant: "destructive",
      });
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

  if (!currentOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">No organization selected</p>
        </div>
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Receipt className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-semibold">No Organization Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Please select an organization from the organization switcher to view transactions.
                </p>
              </div>
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
      {isEnhancedUIEnabled && transactions.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month" className="text-xs">
                  Month
                </Label>
                <Select
                  value={filters.month}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, month: value }))}
                >
                  <SelectTrigger id="month">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YTD">Year to Date</SelectItem>
                    {Array.from({ length: 24 }, (_, i) => {
                      const date = new Date();
                      date.setMonth(date.getMonth() - i);
                      const yearMonth = date.toISOString().slice(0, 7);
                      const label = date.toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      });
                      return (
                        <SelectItem key={yearMonth} value={yearMonth}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
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
                  Account ID
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
                    {distinctAccounts.map((accountId) => (
                      <SelectItem key={accountId} value={accountId}>
                        {accountId}
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

      {/* Categorization Progress Badge */}
      {uncategorizedCount > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Categorizing {uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's' : ''}...</strong>
            {' '}This usually takes a few moments. The page will update automatically when complete.
          </AlertDescription>
        </Alert>
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
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Account ID
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Amount
                    </th>
                    {isEnhancedUIEnabled && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-80">
                        Category
                      </th>
                    )}
                    {isEnhancedUIEnabled && (
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Confidence
                      </th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Receipts
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction:any) => {
                    const isUpdating = updatingCategories.has(transaction.id);
                    const tier1 = getCategoryTier1(transaction.category_type);
                    const isSelected = selectedTransactions.has(transaction.id);
                    const amountCents = parseInt(transaction.amount_cents);
                    const isExpense = amountCents < 0;
                    const isIncome = amountCents > 0;
                    const receiptCount = transaction.receipts?.length || 0;

                    return (
                      <tr
                        key={transaction.id}
                        className={cn(
                          "border-b border-border-subtle last:border-0 hover:bg-muted/30 transition-colors",
                          isSelected && selectionMode && "bg-primary/5"
                        )}
                      >
                        {selectionMode && (
                          <td className="px-4 py-4 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(transaction.id)}
                              aria-label={`Select transaction ${transaction.description}`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-4 text-sm">
                          {new Date(transaction.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-4">
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
                        <td className="px-4 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <InstitutionLogo
                              institutionName={transaction.institution_name}
                              provider={transaction.source}
                              size={16}
                            />
                            <span className="font-mono text-xs">{transaction.account_name}</span>
                          </div>
                        </td>
                        <td className={cn(
                          "px-4 py-4 text-right text-sm font-semibold tabular-nums",
                          isExpense && "text-red-600",
                          isIncome && "text-green-600"
                        )}>
                          {isIncome && "+"}
                          {formatAmount(transaction.amount_cents, transaction.currency)}
                        </td>
                        {isEnhancedUIEnabled && (
                          <td className="px-4 py-4">
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
                                <SelectTrigger className="h-10 w-full border-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 transition-colors">
                                  <SelectValue>
                                    {transaction.category_name ? (
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const Icon = getCategoryIcon(transaction.category_id ?? null);
                                          return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
                                        })()}
                                        <span className="text-sm font-medium">{transaction.category_name}</span>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">Uncategorized</span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    <span className="text-muted-foreground">Uncategorized</span>
                                  </SelectItem>
                                  {categories.map((category) => {
                                    const catTier1 = getCategoryTier1(category.type);
                                    const Icon = getCategoryIcon(category.id);
                                    return (
                                      <SelectItem key={category.id} value={category.id}>
                                        <div className="flex items-center gap-2">
                                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
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
                          <td className="px-4 py-4 text-center">
                            <ConfidenceBadge
                              confidence={transaction.confidence ?? null}
                              size="sm"
                            />
                          </td>
                        )}
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {receiptCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {receiptCount}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleManageReceipts(transaction)}
                              className="h-8 w-8 p-0"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="sr-only">Manage receipts</span>
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTransactionDetail(transaction)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View details</span>
                          </Button>
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
            {filteredTransactions.map((transaction:any) => {
              const isUpdating = updatingCategories.has(transaction.id);
              const tier1 = getCategoryTier1(transaction.category_type);
              const amountCents = parseInt(transaction.amount_cents);
              const isExpense = amountCents < 0;
              const isIncome = amountCents > 0;
              const receiptCount = transaction.receipts?.length || 0;

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
                        <div className={cn(
                          "text-base font-semibold mt-1",
                          isExpense && "text-red-600",
                          isIncome && "text-green-600"
                        )}>
                          {isIncome && "+"}
                          {formatAmount(transaction.amount_cents, transaction.currency)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageReceipts(transaction)}
                          className="h-8 w-8 p-0 relative"
                        >
                          <FileText className="h-4 w-4" />
                          {receiptCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-xs w-4 h-4 flex items-center justify-center">
                              {receiptCount}
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTransactionDetail(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
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

                    {/* Account */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <InstitutionLogo
                        institutionName={transaction.institution_name}
                        provider={transaction.source}
                        size={14}
                      />
                      <span className="font-mono">{transaction.account_name}</span>
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
                                    <div className="flex items-center gap-2">
                                      {(() => {
                                        const Icon = getCategoryIcon(transaction.category_id ?? null);
                                        return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
                                      })()}
                                      <span className="text-sm font-medium">{transaction.category_name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Uncategorized</span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  <span className="text-muted-foreground">Uncategorized</span>
                                </SelectItem>
                                {categories.map((category) => {
                                  const catTier1 = getCategoryTier1(category.type);
                                  const Icon = getCategoryIcon(category.id);
                                  return (
                                    <SelectItem key={category.id} value={category.id}>
                                      <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
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
              {transactions.length === 0 ? (
                // No transactions at all - suggest connecting account
                <>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-semibold">No transactions found</h3>
                    <p className="text-sm text-muted-foreground">
                      Connect your bank accounts to start importing transaction data automatically.
                    </p>
                  </div>
                  <Button asChild size="lg" className="mt-2">
                    <a href="/settings/connections">Connect Bank Account</a>
                  </Button>
                </>
              ) : (
                // Transactions exist but filters return none - suggest clearing filters
                <>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-semibold">No transactions match your filters</h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search criteria or clear filters to see all {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}.
                    </p>
                  </div>
                  <Button onClick={clearFilters} size="lg" className="mt-2">
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

      {/* Receipt Management Modal */}
      <ReceiptManagementModal
        transaction={selectedTransactionForReceipt}
        receipts={selectedTransactionForReceipt?.receipts || []}
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        onUploadReceipt={handleUploadReceipt}
        onDeleteReceipt={handleDeleteReceipt}
        uploading={uploadingReceipts.has(selectedTransactionForReceipt?.id || '')}
        deleting={deletingReceipts}
      />
    </div>
  );
}