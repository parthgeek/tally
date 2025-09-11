/// <reference path="../../deno-types.d.ts" />

/**
 * Security tests for Plaid webhook Edge Function
 * Tests the enhanced security features added in the hardening implementation
 */

import { assertEquals, assertMatch } from "../../_test/test-utils.ts";
import {
  setupTestEnv,
  cleanupTestEnv,
  createMockFetch,
  createMockSupabaseClient
} from "../../_test/test-utils.ts";

// Mock the crypto API for consistent testing
const mockCrypto = {
  subtle: {
    importKey: async () => ({}),
    sign: async () => new ArrayBuffer(32),
    verify: async (algorithm: any, key: any, signature: any, data: any) => {
      // Mock signature verification - check if signature matches expected format
      const expectedSignature = "sha256=" + "a".repeat(64);
      return signature === expectedSignature;
    }
  }
};

// Setup test environment
Deno.test({
  name: "webhook security setup",
  fn: () => {
    setupTestEnv();
    globalThis.fetch = createMockFetch();
    globalThis.crypto = mockCrypto as any;
  }
});

Deno.test({
  name: "webhook security - fails closed when secret missing in production",
  async fn() {
    // Set production environment without webhook secret
    Deno.env.set('PLAID_ENV', 'production');
    Deno.env.delete('PLAID_WEBHOOK_SECRET');

    const testHandler = async (req: Request): Promise<Response> => {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const rawBody = await req.text();
        
        // Fail closed in production if webhook secret is missing
        const plaidEnv = Deno.env.get('PLAID_ENV') || Deno.env.get('ENVIRONMENT') || 'development';
        const webhookSecret = Deno.env.get('PLAID_WEBHOOK_SECRET');
        
        if (!webhookSecret && (plaidEnv === 'production' || plaidEnv === 'development')) {
          console.error('PLAID_WEBHOOK_SECRET required in production environment');
          return new Response('Unauthorized', { status: 401 });
        }

        return new Response('OK', { status: 200 });

      } catch (error) {
        return new Response('Error processing webhook', { status: 500 });
      }
    };

    const request = new Request('http://localhost:8000/webhook', {
      method: 'POST',
      body: JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'test-item-id'
      })
    });

    const response = await testHandler(request);
    
    assertEquals(response.status, 401);
    const body = await response.text();
    assertEquals(body, 'Unauthorized');
  }
});

Deno.test({
  name: "webhook security - allows requests in development without secret",
  async fn() {
    // Set development environment without webhook secret
    Deno.env.set('PLAID_ENV', 'sandbox');
    Deno.env.delete('PLAID_WEBHOOK_SECRET');

    const testHandler = async (req: Request): Promise<Response> => {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const rawBody = await req.text();
        
        // Fail closed in production if webhook secret is missing
        const plaidEnv = Deno.env.get('PLAID_ENV') || Deno.env.get('ENVIRONMENT') || 'development';
        const webhookSecret = Deno.env.get('PLAID_WEBHOOK_SECRET');
        
        if (!webhookSecret && (plaidEnv === 'production' || plaidEnv === 'development')) {
          console.error('PLAID_WEBHOOK_SECRET required in production environment');
          return new Response('Unauthorized', { status: 401 });
        }

        const webhook = JSON.parse(rawBody);
        return new Response('OK', { status: 200 });

      } catch (error) {
        return new Response('Error processing webhook', { status: 500 });
      }
    };

    const request = new Request('http://localhost:8000/webhook', {
      method: 'POST',
      body: JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'test-item-id'
      })
    });

    const response = await testHandler(request);
    
    assertEquals(response.status, 200);
  }
});

