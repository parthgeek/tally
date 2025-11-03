"use client";

import { useState } from "react";
import { Upload, FileText, Check } from "lucide-react";
import { Badge } from "./primitives";
import { mockReceipts } from "./mock-data";

/**
 * Receipts visual (storage-only, no OCR)
 * Shows receipt attachment and storage interface
 */
export function ReceiptsVisual() {
  const [receipts, setReceipts] = useState(mockReceipts);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddReceipt = () => {
    setIsAdding(true);
    
    // Simulate adding a new receipt after a short delay
    setTimeout(() => {
      setReceipts([
        ...receipts,
        {
          id: `${receipts.length + 1}`,
          name: `receipt_${String(receipts.length + 1).padStart(3, "0")}.pdf`,
          size: "156 KB",
          type: "PDF",
        },
      ]);
      setIsAdding(false);
    }, 800);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Transaction summary */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Transaction</h4>
            <div className="p-4 rounded-lg border border-border bg-card/50">
              <p className="text-sm font-medium mb-1">Amazon Web Services</p>
              <p className="text-xs text-muted-foreground mb-2">Jan 28, 2025</p>
              <p className="text-lg font-mono font-semibold">$342.50</p>
            </div>
          </div>

          <button
            onClick={handleAddReceipt}
            disabled={isAdding || receipts.length >= 4}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isAdding ? "Adding..." : "Add Receipt"}
            </span>
          </button>
        </div>

        {/* Right: Receipts grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Stored Receipts ({receipts.length})
            </h4>
            <Badge variant="success" size="sm">
              <Check className="w-3 h-3 mr-1" />
              Audit Ready
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="aspect-square rounded-lg border border-border bg-gradient-to-br from-card to-muted/30 p-3 flex flex-col items-center justify-center text-center hover:border-primary/50 transition-colors"
              >
                <FileText className="w-8 h-8 text-primary mb-2" />
                <p className="text-xs font-medium truncate w-full px-1">{receipt.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {receipt.size} • {receipt.type}
                </p>
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 4 - receipts.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square rounded-lg border-2 border-dashed border-border bg-muted/20"
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Secure storage • Attach receipts to any transaction
          </p>
        </div>
      </div>
    </div>
  );
}

