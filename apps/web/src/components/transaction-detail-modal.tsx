"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InstitutionLogo } from "@/components/ui/institution-logo";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { CategoryPill, type CategoryTier1 } from "@/components/ui/category-pill";
import { getCategoryIcon } from "@/lib/category-icons";
import { Calendar, CreditCard, Building2, Tag, FileText, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionDetailModalProps {
  transaction: {
    id: string;
    date: string;
    amount_cents: string;
    currency: string;
    description: string;
    merchant_name?: string;
    source: string;
    raw: Record<string, unknown>;
    account_name: string;
    account_mask: string | null;
    institution_name: string | null;
    category_name: string | null;
    category_type?: string | null;
    category_id?: string | null;
    confidence?: number | null;
    needs_review?: boolean;
    provider_tx_id?: string;
    normalized_vendor?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatAmount(amountCents: string, currency: string = "USD"): string {
  const amount = parseInt(amountCents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function getCategoryTier1(categoryType?: string | null): CategoryTier1 {
  if (!categoryType) return null;
  if (categoryType === "revenue") return "revenue";
  if (categoryType === "cogs") return "cogs";
  if (categoryType === "opex") return "opex";
  return null;
}

export function TransactionDetailModal({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailModalProps) {
  if (!transaction) return null;

  const amountCents = parseInt(transaction.amount_cents);
  const isExpense = amountCents < 0;
  const isIncome = amountCents > 0;
  const tier1 = getCategoryTier1(transaction.category_type);
  const CategoryIcon = getCategoryIcon(transaction.category_id ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Amount Section */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p
                className={cn(
                  "text-3xl font-bold",
                  isExpense && "text-red-600",
                  isIncome && "text-green-600"
                )}
              >
                {isIncome && "+"}
                {formatAmount(transaction.amount_cents, transaction.currency)}
              </p>
            </div>
            <Badge variant={isExpense ? "destructive" : "default"}>
              {isExpense ? "Expense" : "Income"}
            </Badge>
          </div>

          <Separator />

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Transaction Information
            </h3>

            <div className="grid gap-4">
              {/* Date */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(transaction.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Merchant/Vendor */}
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Merchant</p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.merchant_name || transaction.normalized_vendor || "Unknown"}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-muted-foreground">{transaction.description}</p>
                </div>
              </div>

              {/* Account */}
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Account</p>
                  <div className="flex items-center gap-2 mt-1">
                    <InstitutionLogo
                      institutionName={transaction.institution_name}
                      provider={transaction.source}
                      size={20}
                    />
                    <span className="text-sm text-muted-foreground">
                      {transaction.account_name}
                      {transaction.account_mask && (
                        <span className="text-muted-foreground/70"> (...{transaction.account_mask})</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Category */}
              {transaction.category_name && (
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Category</p>
                    <div className="flex items-center gap-2 mt-1">
                      <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                      <CategoryPill tier1={tier1} tier2={transaction.category_name} size="sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Confidence */}
              {transaction.confidence !== null && transaction.confidence !== undefined && (
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Categorization Confidence</p>
                    <div className="mt-1">
                      <ConfidenceBadge confidence={transaction.confidence} size="md" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Technical Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Technical Details
            </h3>

            <div className="grid gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                  {transaction.id}
                </code>
              </div>

              {transaction.provider_tx_id && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Provider Transaction ID</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {transaction.provider_tx_id}
                  </code>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Source</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {transaction.source}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Currency</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {transaction.currency}
                </Badge>
              </div>

              {transaction.needs_review && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Needs Review</span>
                  <Badge variant="destructive">Yes</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Raw Data (Collapsible) */}
          {transaction.raw && Object.keys(transaction.raw).length > 0 && (
            <>
              <Separator />
              <details className="space-y-2">
                <summary className="cursor-pointer font-semibold text-sm text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                  Raw Transaction Data
                </summary>
                <div className="mt-3">
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(transaction.raw, null, 2)}
                  </pre>
                </div>
              </details>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}