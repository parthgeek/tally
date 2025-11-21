"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Download,
  AlertCircle,
  CheckCircle,
  Edit,
  X,
} from "lucide-react";

interface Receipt {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  description?: string;
  amount?: number;
  date?: string;
  vendor?: string;
  category?: string;
  created_at: string;
  updated_at?: string;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Receipt>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/receipts");
      if (response.ok) {
        const data = await response.json();
        setReceipts(data.receipts || []);
      } else {
        setError("Failed to load receipts");
      }
    } catch (err) {
      console.error("Error fetching receipts:", err);
      setError("Failed to load receipts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    let successCount = 0;
    let failCount = 0;

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch("/api/receipts", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            successCount++;
          } else {
            const data = await response.json();
            console.error(`Failed to upload ${file.name}:`, data.error);
            failCount++;
          }
        } catch (err) {
          console.error(`Error uploading ${file.name}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(
          `Successfully uploaded ${successCount} file(s)${
            failCount > 0 ? `, ${failCount} failed` : ""
          }`
        );
        fetchReceipts();
      } else {
        setError("All uploads failed");
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this receipt?")) return;

    try {
      const response = await fetch(`/api/receipts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Receipt deleted successfully");
        fetchReceipts();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete receipt");
      }
    } catch (err) {
      console.error("Error deleting receipt:", err);
      setError("Failed to delete receipt");
    }
  };

  const handleEdit = (receipt: Receipt) => {
    setEditingId(receipt.id);
    setEditForm({
      description: receipt.description || "",
      amount: receipt.amount,
      date: receipt.date || "",
      vendor: receipt.vendor || "",
      category: receipt.category || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const response = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });

      if (response.ok) {
        setSuccess("Receipt updated successfully");
        setEditingId(null);
        setEditForm({});
        fetchReceipts();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update receipt");
      }
    } catch (err) {
      console.error("Error updating receipt:", err);
      setError("Failed to update receipt");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDownload = async (receipt: Receipt) => {
    try {
      const response = await fetch(
        `/api/receipts/download?path=${encodeURIComponent(receipt.file_path)}`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = receipt.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        setError("Failed to download file");
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      setError("Failed to download file");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Receipts</h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage your receipt images and PDFs
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {receipts.length === 0 ? (
        <div className="text-center py-12">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">No receipts uploaded yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your first receipt to get started
          </p>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Receipt
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {receipts.map((receipt) => (
            <Card key={receipt.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {receipt.mime_type.startsWith("image/") ? (
                      <ImageIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    )}
                    <CardTitle className="text-sm truncate" title={receipt.file_name}>
                      {receipt.file_name}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(receipt)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(receipt.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingId === receipt.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={editForm.description || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, description: e.target.value })
                        }
                        className="h-8 mt-1"
                        placeholder="Enter description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.amount || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              amount: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          className="h-8 mt-1"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={editForm.date || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, date: e.target.value })
                          }
                          className="h-8 mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Vendor</Label>
                      <Input
                        value={editForm.vendor || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, vendor: e.target.value })
                        }
                        className="h-8 mt-1"
                        placeholder="Enter vendor name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Input
                        value={editForm.category || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, category: e.target.value })
                        }
                        className="h-8 mt-1"
                        placeholder="Enter category"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={handleSaveEdit} className="flex-1">
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {receipt.description && (
                      <p className="text-sm text-foreground line-clamp-2">
                        {receipt.description}
                      </p>
                    )}
                    <div className="space-y-1.5 text-xs">
                      {receipt.amount && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">
                            {formatCurrency(receipt.amount)}
                          </span>
                        </div>
                      )}
                      {receipt.date && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date:</span>
                          <span>
                            {new Date(receipt.date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {receipt.vendor && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vendor:</span>
                          <span className="truncate ml-2">{receipt.vendor}</span>
                        </div>
                      )}
                      {receipt.category && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="truncate ml-2">{receipt.category}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {formatFileSize(receipt.file_size)} •{" "}
                      {new Date(receipt.created_at).toLocaleDateString()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDownload(receipt)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}