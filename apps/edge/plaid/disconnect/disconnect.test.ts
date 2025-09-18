import { describe, test, expect, beforeEach, afterEach } from 'jsr:@std/testing/bdd';
import { assertEquals, assertExists } from 'jsr:@std/assert';

// Test utilities
import { createMockRequest, mockSupabaseClient, mockEnv } from '../../_test/test-utils.ts';

describe('Plaid Disconnect Edge Function', () => {
  const mockConnectionId = 'conn-123';
  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockAccessToken = 'access-token-123';
  const mockItemId = 'item-123';

  // Helper function for common successful setup
  function setupSuccessfulConnection() {
    return {
      id: mockConnectionId,
      org_id: mockOrgId,
      provider: 'plaid',
      provider_item_id: mockItemId,
      status: 'active',
      connection_secrets: {
        access_token_encrypted: 'encrypted-token-123',
      },
    };
  }

  function setupSuccessfulMocks() {
    // Mock RPC calls
    mockSupabaseClient.rpc.mockImplementation((funcName: string) => {
      if (funcName === 'disconnect_connection') {
        return { error: null };
      }
      if (funcName === 'log_service_role_operation') {
        return { error: null };
      }
      return { error: null };
    });

    // Mock other operations
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'connection_secrets') {
        return {
          delete: () => ({
            eq: () => ({
              error: null,
            }),
          }),
        };
      }
      if (table === 'accounts') {
        return {
          update: () => ({
            eq: () => ({
              error: null,
            }),
          }),
        };
      }
      return mockSupabaseClient.from(table);
    });
  }

  beforeEach(() => {
    // Set up environment variables
    mockEnv({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      PLAID_CLIENT_ID: 'test-client-id',
      PLAID_SECRET: 'test-secret',
      PLAID_ENV: 'sandbox',
    });

    // Mock global fetch
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      // Mock Plaid item/remove endpoint
      if (urlString.includes('sandbox.plaid.com/item/remove')) {
        return new Response(JSON.stringify({ removed: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default mock response
      return new Response('Not Found', { status: 404 });
    };
  });

  afterEach(() => {
    // Clean up global mocks
    delete (globalThis as any).fetch;
  });

  describe('successful disconnect', () => {
    test('successfully disconnects a Plaid connection', async () => {
      const connectionData = setupSuccessfulConnection();

      // Mock Supabase responses
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'connections') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: connectionData,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient.from(table);
      });

      setupSuccessfulMocks();

      // Import and test the function
      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('DELETE', {
        connectionId: mockConnectionId,
      }, {
        Authorization: 'Bearer test-jwt-token',
      });

      const response = await handler(request);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.message);
    });

    test('handles already disconnected connection', async () => {
      const connectionData = {
        ...setupSuccessfulConnection(),
        status: 'disconnected', // Already disconnected
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'connections') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: connectionData,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient.from(table);
      });

      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('DELETE', {
        connectionId: mockConnectionId,
      }, {
        Authorization: 'Bearer test-jwt-token',
      });

      const response = await handler(request);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.message, 'Connection already disconnected');
    });
  });

  describe('error handling', () => {
    test('returns 404 for non-existent connection', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'connections') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: null,
                  error: { message: 'Connection not found' },
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient.from(table);
      });

      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('DELETE', {
        connectionId: 'non-existent-id',
      }, {
        Authorization: 'Bearer test-jwt-token',
      });

      const response = await handler(request);

      assertEquals(response.status, 404);
    });

    test('handles Plaid API errors', async () => {
      const connectionData = setupSuccessfulConnection();

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'connections') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: connectionData,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient.from(table);
      });

      // Mock Plaid API failure
      globalThis.fetch = async (url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();

        if (urlString.includes('sandbox.plaid.com/item/remove')) {
          return new Response(JSON.stringify({
            error_type: 'INVALID_ACCESS_TOKEN',
            error_code: 'INVALID_ACCESS_TOKEN',
            error_message: 'Access token is invalid.',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('Not Found', { status: 404 });
      };

      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('DELETE', {
        connectionId: mockConnectionId,
      }, {
        Authorization: 'Bearer test-jwt-token',
      });

      const response = await handler(request);

      assertEquals(response.status, 500);
    });

    test('handles database update failures', async () => {
      const connectionData = setupSuccessfulConnection();

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'connections') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: connectionData,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient.from(table);
      });

      // Mock RPC failure
      mockSupabaseClient.rpc.mockImplementation((funcName: string) => {
        if (funcName === 'disconnect_connection') {
          return { error: { message: 'Database update failed' } };
        }
        return { error: null };
      });

      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('DELETE', {
        connectionId: mockConnectionId,
      }, {
        Authorization: 'Bearer test-jwt-token',
      });

      const response = await handler(request);

      assertEquals(response.status, 500);
    });

    test('handles missing authorization header', async () => {
      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('DELETE', {
        connectionId: mockConnectionId,
      }); // No authorization header

      const response = await handler(request);

      assertEquals(response.status, 401);
    });

    test('handles wrong HTTP method', async () => {
      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('GET', {}, {
        Authorization: 'Bearer test-jwt-token',
      });

      const response = await handler(request);

      assertEquals(response.status, 405);
    });

    test('handles missing connection ID', async () => {
      const { default: handler } = await import('./index.ts');

      const request = createMockRequest('DELETE', {}, {
        Authorization: 'Bearer test-jwt-token',
      });

      const response = await handler(request);

      assertEquals(response.status, 400);
    });
  });
});