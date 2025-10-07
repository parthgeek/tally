import React, { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { InfiniteData } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryCell } from "./category-cell";
import { WhyPopover } from "./why-popover";
import { Check, FileText, Calendar, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { toUSD } from "@nexus/shared";
import type { ReviewTransactionItem, ReviewListResponse } from "@nexus/types";

interface ReviewTableProps {
  data?: InfiniteData<ReviewListResponse, unknown> | undefined;
  selectedRows: Set<string>;
  onSelectRows: (selected: Set<string>) => void;
  onLoadMore: () => void;
  selectedIndex?: number | undefined;
  editingIndex?: number | undefined;
  onEdit?: (index: number) => void | undefined;
  onKeyDown?: (event: React.KeyboardEvent) => void | undefined;
  className?: string | undefined;
}

interface ReviewTableRowProps {
  transaction: ReviewTransactionItem;
  index: number;
  isSelected: boolean;
  isRowSelected: boolean;
  isEditing: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  style: React.CSSProperties;
}

function ReviewTableRow({
  transaction,
  index,
  isSelected,
  isRowSelected,
  isEditing,
  onSelect,
  onEdit,
  style,
}: ReviewTableRowProps) {
  const amount = parseFloat(transaction.amount_cents) / 100;
  const isExpense = amount < 0;
  const isIncome = amount > 0;

  return (
    <div
      style={style}
      className={cn(
        "flex items-center gap-3 px-4 py-2 border-b hover:bg-gray-50 transition-colors",
        isSelected && "bg-blue-50 ring-2 ring-blue-200",
        isRowSelected && "bg-blue-100"
      )}
    >
      {/* Selection checkbox */}
      <div className="flex items-center">
        <Checkbox checked={isRowSelected} onCheckedChange={onSelect} className="h-4 w-4" />
      </div>

      {/* Date */}
      <div className="w-24 text-sm text-muted-foreground">
        {new Date(transaction.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </div>

      {/* Merchant/Description */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {transaction.merchant_name || transaction.description}
        </div>
        {transaction.merchant_name && transaction.merchant_name !== transaction.description && (
          <div className="text-sm text-muted-foreground truncate">{transaction.description}</div>
        )}
      </div>

      {/* Amount */}
      <div className="w-24 text-right">
        <div
          className={cn("font-medium", isExpense && "text-red-600", isIncome && "text-green-600")}
        >
          {toUSD(transaction.amount_cents)}
        </div>
      </div>

      {/* Category */}
      <div className="w-48">
        <CategoryCell
          transaction={transaction}
          isSelected={isSelected}
          isEditing={isEditing}
          onEdit={onEdit}
        />
      </div>

      {/* Confidence/Why */}
      <div className="w-16 flex justify-center">
        <WhyPopover transaction={transaction} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {transaction.needs_review && (
          <Badge variant="outline" className="h-5 px-1 text-xs">
            Review
          </Badge>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          title="Accept as-is (Shift+Enter)"
        >
          <Check className="h-3 w-3" />
        </Button>

        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Attach receipt (Ctrl+R)">
          <FileText className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function ReviewTable({
  data,
  selectedRows,
  onSelectRows,
  onLoadMore,
  selectedIndex = -1,
  editingIndex,
  onEdit,
  onKeyDown,
  className,
}: ReviewTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten all items from pages
  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data?.pages]);

  const hasNextPage = data?.pages?.[data.pages.length - 1]?.hasMore ?? false;

  // Virtual table configuration
  const virtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height
    overscan: 10, // Render extra items for smooth scrolling
  });

  // Handle row selection
  const handleRowSelect = (transactionId: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    onSelectRows(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(allItems.map((item) => item.id));
      onSelectRows(allIds);
    } else {
      onSelectRows(new Set());
    }
  };

  const isAllSelected = allItems.length > 0 && selectedRows.size === allItems.length;
  const isPartiallySelected = selectedRows.size > 0 && selectedRows.size < allItems.length;

  // Load more when near the end
  const virtualItems = virtualizer.getVirtualItems();
  React.useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= allItems.length - 5 && hasNextPage) {
      onLoadMore();
    }
  }, [virtualItems, allItems.length, hasNextPage, onLoadMore]);

  if (!allItems.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No transactions need review
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col border rounded-lg bg-white", className)}>
      {/* Table Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50 text-sm font-medium">
        <div className="flex items-center">
          <Checkbox
            checked={isAllSelected}
            ref={(el) => {
              if (el) {
                // Access the underlying input element for indeterminate state
                const input = el.querySelector("input");
                if (input) input.indeterminate = isPartiallySelected;
              }
            }}
            onCheckedChange={handleSelectAll}
            className="h-4 w-4"
          />
        </div>

        <div className="w-24 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Date
        </div>

        <div className="flex-1">Merchant / Description</div>

        <div className="w-24 text-right flex items-center justify-end gap-1">
          <DollarSign className="h-3 w-3" />
          Amount
        </div>

        <div className="w-48">Category</div>

        <div className="w-16 text-center">Why?</div>

        <div className="w-24 text-center">Actions</div>
      </div>

      {/* Virtualized Table Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onKeyDown={onKeyDown}
        tabIndex={0}
        style={{ height: "600px" }} // Fixed height for virtualization
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const transaction = allItems[virtualItem.index];
            if (!transaction) return null;

            return (
              <ReviewTableRow
                key={transaction.id}
                transaction={transaction}
                index={virtualItem.index}
                isSelected={selectedIndex === virtualItem.index}
                isRowSelected={selectedRows.has(transaction.id)}
                isEditing={editingIndex === virtualItem.index}
                onSelect={(checked) => handleRowSelect(transaction.id, checked)}
                onEdit={() => onEdit?.(virtualItem.index)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Loading indicator */}
      {hasNextPage && (
        <div className="border-t p-4 text-center text-sm text-muted-foreground">
          Loading more transactions...
        </div>
      )}
    </div>
  );
}
