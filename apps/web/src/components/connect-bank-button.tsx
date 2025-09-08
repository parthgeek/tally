"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getErrorMessage, isRetryableError } from "@/lib/plaid/errors";

interface ConnectBankButtonProps {
  onSuccess?: () => void;
  onExit?: (error: unknown, metadata: unknown) => void;
}

export function ConnectBankButton({ onSuccess, onExit }: ConnectBankButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isReinitialization, setIsReinitialization] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const handleConnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/plaid/link-token", { method: "POST" });
      if (!response.ok) throw new Error("Failed to get link token");

      const { linkToken: newLinkToken } = await response.json();
      setLinkToken(newLinkToken);

      // Store for potential reinitialization
      localStorage.setItem("plaid_link_token", newLinkToken);
    } catch (fetchError) {
      console.error("Link token fetch error:", fetchError);
      toast({
        title: "Failed to initialize",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Check for OAuth reinitialization
  useEffect(() => {
    const shouldReinitialize = searchParams.get("reinitialize_link") === "true";
    const oauthStateId = searchParams.get("oauth_state_id");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      const errorMessage = getErrorMessage(error);
      const retryable = isRetryableError(error);

      toast({
        title: "Connection failed",
        description: `${errorMessage}${retryable ? " Click to retry." : ""}`,
        variant: "destructive",
      });
    }

    // Handle OAuth reinitialization
    if (shouldReinitialize && oauthStateId) {
      setIsReinitialization(true);
      // Retrieve stored link token from localStorage or make new request
      const storedToken = localStorage.getItem("plaid_link_token");
      if (storedToken) {
        setLinkToken(storedToken);
      } else {
        // If no stored token, create a new one
        void handleConnect();
      }
    }
  }, [searchParams, toast, handleConnect]);

  const { open, ready, error } = usePlaidLink({
    token: linkToken!,
    ...(isReinitialization ? { receivedRedirectUri: window.location.href } : {}),
    onSuccess: async (public_token, metadata) => {
      try {
        setIsLoading(true);

        // Clear stored token on success
        localStorage.removeItem("plaid_link_token");

        const response = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, metadata }),
        });

        if (!response.ok) throw new Error("Exchange failed");

        await response.json();
        toast({ title: "Bank connected successfully!" });
        onSuccess?.();
      } catch (exchangeError) {
        console.error("Token exchange error:", exchangeError);
        toast({
          title: "Connection failed",
          description: "Failed to complete account connection. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    onExit: (err, metadata) => {
      if (err) {
        toast({
          title: "Connection cancelled",
          description: err.error_message || "Please try again.",
          variant: "destructive",
        });
      }

      if (onExit) {
        onExit(err, metadata);
      }
    },
  });

  // Auto-open for reinitialization
  useEffect(() => {
    if (isReinitialization && ready && linkToken) {
      open();
    }
  }, [isReinitialization, ready, linkToken, open]);

  if (error) {
    return (
      <div className="text-sm text-red-600">Error initializing Plaid Link: {error.message}</div>
    );
  }

  const buttonText = () => {
    if (isLoading) return "Connecting...";
    if (isReinitialization) return "Completing Connection...";
    return "Connect Bank Account";
  };

  return (
    <Button
      onClick={linkToken ? () => open() : handleConnect}
      disabled={linkToken ? !ready : false || isLoading}
    >
      {buttonText()}
    </Button>
  );
}
