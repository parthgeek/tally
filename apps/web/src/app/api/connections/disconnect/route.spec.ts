import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";

// Mock dependencies at top level
vi.mock("@/lib/api/with-org", () => ({
  withOrgFromRequest: vi.fn(),
  createErrorResponse: vi.fn((message: string, status: number) =>
    Response.json({ error: message }, { status })
  ),
  createValidationErrorResponse: vi.fn((error: unknown) =>
    Response.json({ error: "Validation failed", details: error }, { status: 400 })
  ),
}));

vi.mock("@/lib/supabase", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit-redis", () => ({
  checkRateLimit: vi.fn(),
  getRateLimitKey: vi.fn(),
  createRateLimitResponse: vi.fn(),
  getRateLimitConfig: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  validateRequestBody: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("DELETE /api/connections/disconnect", () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockOrgId = "org-123";
  const mockUserId = "user-123";
  const mockConnectionId = "conn-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DELETE handler", () => {
    test("successfully disconnects a connection", async () => {
      // Setup mocks
      const { withOrgFromRequest } = await import("@/lib/api/with-org");
      const { createServerClient } = await import("@/lib/supabase");
      const { checkRateLimit, getRateLimitConfig } = await import("@/lib/rate-limit-redis");
      const { validateRequestBody } = await import("@/lib/validation");

      vi.mocked(withOrgFromRequest).mockResolvedValue({ orgId: mockOrgId });
      vi.mocked(createServerClient).mockReturnValue(mockSupabaseClient);
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 300000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue({ limit: 10, windowMs: 300000 });
      vi.mocked(validateRequestBody).mockResolvedValue({
        success: true,
        data: { connectionId: mockConnectionId },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      });

      // Setup connection query
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockConnectionId,
            provider: "plaid",
            status: "active",
            org_id: mockOrgId,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockSelectQuery);

      // Mock successful Edge Function response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: "Bank account disconnected successfully",
        }),
      });

      const request = new NextRequest("http://localhost/api/connections/disconnect", {
        method: "DELETE",
        body: JSON.stringify({ connectionId: mockConnectionId }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Bank account disconnected successfully");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/plaid-disconnect"),
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
          body: JSON.stringify({ connectionId: mockConnectionId }),
        })
      );
    });

    test("handles already disconnected connection", async () => {
      // Setup mocks
      const { withOrgFromRequest } = await import("@/lib/api/with-org");
      const { createServerClient } = await import("@/lib/supabase");
      const { checkRateLimit, getRateLimitConfig } = await import("@/lib/rate-limit-redis");
      const { validateRequestBody } = await import("@/lib/validation");

      vi.mocked(withOrgFromRequest).mockResolvedValue({ orgId: mockOrgId });
      vi.mocked(createServerClient).mockReturnValue(mockSupabaseClient);
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 300000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue({ limit: 10, windowMs: 300000 });
      vi.mocked(validateRequestBody).mockResolvedValue({
        success: true,
        data: { connectionId: mockConnectionId },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      });

      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockConnectionId,
            provider: "plaid",
            status: "disconnected",
            org_id: mockOrgId,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockSelectQuery);

      const request = new NextRequest("http://localhost/api/connections/disconnect", {
        method: "DELETE",
        body: JSON.stringify({ connectionId: mockConnectionId }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Connection already disconnected");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("returns 404 for non-existent connection", async () => {
      // Setup mocks
      const { withOrgFromRequest } = await import("@/lib/api/with-org");
      const { createServerClient } = await import("@/lib/supabase");
      const { checkRateLimit, getRateLimitConfig } = await import("@/lib/rate-limit-redis");
      const { validateRequestBody } = await import("@/lib/validation");

      vi.mocked(withOrgFromRequest).mockResolvedValue({ orgId: mockOrgId });
      vi.mocked(createServerClient).mockReturnValue(mockSupabaseClient);
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 300000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue({ limit: 10, windowMs: 300000 });
      vi.mocked(validateRequestBody).mockResolvedValue({
        success: true,
        data: { connectionId: mockConnectionId },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      });

      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Connection not found" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockSelectQuery);

      const request = new NextRequest("http://localhost/api/connections/disconnect", {
        method: "DELETE",
        body: JSON.stringify({ connectionId: mockConnectionId }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });
  });
});
