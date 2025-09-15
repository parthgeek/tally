import { describe, expect, test } from 'vitest';
import { validateRequestBody, plaidExchangeSchema } from './validation';

describe('plaidExchangeSchema', () => {
  test('validates valid Plaid exchange request', () => {
    const validRequest = {
      public_token: 'public-sandbox-12345678-1234-1234-1234-123456789012',
      metadata: {
        institution_id: 'ins_123456',
        institution_name: 'Test Bank',
        accounts: [
          {
            id: 'account_123',
            name: 'Checking',
            type: 'depository',
            subtype: 'checking'
          }
        ]
      }
    };

    const result = plaidExchangeSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.public_token).toBe(validRequest.public_token);
      expect(result.data.metadata?.institution_id).toBe('ins_123456');
    }
  });

  test('validates request without optional metadata', () => {
    const requestWithoutMetadata = {
      public_token: 'public-sandbox-12345678-1234-1234-1234-123456789012'
    };

    const result = plaidExchangeSchema.safeParse(requestWithoutMetadata);
    expect(result.success).toBe(true);
  });

  test('rejects request with missing public_token', () => {
    const invalidRequest = {
      metadata: {
        institution_id: 'ins_123456'
      }
    };

    const result = plaidExchangeSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('public_token');
    }
  });

  test('rejects request with too short public_token', () => {
    const invalidRequest = {
      public_token: 'short'
    };

    const result = plaidExchangeSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('too_small');
    }
  });

  test('rejects request with too long public_token', () => {
    const invalidRequest = {
      public_token: 'x'.repeat(501) // Longer than 500 chars
    };

    const result = plaidExchangeSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('too_big');
    }
  });

  test('passes through unknown metadata fields (security feature)', () => {
    const requestWithExtraMetadata = {
      public_token: 'public-sandbox-12345678-1234-1234-1234-123456789012',
      metadata: {
        institution_id: 'ins_123456',
        unknown_field: 'should not be trusted',
        nested: {
          malicious: 'payload'
        }
      }
    };

    const result = plaidExchangeSchema.safeParse(requestWithExtraMetadata);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.metadata).toHaveProperty('unknown_field');
      expect(result.data.metadata).toHaveProperty('nested');
    }
  });
});

describe('validateRequestBody', () => {
  test('returns success for valid request body', async () => {
    const validBody = {
      public_token: 'public-sandbox-12345678-1234-1234-1234-123456789012'
    };
    
    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody)
    });

    const result = await validateRequestBody(request, plaidExchangeSchema);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.public_token).toBe(validBody.public_token);
    }
  });

  test('returns error for invalid request body', async () => {
    const invalidBody = {
      invalid_field: 'value'
    };
    
    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidBody)
    });

    const result = await validateRequestBody(request, plaidExchangeSchema);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  test('returns error for malformed JSON', async () => {
    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json {'
    });

    const result = await validateRequestBody(request, plaidExchangeSchema);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});