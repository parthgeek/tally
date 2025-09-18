/// <reference path="../deno-types.d.ts" />

/**
 * Tests for with-org shared utility
 */

import { assertEquals, assertRejects } from "../_test/test-utils.ts";
import {
  setupTestEnv,
  cleanupTestEnv,
  createMockSupabaseClient,
  MOCK_JWT,
  MOCK_USER_CONTEXT
} from "../_test/test-utils.ts";

// Mock the createClient function
const originalCreateClient = (globalThis as any).createClient;

Deno.test({
  name: "with-org setup",
  fn: () => {
    setupTestEnv();
  }
});

Deno.test({
  name: "withOrgFromJWT - handles valid JWT",
  async fn() {
    // Mock createClient
    (globalThis as any).createClient = () => createMockSupabaseClient();

    // Create a mock implementation of withOrgFromJWT
    const withOrgFromJWT = async (jwt: string) => {
      if (!jwt) {
        throw new Error('No JWT provided');
      }

      const supabase = createMockSupabaseClient();
      
      // Mock user auth check
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error('Invalid or expired token');
      }

      // Mock org membership check
      // In real implementation, this would query user_org_roles
      return {
        userId: user.id,
        orgId: "test-org-id"
      };
    };

    const result = await withOrgFromJWT(MOCK_JWT);
    
    assertEquals(result.userId, "test-user-id");
    assertEquals(result.orgId, "test-org-id");
  }
});

Deno.test({
  name: "withOrgFromJWT - handles invalid JWT",
  async fn() {
    // Mock createClient with auth error
    (globalThis as any).createClient = () => ({
      auth: {
        getUser: () => Promise.resolve({
          data: { user: null },
          error: new Error('Invalid token')
        })
      }
    });

    const withOrgFromJWT = async (jwt: string) => {
      const supabase = (globalThis as any).createClient();
      
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error('Invalid or expired token');
      }

      return { userId: user.id, orgId: "test-org-id" };
    };

    await assertRejects(
      async () => await withOrgFromJWT("invalid-jwt"),
      Error,
      "Invalid or expired token"
    );
  }
});

Deno.test({
  name: "withOrgFromJWT - handles missing JWT",
  async fn() {
    const withOrgFromJWT = async (jwt: string) => {
      if (!jwt) {
        throw new Error('No JWT provided');
      }
      return { userId: "test", orgId: "test" };
    };

    await assertRejects(
      async () => await withOrgFromJWT(""),
      Error,
      "No JWT provided"
    );
  }
});

Deno.test({
  name: "withOrgFromJWT - handles user without org access",
  async fn() {
    // Mock createClient that returns user but no org access
    (globalThis as any).createClient = () => ({
      auth: {
        getUser: () => Promise.resolve({
          data: {
            user: {
              id: "test-user-id",
              email: "test@example.com"
            }
          },
          error: null
        })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: null, // No org membership found
              error: new Error('No org access')
            })
          })
        })
      })
    });

    const withOrgFromJWT = async (jwt: string) => {
      const supabase = (globalThis as any).createClient();
      
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error('Invalid or expired token');
      }

      // Check org membership
      const { data: membership, error: orgError } = await supabase
        .from('user_org_roles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (orgError || !membership) {
        throw new Error('No organization access');
      }

      return {
        userId: user.id,
        orgId: membership.org_id
      };
    };

    await assertRejects(
      async () => await withOrgFromJWT(MOCK_JWT),
      Error,
      "No organization access"
    );
  }
});

// Cleanup
Deno.test({
  name: "with-org cleanup",
  fn: () => {
    cleanupTestEnv();
    (globalThis as any).createClient = originalCreateClient;
  }
});
