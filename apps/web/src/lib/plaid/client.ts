import { PlaidApi, Configuration, PlaidEnvironments, Products, CountryCode, LinkTokenCreateRequest } from "plaid";

export enum PlaidError {
  INVALID_CREDENTIALS = "invalid_credentials",
  RATE_LIMIT = "rate_limit_exceeded",
  INSTITUTION_ERROR = "institution_error",
  ITEM_ERROR = "item_error",
  NETWORK_ERROR = "network_error",
}

export class PlaidClientError extends Error {
  constructor(
    public readonly code: PlaidError,
    public readonly originalError?: unknown,
    message?: string
  ) {
    super(message || code);
    this.name = "PlaidClientError";
  }
}

function getPlaidEnvironment(): string {
  const env = process.env.PLAID_ENV || "sandbox";
  const validEnvironments = Object.keys(PlaidEnvironments);

  if (!validEnvironments.includes(env)) {
    console.warn(`Invalid PLAID_ENV: ${env}, defaulting to sandbox`);
    return PlaidEnvironments.sandbox as string;
  }

  const envValue = PlaidEnvironments[env as keyof typeof PlaidEnvironments];
  return envValue || (PlaidEnvironments.sandbox as string);
}

export function createPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error("Missing Plaid credentials: PLAID_CLIENT_ID and PLAID_SECRET are required");
  }

  return new PlaidApi(
    new Configuration({
      basePath: getPlaidEnvironment(),
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    })
  );
}

export async function safelyCallPlaid<T>(operation: () => Promise<T>, context: string): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    console.error(`Plaid API error in ${context}:`, error);

    // Map Plaid-specific errors
    if (error && typeof error === 'object' && 'response' in error && 
        error.response && typeof error.response === 'object' && 'data' in error.response &&
        error.response.data && typeof error.response.data === 'object' && 'error_code' in error.response.data) {
      const errorCode = (error.response.data as { error_code: string }).error_code;

      switch (errorCode) {
        case "INVALID_CREDENTIALS":
          throw new PlaidClientError(PlaidError.INVALID_CREDENTIALS, error);
        case "RATE_LIMIT_EXCEEDED":
          throw new PlaidClientError(PlaidError.RATE_LIMIT, error);
        case "INSTITUTION_ERROR":
          throw new PlaidClientError(PlaidError.INSTITUTION_ERROR, error);
        case "ITEM_ERROR":
          throw new PlaidClientError(PlaidError.ITEM_ERROR, error);
        default:
          throw new PlaidClientError(
            PlaidError.ITEM_ERROR,
            error,
            `Unknown Plaid error: ${errorCode}`
          );
      }
    }

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED")) {
      throw new PlaidClientError(PlaidError.NETWORK_ERROR, error);
    }

    throw new PlaidClientError(PlaidError.ITEM_ERROR, error, `Failed ${context}`);
  }
}

export interface LinkTokenConfig {
  userId: string;
  orgId: string;
  webhookUrl?: string;
  products?: Products[];
  countryCodes?: CountryCode[];
}

export async function createLinkToken(config: LinkTokenConfig): Promise<string> {
  const client = createPlaidClient();

  return await safelyCallPlaid(async () => {
    const linkTokenRequest: LinkTokenCreateRequest = {
      user: {
        client_user_id: `${config.orgId}_${config.userId}`,
      },
      client_name: "Nexus Financial Automation",
      products: config.products || [Products.Transactions],
      country_codes: config.countryCodes || [CountryCode.Us],
      language: "en",
      // Add redirect URI for OAuth support
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/plaid/oauth/callback`,
    };

    if (config.webhookUrl) {
      linkTokenRequest.webhook = config.webhookUrl;
    }

    const response = await client.linkTokenCreate(linkTokenRequest);

    return response.data.link_token;
  }, "createLinkToken");
}
