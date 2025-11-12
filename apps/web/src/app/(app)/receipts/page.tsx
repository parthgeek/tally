// app/receipts/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      }
    } catch (err) {
      console.error("Error fetching receipts:", err);
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

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/receipts", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }
      }

      setSuccess(`Successfully uploaded ${files.length} file(s)`);
      fetchReceipts();
    } catch (err: any) {
      setError(err.message || "Failed to upload files");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this receipt?")) return;

    try {
      const response = await fetch(`/api/receipts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Receipt deleted");
        fetchReceipts();
      } else {
        setError("Failed to delete");
      }
    } catch (err) {
      setError("Failed to delete");
    }
  };

  const handleEdit = (receipt: Receipt) => {
    setEditingId(receipt.id);
    setEditForm({
      description: receipt.description,
      amount: receipt.amount,
      date: receipt.date,
      vendor: receipt.vendor,
      category: receipt.category,
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
        setSuccess("Receipt updated");
        setEditingId(null);
        fetchReceipts();
      } else {
        setError("Failed to update");
      }
    } catch (err) {
      setError("Failed to update");
    }
  };

  const handleDownload = async (receipt: Receipt) => {
    try {
      const response = await fetch(`/api/receipts/download?path=${encodeURIComponent(receipt.file_path)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = receipt.file_name;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError("Failed to download");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
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
        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {receipts.map((receipt) => (
          <Card key={receipt.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {receipt.mime_type.startsWith("image/") ? (
                    <ImageIcon className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                  <CardTitle className="text-sm truncate">{receipt.file_name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleEdit(receipt)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDelete(receipt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editingId === receipt.id ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={editForm.description || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, description: e.target.value })
                      }
                      className="h-8"
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
                          setEditForm({ ...editForm, amount: parseFloat(e.target.value) })
                        }
                        className="h-8"
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
                        className="h-8"
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
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Input
                      value={editForm.category || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, category: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {receipt.description && (
                    <p className="text-sm text-muted-foreground">{receipt.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {receipt.amount && (
                      <div>
                        <span className="text-muted-foreground">Amount:</span>{" "}
                        ${receipt.amount}
                      </div>
                    )}
                    {receipt.date && (
                      <div>
                        <span className="text-muted-foreground">Date:</span>{" "}
                        {new Date(receipt.date).toLocaleDateString()}
                      </div>
                    )}
                    {receipt.vendor && (
                      <div>
                        <span className="text-muted-foreground">Vendor:</span>{" "}
                        {receipt.vendor}
                      </div>
                    )}
                    {receipt.category && (
                      <div>
                        <span className="text-muted-foreground">Category:</span>{" "}
                        {receipt.category}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(receipt.file_size / 1024).toFixed(1)} KB • {new Date(receipt.created_at).toLocaleDateString()}
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

      {receipts.length === 0 && (
        <div className="text-center py-12">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No receipts uploaded yet</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload your first receipt
          </Button>
        </div>
      )}
    </div>
  );
}