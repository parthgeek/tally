import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/plaid/link-token/route";
import { NextRequest } from "next/server";
import type { OrgId } from "@nexus/types";

// Mock dependencies
vi.mock("@/lib/api/with-org");
vi.mock("@/lib/plaid/client");

describe("POST /api/plaid/link-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create link token for authenticated user", async () => {
    // Mock successful auth
    const { withOrgFromRequest } = await import("@/lib/api/with-org");
    vi.mocked(withOrgFromRequest).mockResolvedValue({
      userId: "user-123",
      orgId: "org-456" as OrgId,
    });

    // Mock Plaid client
    const mockPlaidClient = {
      linkTokenCreate: vi.fn().mockResolvedValue({
        data: { link_token: "test-link-token-12345" },
      }),
    };

    const { createPlaidClient } = await import("@/lib/plaid/client");
    vi.mocked(createPlaidClient).mockReturnValue(mockPlaidClient as any);

    const request = new NextRequest("http://localhost/api/plaid/link-token", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.linkToken).toBe("test-link-token-12345");

    // Verify Plaid client was called correctly
    expect(mockPlaidClient.linkTokenCreate).toHaveBeenCalledWith({
      user: {
        client_user_id: "org-456_user-123",
      },
      client_name: "Tally Financial Automation",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
      webhook: "http://localhost:3000/api/plaid/webhook",
    });
  });

  it("should return 401 for unauthenticated request", async () => {
    const { withOrgFromRequest } = await import("@/lib/api/with-org");
    vi.mocked(withOrgFromRequest).mockRejectedValue(new Response("Unauthorized", { status: 401 }));

    const request = new NextRequest("http://localhost/api/plaid/link-token", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should handle Plaid API errors gracefully", async () => {
    const { withOrgFromRequest } = await import("@/lib/api/with-org");
    vi.mocked(withOrgFromRequest).mockResolvedValue({
      userId: "user-123",
      orgId: "org-456" as OrgId,
    });

    // Mock Plaid error
    const mockPlaidClient = {
      linkTokenCreate: vi.fn().mockRejectedValue(new Error("Plaid API Error")),
    };

    const { createPlaidClient } = await import("@/lib/plaid/client");
    vi.mocked(createPlaidClient).mockReturnValue(mockPlaidClient as any);

    const request = new NextRequest("http://localhost/api/plaid/link-token", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Failed to create link token");
  });
});
