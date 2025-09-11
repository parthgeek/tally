export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
  webhookUrl: string;
}

export interface DatabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface EncryptionConfig {
  encryptionKey: string;
}

export interface AppConfig {
  plaid: PlaidConfig;
  database: DatabaseConfig;
  encryption: EncryptionConfig;
  siteUrl: string;
}

function getEnvVar(key: string): string | undefined {
  // Handle both Node.js and Deno environments
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  // @ts-ignore: Deno global may not be available in all environments
  if (typeof Deno !== 'undefined' && Deno?.env?.get) {
    // @ts-ignore: Deno global may not be available in all environments
    return Deno.env.get(key);
  }
  return undefined;
}

export function validatePlaidConfig(): PlaidConfig {
  const clientId = getEnvVar('PLAID_CLIENT_ID');
  const secret = getEnvVar('PLAID_SECRET');
  const environment = (getEnvVar('PLAID_ENV') || 'sandbox') as PlaidConfig['environment'];
  const siteUrl = getEnvVar('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';

  if (!clientId) {
    throw new Error('PLAID_CLIENT_ID environment variable is required');
  }

  if (!secret) {
    throw new Error('PLAID_SECRET environment variable is required');
  }

  // Enhanced validation for client ID and secret formats
  if (clientId.length < 10) {
    throw new Error('PLAID_CLIENT_ID appears to be invalid (too short)');
  }

  if (secret.length < 10) {
    throw new Error('PLAID_SECRET appears to be invalid (too short)');
  }

  if (!['sandbox', 'development', 'production'].includes(environment)) {
    throw new Error(`Invalid PLAID_ENV: ${environment}. Must be sandbox, development, or production`);
  }

  return {
    clientId,
    secret,
    environment,
    webhookUrl: `${siteUrl}/api/plaid/webhook`,
  };
}

export function validateDatabaseConfig(): DatabaseConfig {
  const url = getEnvVar('SUPABASE_URL');
  const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  const publicUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');

  if (!url) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  if (!publicUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  }

  // Validate URL formats
  try {
    new URL(url);
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL');
  }

  try {
    new URL(publicUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL');
  }

  // Validate service role key format (should be a JWT-like token)
  if (!serviceRoleKey.startsWith('eyJ') || serviceRoleKey.length < 50) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid');
  }

  return { url, serviceRoleKey };
}

export function validateEncryptionConfig(): EncryptionConfig {
  const encryptionKey = getEnvVar('ENCRYPTION_KEY');

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required for token encryption');
  }

  // Validate encryption key length (minimum 32 characters for AES-256)
  if (encryptionKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long for secure AES-256 encryption');
  }

  // Warn about weak keys (simple patterns)
  if (/^(.)\1*$/.test(encryptionKey)) {
    throw new Error('ENCRYPTION_KEY appears to use a repeated character pattern - use a strong random key');
  }

  if (encryptionKey.toLowerCase().includes('password') || 
      encryptionKey.toLowerCase().includes('secret') ||
      encryptionKey.toLowerCase().includes('key')) {
    throw new Error('ENCRYPTION_KEY should not contain common words - use a strong random key');
  }

  return { encryptionKey };
}

export function getAppConfig(): AppConfig {
  return {
    plaid: validatePlaidConfig(),
    database: validateDatabaseConfig(),
    encryption: validateEncryptionConfig(),
    siteUrl: getEnvVar('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000',
  };
}

/**
 * Validates all critical environment variables at startup
 * Call this function early in application lifecycle to fail fast
 */
export function validateEnvironment(): void {
  try {
    getAppConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Environment validation failed: ${message}`);
  }
}