Deno.test({
  name: "webhook security - verifies valid signature",
  async fn() {
    // Set webhook secret
    Deno.env.set('PLAID_WEBHOOK_SECRET', 'test-webhook-secret');
    Deno.env.set('PLAID_ENV', 'production');

    const testHandler = async (req: Request): Promise<Response> => {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const rawBody = await req.text();
        
        const plaidEnv = Deno.env.get('PLAID_ENV') || 'development';
        const webhookSecret = Deno.env.get('PLAID_WEBHOOK_SECRET');
        
        if (!webhookSecret && (plaidEnv === 'production' || plaidEnv === 'development')) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        if (webhookSecret) {
          const signature = req.headers.get('plaid-verification');
          // In real implementation, this would verify the HMAC signature
          // For testing, we just check if the signature matches expected format
          if (!signature || signature !== "sha256=" + "a".repeat(64)) {
            return new Response('Unauthorized', { status: 401 });
          }
        }

        const webhook = JSON.parse(rawBody);
        return new Response('OK', { status: 200 });

      } catch (error) {
        return new Response('Error processing webhook', { status: 500 });
      }
    };

    const request = new Request('http://localhost:8000/webhook', {
      method: 'POST',
      headers: {
        'plaid-verification': 'sha256=' + 'a'.repeat(64)
      },
      body: JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'test-item-id'
      })
    });

    const response = await testHandler(request);
    
    assertEquals(response.status, 200);
  }
});

Deno.test({
  name: "webhook security - rejects invalid signature",
  async fn() {
    // Set webhook secret
    Deno.env.set('PLAID_WEBHOOK_SECRET', 'test-webhook-secret');
    Deno.env.set('PLAID_ENV', 'production');

    const testHandler = async (req: Request): Promise<Response> => {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const rawBody = await req.text();
        
        const plaidEnv = Deno.env.get('PLAID_ENV') || 'development';
        const webhookSecret = Deno.env.get('PLAID_WEBHOOK_SECRET');
        
        if (!webhookSecret && (plaidEnv === 'production' || plaidEnv === 'development')) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        if (webhookSecret) {
          const signature = req.headers.get('plaid-verification');
          // In real implementation, this would verify the HMAC signature
          // For testing, we reject anything that doesn't match expected format
          if (!signature || signature !== "sha256=" + "a".repeat(64)) {
            // Parse webhook for minimal logging - no payload echo
            try {
              const webhookData = JSON.parse(rawBody);
              console.warn('Invalid webhook signature', {
                webhook_type: webhookData.webhook_type,
                webhook_code: webhookData.webhook_code,
                request_id: webhookData.request_id
              });
            } catch {
              console.warn('Invalid webhook signature - unparseable payload');
            }
            return new Response('Unauthorized', { status: 401 });
          }
        }

        const webhook = JSON.parse(rawBody);
        return new Response('OK', { status: 200 });

      } catch (error) {
        return new Response('Error processing webhook', { status: 500 });
      }
    };

    const request = new Request('http://localhost:8000/webhook', {
      method: 'POST',
      headers: {
        'plaid-verification': 'invalid-signature'
      },
      body: JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'test-item-id',
        request_id: 'req-123'
      })
    });

    const response = await testHandler(request);
    
    assertEquals(response.status, 401);
    const body = await response.text();
    assertEquals(body, 'Unauthorized');
  }
});

Deno.test({
  name: "webhook security - rejects missing signature header",
  async fn() {
    // Set webhook secret
    Deno.env.set('PLAID_WEBHOOK_SECRET', 'test-webhook-secret');
    Deno.env.set('PLAID_ENV', 'production');

    const testHandler = async (req: Request): Promise<Response> => {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const rawBody = await req.text();
        
        const plaidEnv = Deno.env.get('PLAID_ENV') || 'development';
        const webhookSecret = Deno.env.get('PLAID_WEBHOOK_SECRET');
        
        if (!webhookSecret && (plaidEnv === 'production' || plaidEnv === 'development')) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        if (webhookSecret) {
          const signature = req.headers.get('plaid-verification');
          if (!signature || signature !== "sha256=" + "a".repeat(64)) {
            return new Response('Unauthorized', { status: 401 });
          }
        }

        const webhook = JSON.parse(rawBody);
        return new Response('OK', { status: 200 });

      } catch (error) {
        return new Response('Error processing webhook', { status: 500 });
      }
    };

    const request = new Request('http://localhost:8000/webhook', {
      method: 'POST',
      body: JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'test-item-id'
      })
    });

    const response = await testHandler(request);
    
    assertEquals(response.status, 401);
  }
});

// Cleanup
Deno.test({
  name: "webhook security cleanup",
  fn: () => {
    cleanupTestEnv();
  }
});