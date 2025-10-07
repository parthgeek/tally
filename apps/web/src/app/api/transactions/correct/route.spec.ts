import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock external dependencies
vi.mock("@nexus/analytics/server", () => ({
  getPosthogClientServer: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@nexus/categorizer", () => ({
  normalizeVendor: vi.fn((vendor: string) => vendor.toLowerCase().trim()),
}));

vi.mock("@/lib/api/with-org", () => ({
  withOrgFromRequest: vi.fn(),
  createValidationErrorResponse: vi.fn((error) =>
    Response.json({ error: "Validation failed", details: error }, { status: 400 })
  ),
  createErrorResponse: vi.fn((message, status) => Response.json({ error: message }, { status })),
}));

vi.mock("@/lib/supabase", () => ({
  createServerClient: vi.fn(),
}));

describe("POST /api/transactions/correct", () => {
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn(),
            or: vi.fn().mockReturnValue({
              single: vi.fn(),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: "hair salon llc", error: null }),
    };

    const { createServerClient } = vi.mocked(await import("@/lib/supabase"));
    createServerClient.mockResolvedValue(mockSupabase);

    const withOrgModule = await import("@/lib/api/with-org");
    const { withOrgFromRequest } = vi.mocked(withOrgModule);
    withOrgFromRequest.mockResolvedValue({
      userId: "user-123",
      orgId: "org-456" as any,
    });

    const analyticsModule = await import("@nexus/analytics/server");
    const { getPosthogClientServer } = vi.mocked(analyticsModule);
    getPosthogClientServer.mockResolvedValue({
      capture: vi.fn(),
    } as any);
  });

  test("successfully corrects transaction category", async () => {
    // Setup mocks
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "tx-123",
                    org_id: "org-456",
                    merchant_name: "Hair Salon Inc",
                    mcc: "7230",
                    category_id: "old-cat-123",
                    confidence: 0.7,
                  },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      } else if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "new-cat-456", name: "Hair Services" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      } else if (table === "corrections") {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      } else if (table === "rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return mockSupabase.from();
    });

    const request = new NextRequest("http://localhost:3000/api/transactions/correct", {
      method: "POST",
      body: JSON.stringify({
        txId: "tx-123",
        newCategoryId: "new-cat-456",
      }),
    });

    // Import and call the handler
    const { POST } = await import("./route.js");
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Transaction categorized as "Hair Services"');
  });

  test("returns 404 when transaction not found", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "Not found" },
                }),
            }),
          }),
        };
      }
      return mockSupabase.from();
    });

    const request = new NextRequest("http://localhost:3000/api/transactions/correct", {
      method: "POST",
      body: JSON.stringify({
        txId: "nonexistent-tx",
        newCategoryId: "new-cat-456",
      }),
    });

    const { POST } = await import("./route.js");
    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  test("returns 403 when user lacks access to transaction org", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "tx-123",
                    org_id: "different-org",
                    merchant_name: "Hair Salon Inc",
                    category_id: "old-cat-123",
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return mockSupabase.from();
    });

    const request = new NextRequest("http://localhost:3000/api/transactions/correct", {
      method: "POST",
      body: JSON.stringify({
        txId: "tx-123",
        newCategoryId: "new-cat-456",
      }),
    });

    const { POST } = await import("./route.js");
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  test("returns 400 when category is invalid", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "tx-123",
                    org_id: "org-456",
                    merchant_name: "Hair Salon Inc",
                    category_id: "old-cat-123",
                  },
                  error: null,
                }),
            }),
          }),
        };
      } else if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                single: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: "Not found" },
                  }),
              }),
            }),
          }),
        };
      }
      return mockSupabase.from();
    });

    const request = new NextRequest("http://localhost:3000/api/transactions/correct", {
      method: "POST",
      body: JSON.stringify({
        txId: "tx-123",
        newCategoryId: "invalid-category",
      }),
    });

    const { POST } = await import("./route.js");
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  test("creates vendor rule when merchant name exists", async () => {
    const insertRuleMock = vi.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "tx-123",
                    org_id: "org-456",
                    merchant_name: "Hair Salon LLC",
                    mcc: "7230",
                    category_id: "old-cat-123",
                    confidence: 0.7,
                  },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      } else if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "new-cat-456", name: "Hair Services" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      } else if (table === "corrections") {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      } else if (table === "rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: insertRuleMock,
        };
      }
      return mockSupabase.from();
    });

    const request = new NextRequest("http://localhost:3000/api/transactions/correct", {
      method: "POST",
      body: JSON.stringify({
        txId: "tx-123",
        newCategoryId: "new-cat-456",
      }),
    });

    const { POST } = await import("./route.js");
    await POST(request);

    expect(insertRuleMock).toHaveBeenCalledWith({
      org_id: "org-456",
      pattern: {
        vendor: "hair salon llc",
        mcc: "7230",
      },
      category_id: "new-cat-456",
      weight: 1,
    });
  });

  test("increments weight of existing vendor rule", async () => {
    const updateRuleMock = vi.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "tx-123",
                    org_id: "org-456",
                    merchant_name: "Hair Salon LLC",
                    category_id: "old-cat-123",
                  },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      } else if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "new-cat-456", name: "Hair Services" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      } else if (table === "corrections") {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      } else if (table === "rules") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: "rule-123", weight: 3 },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
          update: () => ({
            eq: () => updateRuleMock({ weight: 4 }),
          }),
        };
      }
      return mockSupabase.from();
    });

    const request = new NextRequest("http://localhost:3000/api/transactions/correct", {
      method: "POST",
      body: JSON.stringify({
        txId: "tx-123",
        newCategoryId: "new-cat-456",
      }),
    });

    const { POST } = await import("./route.js");
    await POST(request);

    expect(updateRuleMock).toHaveBeenCalledWith({ weight: 4 });
  });
});
