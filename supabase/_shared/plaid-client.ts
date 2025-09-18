export enum PlaidSyncError {
  INVALID_TOKEN = 'invalid_access_token',
  API_LIMIT = 'rate_limit_exceeded', 
  NETWORK = 'network_error',
  ITEM_ERROR = 'item_error',
  INSTITUTION_ERROR = 'institution_error'
}

export class PlaidApiError extends Error {
  constructor(
    public readonly code: PlaidSyncError,
    public readonly originalError?: unknown,
    message?: string
  ) {
    super(message || code);
    this.name = 'PlaidApiError';
  }
}

export function createPlaidClient(env?: string) {
  const environment = env || Deno.env.get('PLAID_ENV') || 'sandbox';
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');

  if (!clientId || !secret) {
    throw new Error('Missing Plaid credentials: PLAID_CLIENT_ID and PLAID_SECRET are required');
  }

  // Return configuration object for manual fetch calls
  // since we can't easily import the Plaid SDK in Deno
  return {
    clientId,
    secret,
    environment,
    baseUrl: `https://${environment}.plaid.com`,
    headers: {
      'Content-Type': 'application/json',
      'PLAID-CLIENT-ID': clientId,
      'PLAID-SECRET': secret,
    }
  };
}

export async function safelyCallPlaid<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Plaid API error in ${context}:`, error);
    
    // Map Plaid errors to our error types
    if (error?.status === 400) {
      throw new PlaidApiError(PlaidSyncError.INVALID_TOKEN, error);
    } else if (error?.status === 429) {
      throw new PlaidApiError(PlaidSyncError.API_LIMIT, error);
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      throw new PlaidApiError(PlaidSyncError.NETWORK, error);
    }
    
    throw new PlaidApiError(PlaidSyncError.ITEM_ERROR, error, `Failed ${context}`);
  }
}