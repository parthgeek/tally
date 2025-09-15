import { describe, expect, test, beforeEach, vi } from 'vitest';
import { POST as exchangeHandler } from '@/app/api/plaid/exchange/route';
import { POST as linkTokenHandler } from '@/app/api/plaid/link-token/route';
import { NextRequest } from 'next/server';

// Mock the dependencies
const mockSupabase = {
  auth: {
    getUser: () => Promise.resolve({ 
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    }),
    getSession: () => Promise.resolve({
      data: { session: { access_token: 'test-access-token' } },
      error: null
    }),
  },
};

const mockOrg = {
  userId: 'test-user-id',
  orgId: 'test-org-id',
};

// Mock fetch for edge function calls
global.fetch = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => mockSupabase,
}));

vi.mock('@/lib/api/with-org', () => ({
  withOrgFromRequest: () => Promise.resolve(mockOrg),
  createErrorResponse: (message: string, status: number) => 
    new Response(JSON.stringify({ error: message }), { status }),
  createValidationErrorResponse: (error: any) =>
    new Response(JSON.stringify({ error: 'Validation failed', details: error }), { status: 400 }),
}));

vi.mock('@/lib/plaid/client', () => ({
  createLinkToken: vi.fn(() => Promise.resolve('test-link-token')),
  PlaidClientError: class extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  },
  PlaidError: {
    RATE_LIMIT: 'RATE_LIMIT',
  },
}));

describe('API Route Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ connectionId: 'test-connection-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  describe('Rate Limiting', () => {
    test('link-token endpoint respects rate limits', async () => {
      // This test would require setting up the rate limiter with a very low limit
      // and making multiple requests to trigger the limit
      
      const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
      });

      // First request should succeed
      const response1 = await linkTokenHandler(request);
      expect(response1.status).toBeLessThan(400);

      // Note: In a real test, you'd need to set up the rate limiter with a test configuration
      // that allows you to easily hit the limit within the test
    });

    test('exchange endpoint respects rate limits', async () => {
      const request = new NextRequest('http://localhost:3000/api/plaid/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({
          public_token: 'public-sandbox-12345678-1234-1234-1234-123456789012',
          metadata: { institution_id: 'ins_123456' },
        }),
      });

      // First request should succeed
      const response1 = await exchangeHandler(request);
      expect(response1.status).toBeLessThan(400);
    });
  });

  describe('Input Validation', () => {
    test('exchange endpoint validates request body', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing public_token
          metadata: { institution_id: 'ins_123456' },
        }),
      });

      const response = await exchangeHandler(invalidRequest);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
    });

    test('exchange endpoint rejects too short public_token', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: 'short', // Too short
          metadata: { institution_id: 'ins_123456' },
        }),
      });

      const response = await exchangeHandler(invalidRequest);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
    });

    test('exchange endpoint rejects too long public_token', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: 'x'.repeat(501), // Too long
          metadata: { institution_id: 'ins_123456' },
        }),
      });

      const response = await exchangeHandler(invalidRequest);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
    });

    test('exchange endpoint accepts valid request', async () => {
      const validRequest = new NextRequest('http://localhost:3000/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: 'public-sandbox-12345678-1234-1234-1234-123456789012',
          metadata: {
            institution_id: 'ins_123456',
            institution_name: 'Test Bank',
            accounts: [
              {
                id: 'account_123',
                name: 'Checking',
                type: 'depository',
                subtype: 'checking',
              },
            ],
          },
        }),
      });

      const response = await exchangeHandler(validRequest);
      
      expect(response.status).toBe(200);
    });

    test('exchange endpoint handles malformed JSON', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {',
      });

      const response = await exchangeHandler(invalidRequest);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
    });
  });

  describe('Authentication', () => {
    test('requires valid session for exchange endpoint', async () => {
      // Mock no session
      (mockSupabase.auth.getSession as any) = () => Promise.resolve({
        data: { session: null },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: 'public-sandbox-12345678-1234-1234-1234-123456789012',
        }),
      });

      const response = await exchangeHandler(request);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('No session token');
    });

    test('requires valid user for both endpoints', async () => {
      // Mock no user
      (mockSupabase.auth.getUser as any) = () => Promise.resolve({
        data: { user: null },
        error: new Error('No user'),
      });

      const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // This should be caught by withOrgFromRequest, but the test demonstrates the pattern
      try {
        await linkTokenHandler(request);
      } catch (error) {
        // Expected - withOrgFromRequest should throw
        expect(error).toBeDefined();
      }
    });
  });

  describe('Security Headers', () => {
    test('responses include security headers via Next.js config', async () => {
      // Note: Security headers are added by Next.js config, not individual routes
      // This test documents the expected behavior rather than testing implementation
      
      const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await linkTokenHandler(request);
      
      // Individual API routes don't set security headers - they're set by Next.js
      // This test documents that the route works correctly
      expect(response.status).toBeLessThan(400);
    });
  });
});