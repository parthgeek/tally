/**
 * Comprehensive input validation schemas for all API endpoints
 * Enhanced security validation with sanitization and attack prevention
 */

import { z } from 'zod';

// Base validation utilities
const createStringSchema = (options: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  sanitize?: boolean;
}) => {
  let schema = z.string();

  if (options.minLength !== undefined) {
    schema = schema.min(options.minLength);
  }

  if (options.maxLength !== undefined) {
    schema = schema.max(options.maxLength);
  }

  if (options.pattern) {
    schema = schema.regex(options.pattern);
  }

  if (options.sanitize) {
    return schema.transform(val => val.trim().replace(/[<>"`]/g, ''));
  }

  return schema;
};

// Common field validators
export const validators = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // Email validation with normalization
  email: z.string()
    .email('Invalid email format')
    .max(254)
    .transform(val => val.trim().toLowerCase()),

  // Secure password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/\d/, 'Password must contain number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain special character'),

  // Organization name with sanitization
  organizationName: createStringSchema({
    minLength: 1,
    maxLength: 100,
    sanitize: true,
  }),

  // Safe text input (prevents XSS)
  safeText: z.string()
    .max(1000)
    .transform(val => val.trim().replace(/[<>`]/g, '')),

  // URL validation
  url: z.string().url('Invalid URL format').max(2000),

  // Pagination parameters
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Date range validation
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).refine(data => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  }, 'Start date must be before end date'),

  // Financial amount validation (in cents)
  amount: z.coerce.number()
    .int('Amount must be an integer')
    .min(-999999999, 'Amount too small')
    .max(999999999, 'Amount too large'),

  // Category validation
  categoryId: z.string().uuid('Invalid category ID'),

  // File upload validation
  fileUpload: z.object({
    name: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename'),
    type: z.enum(['image/jpeg', 'image/png', 'application/pdf'], {
      message: 'Only JPEG, PNG, and PDF files allowed',
    }),
    size: z.number().max(10 * 1024 * 1024, 'File too large (max 10MB)'),
  }),
};

// Authentication schemas
export const authSchemas = {
  signIn: z.object({
    email: validators.email,
    password: z.string().min(1, 'Password required'),
  }),

  signUp: z.object({
    email: validators.email,
    password: validators.password,
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),

  resetPassword: z.object({
    email: validators.email,
  }),

  updatePassword: z.object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: validators.password,
    confirmPassword: z.string(),
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
};

// Organization schemas
export const organizationSchemas = {
  create: z.object({
    name: validators.organizationName,
    industry: z.enum([
      'Salon/Beauty',
      'Restaurant',
      'Retail',
      'Healthcare',
      'Professional Services',
      'Other',
    ]),
    description: validators.safeText.optional(),
  }),

  update: z.object({
    name: validators.organizationName.optional(),
    industry: z.enum([
      'Salon/Beauty',
      'Restaurant',
      'Retail',
      'Healthcare',
      'Professional Services',
      'Other',
    ]).optional(),
    description: validators.safeText.optional(),
  }),

  memberInvite: z.object({
    email: validators.email,
    role: z.enum(['admin', 'member', 'viewer']),
  }),
};

// Plaid integration schemas
export const plaidSchemas = {
  exchange: z.object({
    public_token: z.string()
      .min(10, 'Invalid public token')
      .max(500, 'Public token too long')
      .regex(/^public-[a-zA-Z0-9-_]+$/, 'Invalid public token format'),

    metadata: z.object({
      institution_id: z.string().optional(),
      account_id: z.string().optional(),
      link_session_id: z.string().optional(),
    }).passthrough().optional(),
  }),

  linkToken: z.object({
    userId: validators.uuid.optional(),
    orgId: validators.uuid,
  }),

  webhookVerification: z.object({
    webhook_type: z.enum(['TRANSACTIONS', 'ITEM', 'INCOME', 'ASSETS']),
    webhook_code: z.string().min(1).max(50),
    item_id: z.string().min(1).max(100),
    request_id: z.string().optional(),
    error: z.object({
      error_type: z.string(),
      error_code: z.string(),
      error_message: z.string(),
    }).optional(),
  }),
};

// Transaction schemas
export const transactionSchemas = {
  list: z.object({
    orgId: validators.uuid,
    ...validators.dateRange.shape,
    page: validators.page,
    limit: validators.limit,
    categoryId: validators.categoryId.optional(),
    searchTerm: validators.safeText.optional(),
  }),

  correct: z.object({
    transactionId: validators.uuid,
    categoryId: validators.categoryId,
    description: validators.safeText.optional(),
    createRule: z.boolean().default(false),
  }),

  bulkCorrect: z.object({
    transactionIds: z.array(validators.uuid).min(1).max(100),
    categoryId: validators.categoryId,
    createRule: z.boolean().default(false),
  }),

  create: z.object({
    orgId: validators.uuid,
    accountId: validators.uuid,
    amount: validators.amount,
    description: validators.safeText,
    date: z.string().datetime(),
    categoryId: validators.categoryId.optional(),
  }),
};

// Export schemas
export const exportSchemas = {
  create: z.object({
    orgId: validators.uuid,
    type: z.enum(['csv', 'quickbooks', 'xero']),
    ...validators.dateRange.shape,
    categoryIds: z.array(validators.categoryId).optional(),
    includeReceipts: z.boolean().default(false),
  }),

  download: z.object({
    exportId: validators.uuid,
  }),
};

// Receipt schemas
export const receiptSchemas = {
  upload: z.object({
    orgId: validators.uuid,
    transactionId: validators.uuid.optional(),
    file: validators.fileUpload,
  }),

  process: z.object({
    receiptId: validators.uuid,
    extractData: z.boolean().default(true),
  }),
};

// Dashboard schemas
export const dashboardSchemas = {
  metrics: z.object({
    orgId: validators.uuid,
    ...validators.dateRange.shape,
    granularity: z.enum(['day', 'week', 'month']).default('day'),
  }),

  cashFlow: z.object({
    orgId: validators.uuid,
    ...validators.dateRange.shape,
    categoryIds: z.array(validators.categoryId).optional(),
  }),
};

// Settings schemas
export const settingsSchemas = {
  thresholds: z.object({
    orgId: validators.uuid,
    lowCashFlowWarning: validators.amount,
    highExpenseAlert: validators.amount,
    categorizeThreshold: z.number().min(0).max(1),
  }),

  notifications: z.object({
    emailAlerts: z.boolean(),
    weeklyReports: z.boolean(),
    categoryingReminders: z.boolean(),
  }),

  integrations: z.object({
    plaidEnabled: z.boolean(),
    quickbooksEnabled: z.boolean(),
    xeroEnabled: z.boolean(),
  }),
};

// Review schemas
export const reviewSchemas = {
  list: z.object({
    orgId: validators.uuid,
    status: z.enum(['pending', 'reviewed', 'all']).default('pending'),
    ...validators.dateRange.shape,
    page: validators.page,
    limit: validators.limit,
  }),

  update: z.object({
    transactionId: validators.uuid,
    approved: z.boolean(),
    categoryId: validators.categoryId.optional(),
    notes: validators.safeText.optional(),
  }),
};

// API key schemas
export const apiKeySchemas = {
  create: z.object({
    name: validators.safeText,
    permissions: z.array(z.enum(['read', 'write', 'admin'])),
    expiresAt: z.string().datetime().optional(),
  }),

  revoke: z.object({
    keyId: validators.uuid,
  }),
};

// Generic request validation
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

/**
 * Enhanced request body validation with security features
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
  options: {
    maxSize?: number;
    logErrors?: boolean;
    sanitize?: boolean;
  } = {}
): Promise<ValidationResult<T>> {
  try {
    const { maxSize = 1024 * 1024, logErrors = true, sanitize = true } = options;

    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        error: 'Content-Type must be application/json',
      };
    }

    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      return {
        success: false,
        error: 'Request body too large',
      };
    }

    // Parse JSON with error handling
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON format',
      };
    }

    // Basic sanitization if enabled
    if (sanitize && typeof body === 'object' && body !== null) {
      body = sanitizeObject(body);
    }

    // Validate against schema
    const result = schema.safeParse(body);

    if (!result.success) {
      if (logErrors) {
        console.warn('Request validation failed:', {
          errors: result.error.issues,
          path: request.url,
        });
      }

      return {
        success: false,
        error: 'Validation failed',
        details: result.error.issues,
      };
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    console.error('Request validation error:', error);
    return {
      success: false,
      error: 'Internal validation error',
    };
  }
}

/**
 * Sanitize object to prevent XSS and injection attacks
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj.trim().replace(/[<>`]/g, '');
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.replace(/[<>`]/g, '');
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate query parameters with schema
 */
export function validateQueryParams<T>(
  url: URL,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    const params: any = {};

    for (const [key, value] of url.searchParams.entries()) {
      // Handle array parameters (e.g., ?tags=a&tags=b)
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value);
        } else {
          params[key] = [params[key], value];
        }
      } else {
        params[key] = value;
      }
    }

    const result = schema.safeParse(params);

    if (!result.success) {
      return {
        success: false,
        error: 'Query parameter validation failed',
        details: result.error.issues,
      };
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    return {
      success: false,
      error: 'Query parameter parsing error',
    };
  }
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(error: any): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: error,
      message: 'The request contains invalid or missing data',
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}

/**
 * Middleware for automatic request validation
 */
export function withValidation<T>(schema: z.ZodSchema<T>) {
  return function (handler: (data: T, request: Request) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      const validation = await validateRequestBody(request, schema);

      if (!validation.success) {
        return createValidationErrorResponse(validation.details || validation.error);
      }

      return await handler(validation.data!, request);
    };
  };
}

// Export all schemas as a single object for easy access
export const validationSchemas = {
  auth: authSchemas,
  organization: organizationSchemas,
  plaid: plaidSchemas,
  transaction: transactionSchemas,
  export: exportSchemas,
  receipt: receiptSchemas,
  dashboard: dashboardSchemas,
  settings: settingsSchemas,
  review: reviewSchemas,
  apiKey: apiKeySchemas,
};

// Legacy exports for backward compatibility
export const plaidExchangeSchema = plaidSchemas.exchange;