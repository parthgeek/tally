import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import type { DashboardDTO } from "@nexus/types/contracts";

// Mock dependencies
vi.mock("@/lib/api/with-org", () => ({
  withOrgFromRequest: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@nexus/shared", () => ({
  sumCents: vi.fn(),
  pctDelta: vi.fn(),
  zScore: vi.fn(),
}));

import { withOrgFromRequest } from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import { sumCents, pctDelta, zScore } from "@nexus/shared";

const mockWithOrgFromRequest = vi.mocked(withOrgFromRequest);
const mockCreateServerClient = vi.mocked(createServerClient);
const mockSumCents = vi.mocked(sumCents);
const mockPctDelta = vi.mocked(pctDelta);
const mockZScore = vi.mocked(zScore);

const mockSupabase = {
  from: vi.fn(),
};

const mockQuery = {
  select: vi.fn(() => mockQuery),
  eq: vi.fn(() => mockQuery),
  in: vi.fn(() => mockQuery),
  gte: vi.fn(() => mockQuery),
  lte: vi.fn(() => mockQuery),
  lt: vi.fn(() => mockQuery),
  single: vi.fn(),
};

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockWithOrgFromRequest.mockResolvedValue({
      userId: "user-123",
      orgId: "org-456" as any,
    });

    mockCreateServerClient.mockResolvedValue(mockSupabase as any);
    mockSupabase.from.mockReturnValue(mockQuery);

    mockSumCents.mockReturnValue("100000"); // $1000.00
    mockPctDelta.mockReturnValue(15.5);
    mockZScore.mockReturnValue(1.2);
  });

  test("returns dashboard data with correct structure", async () => {
    // Mock account balance data
    mockQuery.single.mockResolvedValueOnce({
      data: [{ current_balance_cents: "50000" }, { current_balance_cents: "75000" }],
      error: null,
    });

    // Mock transactions data
    mockQuery.single.mockResolvedValue({
      data: [{ amount_cents: "10000" }, { amount_cents: "-5000" }],
      error: null,
    });

    // Mock org data
    mockQuery.single.mockResolvedValueOnce({
      data: { low_balance_threshold_cents: "100000" },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/dashboard");
    const response = await GET(request);

    expect(response.status).toBe(200);

    const data: DashboardDTO = await response.json();

    expect(data).toHaveProperty("cashOnHandCents");
    expect(data).toHaveProperty("safeToSpend14Cents");
    expect(data).toHaveProperty("inflowOutflow");
    expect(data).toHaveProperty("topExpenses30");
    expect(data).toHaveProperty("trend");
    expect(data).toHaveProperty("alerts");
    expect(data).toHaveProperty("generatedAt");

    expect(data.inflowOutflow).toHaveProperty("d30");
    expect(data.inflowOutflow).toHaveProperty("d90");
    expect(data.inflowOutflow.d30).toHaveProperty("inflowCents");
    expect(data.inflowOutflow.d30).toHaveProperty("outflowCents");
    expect(data.inflowOutflow.d30).toHaveProperty("dailyAvgInflowCents");
    expect(data.inflowOutflow.d30).toHaveProperty("dailyAvgOutflowCents");

    expect(data.alerts).toHaveProperty("lowBalance");
    expect(data.alerts).toHaveProperty("unusualSpend");
    expect(data.alerts).toHaveProperty("needsReviewCount");
  });

  test("handles missing account data gracefully", async () => {
    // Mock empty account data
    mockQuery.single.mockResolvedValue({
      data: null,
      error: null,
    });

    mockSumCents.mockReturnValue("0");

    const request = new NextRequest("http://localhost:3000/api/dashboard");
    const response = await GET(request);

    expect(response.status).toBe(200);

    const data: DashboardDTO = await response.json();
    expect(data.cashOnHandCents).toBe("0");
  });

  test("handles authentication error", async () => {
    mockWithOrgFromRequest.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const request = new NextRequest("http://localhost:3000/api/dashboard");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  test("returns proper cache headers", async () => {
    // Mock successful data
    mockQuery.single.mockResolvedValue({
      data: [],
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/dashboard");
    const response = await GET(request);

    expect(response.headers.get("Cache-Control")).toBe("s-maxage=30, stale-while-revalidate=120");
  });

  test("calculates safe to spend correctly", async () => {
    mockSumCents
      .mockReturnValueOnce("500000") // cash on hand: $5000
      .mockReturnValueOnce("30000") // daily avg inflow: $300
      .mockReturnValueOnce("20000"); // daily avg outflow: $200

    // Mock data responses
    mockQuery.single.mockResolvedValue({
      data: [{ current_balance_cents: "500000" }],
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/dashboard");
    const response = await GET(request);

    expect(response.status).toBe(200);

    // Verify sumCents was called to calculate safe-to-spend
    expect(mockSumCents).toHaveBeenCalled();
  });

  test("handles database errors gracefully", async () => {
    mockQuery.single.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const request = new NextRequest("http://localhost:3000/api/dashboard");
    const response = await GET(request);

    // Should still return 200 but with default values
    expect(response.status).toBe(200);
  });
});
