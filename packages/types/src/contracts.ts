import { z } from "zod";

// Common schemas
const orgIdSchema = z.string().brand<"OrgId">();
const connectionIdSchema = z.string().brand<"ConnectionId">();
const transactionIdSchema = z.string().brand<"TransactionId">();
const categoryIdSchema = z.string().brand<"CategoryId">();
const exportIdSchema = z.string().brand<"ExportId">();

// Base types and branded IDs - inferred from Zod schemas
export type OrgId = z.infer<typeof orgIdSchema>;
export type ConnectionId = z.infer<typeof connectionIdSchema>;
export type TransactionId = z.infer<typeof transactionIdSchema>;
export type CategoryId = z.infer<typeof categoryIdSchema>;
export type ExportId = z.infer<typeof exportIdSchema>;

// POST /auth/org.create
const orgCreateRequestSchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  timezone: z.string().min(1),
  taxYearStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const orgCreateResponseSchema = z.object({
  orgId: orgIdSchema,
});

export type OrgCreateRequest = z.infer<typeof orgCreateRequestSchema>;
export type OrgCreateResponse = z.infer<typeof orgCreateResponseSchema>;

// GET /connections.list
const connectionsListRequestSchema = z.object({
  orgId: orgIdSchema,
});

const connectionSchema = z.object({
  id: connectionIdSchema,
  provider: z.enum(["plaid", "square", "manual"]),
  status: z.enum(["active", "inactive", "error", "pending"]),
  scopes: z.array(z.string()),
  createdAt: z.string().datetime(),
});

const connectionsListResponseSchema = z.object({
  connections: z.array(connectionSchema),
});

export type ConnectionsListRequest = z.infer<typeof connectionsListRequestSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type ConnectionsListResponse = z.infer<typeof connectionsListResponseSchema>;

// POST /connections.create
const connectionsCreateRequestSchema = z.object({
  orgId: orgIdSchema,
  provider: z.enum(["plaid", "square", "manual"]),
  scopes: z.array(z.string()),
});

const connectionsCreateResponseSchema = z.object({
  connectionId: connectionIdSchema,
});

export type ConnectionsCreateRequest = z.infer<typeof connectionsCreateRequestSchema>;
export type ConnectionsCreateResponse = z.infer<typeof connectionsCreateResponseSchema>;

// GET /transactions.list
const transactionsListRequestSchema = z.object({
  orgId: orgIdSchema,
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

const transactionSchema = z.object({
  id: transactionIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int(),
  currency: z.string().length(3),
  description: z.string(),
  merchantName: z.string(),
  mcc: z.string().optional(),
  categoryId: categoryIdSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reviewed: z.boolean(),
  source: z.enum(["plaid", "square", "manual"]),
  raw: z.unknown(),
});

const transactionsListResponseSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().optional(),
});

export type TransactionsListRequest = z.infer<typeof transactionsListRequestSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionsListResponse = z.infer<typeof transactionsListResponseSchema>;

// POST /categorize.run
const categorizeRunRequestSchema = z.object({
  orgId: orgIdSchema,
  transactionIds: z.array(transactionIdSchema),
});

const categorizeResultSchema = z.object({
  id: transactionIdSchema,
  categoryId: categoryIdSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

const categorizeRunResponseSchema = z.object({
  results: z.array(categorizeResultSchema),
});

export type CategorizeRunRequest = z.infer<typeof categorizeRunRequestSchema>;
export type CategorizeResult = z.infer<typeof categorizeResultSchema>;
export type CategorizeRunResponse = z.infer<typeof categorizeRunResponseSchema>;

// POST /exports.create
const exportsCreateRequestSchema = z.object({
  orgId: orgIdSchema,
  type: z.enum(["csv", "qbo", "xero"]),
  params: z.unknown(),
});

const exportsCreateResponseSchema = z.object({
  exportId: exportIdSchema,
});

export type ExportsCreateRequest = z.infer<typeof exportsCreateRequestSchema>;
export type ExportsCreateResponse = z.infer<typeof exportsCreateResponseSchema>;

// Re-export all schemas for validation
export {
  orgCreateRequestSchema,
  orgCreateResponseSchema,
  connectionsListRequestSchema,
  connectionsListResponseSchema,
  connectionsCreateRequestSchema,
  connectionsCreateResponseSchema,
  transactionsListRequestSchema,
  transactionsListResponseSchema,
  categorizeRunRequestSchema,
  categorizeRunResponseSchema,
  exportsCreateRequestSchema,
  exportsCreateResponseSchema,
  connectionSchema,
  transactionSchema,
  categorizeResultSchema,
};