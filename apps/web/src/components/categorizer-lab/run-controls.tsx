"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { estimateRunCost, validateDatasetForAPI } from "@/lib/categorizer-lab/client";
import type { EngineOptions, LabTransaction, LabRunRequest } from "@/lib/categorizer-lab/types";

interface RunControlsProps {
  dataset: LabTransaction[];
  onRunStart: (request: LabRunRequest) => Promise<void>;
  isRunning?: boolean;
}

export function RunControls({ dataset, onRunStart, isRunning }: RunControlsProps) {
  const [options, setOptions] = useState<EngineOptions>({
    mode: "hybrid",
    batchSize: 10,
    concurrency: 1,
    timeoutMs: 30000,
    useLLM: true,
    hybridThreshold: 0.95,
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Calculate estimates
  const request: LabRunRequest = { dataset, options };
  const estimates = dataset.length > 0 ? estimateRunCost(request) : null;

  const handleOptionChange = (key: keyof EngineOptions, value: string | number | boolean) => {
    const newOptions = { ...options, [key]: value };

    // Auto-adjust related options
    if (key === "mode") {
      if (value === "pass1") {
        newOptions.useLLM = false;
      } else if (value === "pass2" || value === "hybrid") {
        newOptions.useLLM = true;
      }
    }

    if (key === "useLLM") {
      if (value && options.mode === "pass1") {
        newOptions.mode = "hybrid";
      } else if (!value && options.mode !== "pass1") {
        newOptions.mode = "pass1";
      }
    }

    setOptions(newOptions);
  };

  const handleRun = async () => {
    // Validate request
    const errors = validateDatasetForAPI(request);
    setValidationErrors(errors);

    if (errors.length > 0) {
      return;
    }

    await onRunStart(request);
  };

  const canRun = dataset.length > 0 && !isRunning;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Engine Configuration</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="engine-mode">Engine Mode</Label>
              <select
                id="engine-mode"
                value={options.mode}
                onChange={(e) => handleOptionChange("mode", e.target.value)}
                className="w-full mt-1 rounded-md border border-gray-300 bg-white text-black py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isRunning}
              >
                <option value="pass1">Pass-1 Only (Rules)</option>
                <option value="pass2">Pass-2 Only (LLM)</option>
                <option value="hybrid">Hybrid (Rules + LLM)</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {options.mode === "pass1" && "Fast rule-based categorization only"}
                {options.mode === "pass2" && "LLM categorization for all transactions"}
                {options.mode === "hybrid" && "Rules first, LLM for low-confidence cases"}
              </p>
            </div>

            {options.mode === "hybrid" && (
              <div>
                <Label htmlFor="hybrid-threshold">Hybrid Threshold</Label>
                <Input
                  id="hybrid-threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={options.hybridThreshold}
                  onChange={(e) =>
                    handleOptionChange("hybridThreshold", parseFloat(e.target.value))
                  }
                  disabled={isRunning}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Use LLM if Pass-1 confidence &lt; {options.hybridThreshold}
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Execution Parameters</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="batch-size">Batch Size</Label>
              <Input
                id="batch-size"
                type="number"
                min="1"
                max="100"
                value={options.batchSize}
                onChange={(e) => handleOptionChange("batchSize", parseInt(e.target.value) || 10)}
                disabled={isRunning}
              />
            </div>

            <div>
              <Label htmlFor="concurrency">Concurrency</Label>
              <Input
                id="concurrency"
                type="number"
                min="1"
                max="5"
                value={options.concurrency}
                onChange={(e) => handleOptionChange("concurrency", parseInt(e.target.value) || 1)}
                disabled={isRunning}
              />
            </div>

            <div>
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                min="5000"
                max="300000"
                step="5000"
                value={options.timeoutMs || 30000}
                onChange={(e) => handleOptionChange("timeoutMs", parseInt(e.target.value) || 30000)}
                disabled={isRunning}
              />
            </div>
          </div>
        </div>

        {estimates && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Estimates</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{dataset.length}</div>
                <div className="text-sm text-gray-500">Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {estimates.estimatedTimeSeconds}s
                </div>
                <div className="text-sm text-gray-500">Est. Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {estimates.estimatedLLMCalls}
                </div>
                <div className="text-sm text-gray-500">LLM Calls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  ${estimates.estimatedCostUSD.toFixed(3)}
                </div>
                <div className="text-sm text-gray-500">Est. Cost</div>
              </div>
            </div>
          </div>
        )}

        {validationErrors.length > 0 && (
          <Alert>
            <div className="text-red-800">
              <p className="font-semibold">Validation Errors:</p>
              <ul className="list-disc list-inside mt-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant={options.mode === "pass1" ? "default" : "secondary"}>
              Pass-1: Rules
            </Badge>
            {options.useLLM && (
              <Badge variant={options.mode === "pass2" ? "default" : "secondary"}>
                Pass-2: LLM
              </Badge>
            )}
            <Badge variant="outline" data-testid="transaction-count-badge">
              {dataset.length} transactions
            </Badge>
          </div>

          <Button onClick={handleRun} disabled={!canRun} size="lg" className="min-w-[120px]">
            {isRunning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Running...
              </>
            ) : (
              "Run Categorization"
            )}
          </Button>
        </div>

        <div className="text-sm text-gray-500">
          <p>
            <strong>Mode Details:</strong>
          </p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>
              <strong>Pass-1:</strong> Fast rule-based matching using MCCs, vendor patterns, and
              heuristics
            </li>
            <li>
              <strong>Pass-2:</strong> LLM-powered categorization for complex or ambiguous
              transactions
            </li>
            <li>
              <strong>Hybrid:</strong> Use Pass-1 first, fall back to Pass-2 for low-confidence
              results
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
