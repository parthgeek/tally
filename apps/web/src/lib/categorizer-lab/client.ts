import type { LabRunRequest, LabRunResponse } from "./types";

/**
 * Client for calling the categorizer lab API
 */
export class CategorizerLabClient {
  private baseUrl: string;

  constructor(baseUrl = "/api/dev/categorizer-lab") {
    this.baseUrl = baseUrl;
  }

  /**
   * Run categorization on a dataset
   */
  async run(request: LabRunRequest): Promise<LabRunResponse> {
    const response = await fetch(`${this.baseUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || "Unknown error";
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }

      throw new Error(`Lab run failed: ${errorMessage}`);
    }

    const result = await response.json();
    return result as LabRunResponse;
  }

  /**
   * Check if the lab is available (feature flag enabled)
   */
  async healthCheck(): Promise<{ available: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
      });

      if (response.status === 404) {
        return {
          available: false,
          message: "Lab is disabled or not available in production",
        };
      }

      if (!response.ok) {
        return {
          available: false,
          message: `Service unavailable: HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        available: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

/**
 * Default client instance
 */
export const labClient = new CategorizerLabClient();

/**
 * Run categorization with progress tracking
 */
export async function runWithProgress(
  request: LabRunRequest,
  onProgress?: (progress: { processed: number; total: number; current?: string }) => void
): Promise<LabRunResponse> {
  // For now, this is a simple wrapper around the basic run method
  // In the future, this could be enhanced with streaming/SSE for real-time progress

  const total = request.dataset.length;

  // Simulate progress callback at start
  onProgress?.({ processed: 0, total });

  try {
    const result = await labClient.run(request);

    // Simulate progress callback at completion
    onProgress?.({ processed: total, total });

    return result;
  } catch (error) {
    // Ensure progress callback is called even on error
    onProgress?.({ processed: 0, total });
    throw error;
  }
}

/**
 * Validate dataset before sending to API
 */
export function validateDatasetForAPI(request: LabRunRequest): string[] {
  const errors: string[] = [];

  if (!request.dataset || request.dataset.length === 0) {
    errors.push("Dataset cannot be empty");
  }

  if (request.dataset.length > 1000) {
    errors.push("Dataset cannot exceed 1000 transactions");
  }

  if (request.options.batchSize > request.dataset.length) {
    errors.push("Batch size cannot exceed dataset size");
  }

  if (request.options.concurrency > 5) {
    errors.push("Concurrency cannot exceed 5");
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  const duplicates: string[] = [];

  for (const tx of request.dataset) {
    if (ids.has(tx.id)) {
      duplicates.push(tx.id);
    } else {
      ids.add(tx.id);
    }
  }

  if (duplicates.length > 0) {
    errors.push(`Duplicate transaction IDs: ${duplicates.join(", ")}`);
  }

  return errors;
}

/**
 * Estimate request cost and time
 */
export function estimateRunCost(request: LabRunRequest): {
  estimatedTimeSeconds: number;
  estimatedLLMCalls: number;
  estimatedCostUSD: number;
} {
  const { dataset, options } = request;
  const transactionCount = dataset.length;

  // Estimate LLM calls based on mode
  let llmCallRate: number;
  switch (options.mode) {
    case "pass1":
      llmCallRate = 0;
      break;
    case "pass2":
      llmCallRate = 1;
      break;
    case "hybrid":
      // Assume 30% of transactions will need LLM (low confidence from Pass-1)
      llmCallRate = 0.3;
      break;
  }

  const estimatedLLMCalls = Math.ceil(transactionCount * llmCallRate);

  // Estimate time (rough approximation)
  const pass1TimePerTx = 0.05; // 50ms per transaction for rules
  const llmTimePerTx = 2.0; // 2s per transaction for LLM

  const pass1Time = transactionCount * pass1TimePerTx;
  const llmTime = estimatedLLMCalls * llmTimePerTx;
  const totalTime = (pass1Time + llmTime) / options.concurrency;

  // Estimate cost (rough approximation based on typical LLM pricing)
  const costPerLLMCall = 0.001; // $0.001 per call (adjust based on actual pricing)
  const estimatedCostUSD = estimatedLLMCalls * costPerLLMCall;

  return {
    estimatedTimeSeconds: Math.ceil(totalTime),
    estimatedLLMCalls,
    estimatedCostUSD,
  };
}

/**
 * Format API errors for display
 */
export function formatAPIError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    if ("error" in error && typeof error.error === "string") {
      return error.error;
    }
  }

  return "Unknown error occurred";
}
