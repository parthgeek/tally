/**
 * Secure logging utilities for Edge Functions to prevent sensitive data exposure
 */

/**
 * List of sensitive field patterns that should be redacted from logs
 */
const SENSITIVE_PATTERNS = [
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /bearer[_-]?token/i,
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /jwt/i,
  /authorization/i,
  /cookie/i,
  /session/i,
];

/**
 * Redacts sensitive fields from an object for safe logging
 */
export function redactSensitiveFields(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 5) return '[MAX_DEPTH_REACHED]';
  
  if (obj === null || obj === undefined) return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item, depth + 1));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const redacted: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if field name matches sensitive patterns
      const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
      
      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        redacted[key] = redactSensitiveFields(value, depth + 1);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }
  
  return obj;
}

/**
 * Safely log an error with sensitive data redaction
 */
export function logError(message: string, error: any, context?: any): void {
  const safeError = {
    message: error?.message || String(error),
    name: error?.name,
    stack: error?.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
    code: error?.code,
    status: error?.status,
  };
  
  const safeContext = context ? redactSensitiveFields(context) : undefined;
  
  console.error(message, {
    error: safeError,
    context: safeContext,
  });
}

/**
 * Create a safe version of request data for logging
 */
export function safeRequestLog(request: Request): any {
  const url = new URL(request.url);
  
  return {
    method: request.method,
    pathname: url.pathname,
    search: url.search,
    headers: redactSensitiveFields(Object.fromEntries(request.headers.entries())),
    // Never log the body - it may contain sensitive data
    hasBody: request.body !== null,
  };
}

/**
 * Safe logging for Plaid API errors - only logs public error details
 */
export function logPlaidError(operation: string, error: any, requestId?: string): void {
  const safeError = {
    operation,
    error_code: error?.error_code,
    error_type: error?.error_type,
    error_message: error?.error_message,
    display_message: error?.display_message,
    request_id: requestId || error?.request_id,
    status: error?.status || error?.response?.status,
  };
  
  console.error('Plaid API error', safeError);
}