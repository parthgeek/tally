"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { toUSD, toCentsString } from "@nexus/shared";

interface ThresholdSettings {
  lowBalanceThresholdCents: string;
}

export default function ThresholdsPage() {
  const [lowBalanceAmount, setLowBalanceAmount] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current thresholds
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["settings", "thresholds"],
    queryFn: async (): Promise<ThresholdSettings> => {
      const response = await fetch("/api/settings/thresholds");
      if (!response.ok) {
        throw new Error("Failed to fetch threshold settings");
      }
      return response.json();
    },
  });

  // Update thresholds mutation
  const updateThresholdsMutation = useMutation({
    mutationFn: async (data: ThresholdSettings) => {
      const response = await fetch("/api/settings/thresholds", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update thresholds");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate thresholds query
      queryClient.invalidateQueries({ queryKey: ["settings", "thresholds"] });

      // Invalidate dashboard query to update alerts
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      setIsEditing(false);
    },
  });

  // Set form value when data loads
  useEffect(() => {
    if (settings?.lowBalanceThresholdCents) {
      // Convert cents to dollars for display
      const dollars = parseInt(settings.lowBalanceThresholdCents) / 100;
      setLowBalanceAmount(dollars.toString());
    }
  }, [settings]);

  const handleSave = () => {
    if (!lowBalanceAmount) return;

    try {
      // Convert dollars to cents
      const cents = toCentsString(parseFloat(lowBalanceAmount));
      updateThresholdsMutation.mutate({
        lowBalanceThresholdCents: cents,
      });
    } catch (error) {
      console.error("Invalid amount:", error);
    }
  };

  const handleCancel = () => {
    if (settings?.lowBalanceThresholdCents) {
      const dollars = parseInt(settings.lowBalanceThresholdCents) / 100;
      setLowBalanceAmount(dollars.toString());
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Thresholds</h1>
          <p className="text-muted-foreground">
            Configure when to receive alerts about your financial data.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Thresholds</h1>
          <p className="text-muted-foreground">
            Configure when to receive alerts about your financial data.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load threshold settings. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentThresholdDisplay = settings?.lowBalanceThresholdCents
    ? toUSD(settings.lowBalanceThresholdCents)
    : "$1,000.00";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alert Thresholds</h1>
        <p className="text-muted-foreground">
          Configure when to receive alerts about your financial data.
        </p>
      </div>

      {updateThresholdsMutation.isSuccess && !isEditing && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Threshold settings updated successfully!
          </AlertDescription>
        </Alert>
      )}

      {updateThresholdsMutation.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{updateThresholdsMutation.error.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Low Balance Alert</span>
          </CardTitle>
          <CardDescription>
            Get notified when your cash on hand falls below this amount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current threshold</p>
                <p className="text-2xl font-bold">{currentThresholdDisplay}</p>
              </div>
              <Button onClick={() => setIsEditing(true)}>Edit Threshold</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lowBalanceAmount">Low Balance Threshold (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lowBalanceAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1000.00"
                    value={lowBalanceAmount}
                    onChange={(e) => setLowBalanceAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll receive an alert when your total cash on hand falls below this amount.
                </p>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleSave}
                  disabled={updateThresholdsMutation.isPending || !lowBalanceAmount}
                >
                  {updateThresholdsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateThresholdsMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unusual Spending Alert</CardTitle>
          <CardDescription>
            Automatically detect unusual spending patterns using statistical analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium text-green-600">Enabled</p>
              <p className="text-xs text-muted-foreground mt-1">
                Alerts when weekly spending is more than 2 standard deviations above normal.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">Automatic</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
