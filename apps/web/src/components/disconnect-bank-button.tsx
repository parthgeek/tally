"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { ConnectionId } from "@nexus/types/contracts";

interface DisconnectBankButtonProps {
  connectionId: ConnectionId;
  bankName: string;
  accountCount: number;
  onSuccess?: () => void;
  disabled?: boolean;
}

export function DisconnectBankButton({
  connectionId,
  bankName,
  accountCount,
  onSuccess,
  disabled = false,
}: DisconnectBankButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/connections/disconnect", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectionId,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to disconnect bank account";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      toast({
        title: "Bank account disconnected",
        description: result.message || "Your bank account has been successfully disconnected.",
      });

      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Disconnect error:", error);

      const errorMessage = error instanceof Error ? error.message : "Failed to disconnect bank account";

      toast({
        title: "Disconnect failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
        >
          Disconnect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Disconnect Bank Account</DialogTitle>
          <DialogDescription>
            Are you sure you want to disconnect <strong>{bankName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <strong>What happens when you disconnect:</strong>
            </div>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your {accountCount} connected account{accountCount !== 1 ? 's' : ''} will be deactivated</li>
              <li>New transactions will no longer be imported automatically</li>
              <li>Existing transaction history will be preserved</li>
              <li>You can reconnect this bank account at any time</li>
            </ul>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-800 text-xs">
                <strong>Note:</strong> This action will revoke access to your bank account data.
                All historical transactions will remain in your account for tax and reporting purposes.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={isLoading}
          >
            {isLoading ? "Disconnecting..." : "Disconnect Bank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}