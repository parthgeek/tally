import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { 
  validatePlaidConfig, 
  validateDatabaseConfig, 
  validateEncryptionConfig,
  validateEnvironment 
} from './config';

// Store original env vars
const originalEnv: Record<string, string | undefined> = {};

function setEnvVars(vars: Record<string, string>): void {
  Object.entries(vars).forEach(([key, value]) => {
    if (typeof process !== 'undefined' && process.env) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }
  });
}

function clearEnvVars(keys: string[]): void {
  keys.forEach(key => {
    if (typeof process !== 'undefined' && process.env) {
      delete process.env[key];
    }
  });
}

function restoreEnvVars(): void {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof process !== 'undefined' && process.env) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

describe('validatePlaidConfig', () => {
  afterEach(() => {
    restoreEnvVars();
  });

  test('validates valid Plaid configuration', () => {
    setEnvVars({
      PLAID_CLIENT_ID: '12345678901234567890',
      PLAID_SECRET: 'abcdef1234567890abcdef1234567890',
      PLAID_ENV: 'sandbox',
      NEXT_PUBLIC_SITE_URL: 'https://app.example.com'
    });

    const config = validatePlaidConfig();
    
    expect(config.clientId).toBe('12345678901234567890');
    expect(config.secret).toBe('abcdef1234567890abcdef1234567890');
    expect(config.environment).toBe('sandbox');
    expect(config.webhookUrl).toBe('https://app.example.com/api/plaid/webhook');
  });

  test('uses default environment when PLAID_ENV not set', () => {
    setEnvVars({
      PLAID_CLIENT_ID: '12345678901234567890',
      PLAID_SECRET: 'abcdef1234567890abcdef1234567890',
      NEXT_PUBLIC_SITE_URL: 'https://app.example.com'
    });

    const config = validatePlaidConfig();
    expect(config.environment).toBe('sandbox');
  });

  test('throws error when PLAID_CLIENT_ID is missing', () => {
    setEnvVars({
      PLAID_SECRET: 'abcdef1234567890abcdef1234567890',
      PLAID_ENV: 'sandbox'
    });

    expect(() => validatePlaidConfig()).toThrow('PLAID_CLIENT_ID environment variable is required');
  });

  test('throws error when PLAID_SECRET is missing', () => {
    setEnvVars({
      PLAID_CLIENT_ID: '12345678901234567890',
      PLAID_ENV: 'sandbox'
    });

    expect(() => validatePlaidConfig()).toThrow('PLAID_SECRET environment variable is required');
  });

  test('throws error when PLAID_CLIENT_ID is too short', () => {
    setEnvVars({
      PLAID_CLIENT_ID: 'short',
      PLAID_SECRET: 'abcdef1234567890abcdef1234567890',
      PLAID_ENV: 'sandbox'
    });

    expect(() => validatePlaidConfig()).toThrow('PLAID_CLIENT_ID appears to be invalid (too short)');
  });

  test('throws error when PLAID_SECRET is too short', () => {
    setEnvVars({
      PLAID_CLIENT_ID: '12345678901234567890',
      PLAID_SECRET: 'short',
      PLAID_ENV: 'sandbox'
    });

    expect(() => validatePlaidConfig()).toThrow('PLAID_SECRET appears to be invalid (too short)');
  });

  test('throws error for invalid PLAID_ENV', () => {
    setEnvVars({
      PLAID_CLIENT_ID: '12345678901234567890',
      PLAID_SECRET: 'abcdef1234567890abcdef1234567890',
      PLAID_ENV: 'invalid'
    });

    expect(() => validatePlaidConfig()).toThrow('Invalid PLAID_ENV: invalid. Must be sandbox, development, or production');
  });
});

describe('validateDatabaseConfig', () => {
  afterEach(() => {
    restoreEnvVars();
  });

  test('validates valid database configuration', () => {
    setEnvVars({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co'
    });

    const config = validateDatabaseConfig();
    
    expect(config.url).toBe('https://project.supabase.co');
    expect(config.serviceRoleKey).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key');
  });

  test('throws error when SUPABASE_URL is missing', () => {
    setEnvVars({
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co'
    });

    expect(() => validateDatabaseConfig()).toThrow('SUPABASE_URL environment variable is required');
  });

  test('throws error when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    setEnvVars({
      SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co'
    });

    expect(() => validateDatabaseConfig()).toThrow('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  });

  test('throws error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    setEnvVars({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key'
    });

    expect(() => validateDatabaseConfig()).toThrow('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  });

  test('throws error for invalid SUPABASE_URL format', () => {
    setEnvVars({
      SUPABASE_URL: 'not-a-valid-url',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co'
    });

    expect(() => validateDatabaseConfig()).toThrow('SUPABASE_URL must be a valid URL');
  });

  test('throws error for invalid service role key format', () => {
    setEnvVars({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'invalid-key-format',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co'
    });

    expect(() => validateDatabaseConfig()).toThrow('SUPABASE_SERVICE_ROLE_KEY appears to be invalid');
  });
});

describe('validateEncryptionConfig', () => {
  afterEach(() => {
    restoreEnvVars();
  });

  test('validates valid encryption configuration', () => {
    setEnvVars({
      ENCRYPTION_KEY: 'strongrandomkey12345678901234567890' // 32+ characters, not repeated
    });

    const config = validateEncryptionConfig();
    expect(config.encryptionKey).toBe('strongrandomkey12345678901234567890');
  });

  test('throws error when ENCRYPTION_KEY is missing', () => {
    clearEnvVars(['ENCRYPTION_KEY']);

    expect(() => validateEncryptionConfig()).toThrow('ENCRYPTION_KEY environment variable is required');
  });

  test('throws error when ENCRYPTION_KEY is too short', () => {
    setEnvVars({
      ENCRYPTION_KEY: 'tooshort'
    });

    expect(() => validateEncryptionConfig()).toThrow('ENCRYPTION_KEY must be at least 32 characters long');
  });

  test('throws error for repeated character pattern', () => {
    setEnvVars({
      ENCRYPTION_KEY: 'a'.repeat(32)
    });

    expect(() => validateEncryptionConfig()).toThrow('ENCRYPTION_KEY appears to use a repeated character pattern');
  });

  test('throws error for keys containing common words', () => {
    setEnvVars({
      ENCRYPTION_KEY: 'mypassword123456789012345678901234567890'
    });

    expect(() => validateEncryptionConfig()).toThrow('ENCRYPTION_KEY should not contain common words');
  });
});

describe('validateEnvironment', () => {
  afterEach(() => {
    restoreEnvVars();
  });

  test('passes when all environment variables are valid', () => {
    setEnvVars({
      PLAID_CLIENT_ID: '12345678901234567890',
      PLAID_SECRET: 'abcdef1234567890abcdef1234567890',
      PLAID_ENV: 'sandbox',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      ENCRYPTION_KEY: 'strongrandomkey12345678901234567890',
      NEXT_PUBLIC_SITE_URL: 'https://app.example.com'
    });

    expect(() => validateEnvironment()).not.toThrow();
  });

  test('throws error when any validation fails', () => {
    setEnvVars({
      PLAID_CLIENT_ID: 'short', // This will fail validation
      PLAID_SECRET: 'abcdef1234567890abcdef1234567890'
    });

    expect(() => validateEnvironment()).toThrow('Environment validation failed');
  });
});