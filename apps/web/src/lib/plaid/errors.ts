export enum PlaidOAuthError {
  USER_CANCELLED = "user_cancelled",
  INSTITUTION_ERROR = "institution_error",
  INVALID_CREDENTIALS = "invalid_credentials",
  ITEM_LOCKED = "item_locked",
  NETWORK_ERROR = "network_error",
  OAUTH_TIMEOUT = "oauth_timeout",
  EXCHANGE_FAILED = "exchange_failed",
  OAUTH_FAILED = "oauth_failed",
}

export function getErrorMessage(error: string): string {
  switch (error) {
    case PlaidOAuthError.USER_CANCELLED:
      return "Connection was cancelled. Please try again.";
    case PlaidOAuthError.INSTITUTION_ERROR:
      return "Your bank is experiencing technical difficulties. Please try again later.";
    case PlaidOAuthError.INVALID_CREDENTIALS:
      return "Invalid credentials. Please check your login information.";
    case PlaidOAuthError.ITEM_LOCKED:
      return "Your account is locked. Please contact your bank.";
    case PlaidOAuthError.NETWORK_ERROR:
      return "Network error. Please check your connection and try again.";
    case PlaidOAuthError.OAUTH_TIMEOUT:
      return "Connection timed out. Please try again.";
    case PlaidOAuthError.EXCHANGE_FAILED:
      return "Failed to complete account connection. Please try again.";
    case PlaidOAuthError.OAUTH_FAILED:
      return "Authentication failed. Please try again.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

export function isRetryableError(error: string): boolean {
  return [
    PlaidOAuthError.NETWORK_ERROR,
    PlaidOAuthError.OAUTH_TIMEOUT,
    PlaidOAuthError.INSTITUTION_ERROR,
    PlaidOAuthError.EXCHANGE_FAILED,
  ].includes(error as PlaidOAuthError);
}

export function validatePlaidConfig(): void {
  const required = ["PLAID_CLIENT_ID", "PLAID_SECRET", "NEXT_PUBLIC_SITE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
