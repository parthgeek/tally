import { z } from "zod";

// Lab-specific transaction format (independent of production types)
export const labTransactionSchema = z.object({
  id: z.string(),
  merchantName: z.string().optional(),
  description: z.string(),
  mcc: z.string().optional(),
  amountCents: z.string(), // Keep as string for exact decimal arithmetic
  date: z.string().optional(),
  currency: z.string().default("USD"),
  categoryId: z.string().optional(), // Ground truth for accuracy calculation
});

export type LabTransaction = z.infer<typeof labTransactionSchema>;

// Engine execution modes
export const engineModeSchema = z.enum(["pass1", "pass2", "hybrid"]);
export type EngineMode = z.infer<typeof engineModeSchema>;

// Engine configuration options
export const engineOptionsSchema = z.object({
  mode: engineModeSchema,
  batchSize: z.number().int().positive().default(10),
  concurrency: z.number().int().positive().max(5).default(1),
  timeoutMs: z.number().int().positive().optional(),
  useLLM: z.boolean().default(false), // Alias for pass2/hybrid
  hybridThreshold: z.number().min(0).max(1).default(0.95), // Confidence threshold for hybrid mode
});

export type EngineOptions = z.infer<typeof engineOptionsSchema>;

// Per-transaction result
export const transactionResultSchema = z.object({
  id: z.string(),
  predictedCategoryId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.array(z.string()).default([]),
  engine: z.enum(["pass1", "llm"]),
  timings: z.object({
    totalMs: z.number(),
    pass1Ms: z.number().optional(),
    pass2Ms: z.number().optional(),
  }),
  error: z.string().optional(),
});

export type TransactionResult = z.infer<typeof transactionResultSchema>;

// Aggregate metrics
export const metricsSchema = z.object({
  totals: z.object({
    count: z.number(),
    errors: z.number(),
    pass1Only: z.number(),
    llmUsed: z.number(),
  }),
  latency: z.object({
    p50: z.number(),
    p95: z.number(),
    p99: z.number(),
    mean: z.number(),
  }),
  accuracy: z
    .object({
      overall: z.number(),
      perCategory: z.array(
        z.object({
          categoryId: z.string(),
          accuracy: z.number(),
          precision: z.number(),
          recall: z.number(),
          f1: z.number(),
          support: z.number(), // Number of ground truth examples
        })
      ),
      confusionMatrix: z.array(z.array(z.number())),
      categoryLabels: z.array(z.string()),
    })
    .optional(),
  confidence: z.object({
    mean: z.number(),
    histogram: z.array(
      z.object({
        bin: z.string(), // e.g., "0.0-0.1"
        count: z.number(),
      })
    ),
  }),
  cost: z
    .object({
      estimatedUsd: z.number(),
      calls: z.number(),
    })
    .optional(),
});

export type Metrics = z.infer<typeof metricsSchema>;

// Lab run request payload
export const labRunRequestSchema = z.object({
  dataset: z.array(labTransactionSchema),
  options: engineOptionsSchema,
});

export type LabRunRequest = z.infer<typeof labRunRequestSchema>;

// Lab run response
export const labRunResponseSchema = z.object({
  results: z.array(transactionResultSchema),
  metrics: metricsSchema,
  status: z.enum(["success", "partial", "failed"]),
  errors: z.array(z.string()).default([]),
});

export type LabRunResponse = z.infer<typeof labRunResponseSchema>;

// Dataset upload formats
export const datasetUploadSchema = z.object({
  format: z.enum(["json", "csv"]),
  data: z.string(), // Raw file content
});

export type DatasetUpload = z.infer<typeof datasetUploadSchema>;

// Synthetic data generation options
export const syntheticOptionsSchema = z.object({
  count: z.number().int().positive().max(1000).default(100),
  vendorNoisePercent: z.number().min(0).max(100).default(10),
  mccMix: z.enum(["balanced", "restaurant-heavy", "retail-heavy", "random"]).default("balanced"),
  positiveNegativeRatio: z.number().min(0).default(0.8), // 0.8 = 80% expenses, 20% income
  seed: z.string().optional(), // For deterministic generation
});

export type SyntheticOptions = z.infer<typeof syntheticOptionsSchema>;

// Export formats
export const exportFormatSchema = z.enum(["json", "csv"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

// Progress tracking (for future streaming implementation)
export const progressUpdateSchema = z.object({
  processed: z.number(),
  total: z.number(),
  currentTransaction: z.string().optional(),
  throughputPerSecond: z.number().optional(),
  etaSeconds: z.number().optional(),
  errors: z.array(z.string()),
});

export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;
