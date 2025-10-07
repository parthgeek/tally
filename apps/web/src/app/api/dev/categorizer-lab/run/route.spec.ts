import { describe, test, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

// Mock the dependencies
vi.mock("@/lib/flags", () => ({
  isCategorizerLabEnabled: vi.fn(),
}));

// Mock the categorizer module
const mockPass1Categorize = vi.fn();
const mockScoreWithLLM = vi.fn();

vi.mock("@nexus/categorizer", () => ({
  pass1Categorize: mockPass1Categorize,
  scoreWithLLM: mockScoreWithLLM,
}));

import { isCategorizerLabEnabled } from "@/lib/flags";

describe("POST /api/dev/categorizer-lab/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 404 when lab is disabled", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Categorizer lab is not available");
  });

  test("processes Pass-1 only mode successfully", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    mockPass1Categorize.mockResolvedValue({
      categoryId: "meals",
      confidence: 0.85,
      rationale: ["MCC matches restaurant"],
    });

    const requestBody = {
      dataset: [
        {
          id: "tx-1",
          description: "STARBUCKS STORE #123",
          amountCents: "-500",
          merchantName: "STARBUCKS",
          mcc: "5814",
        },
      ],
      options: {
        mode: "pass1",
        batchSize: 10,
        concurrency: 1,
        hybridThreshold: 0.85,
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("success");
    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toBe("tx-1");
    expect(data.results[0].predictedCategoryId).toBe("meals");
    expect(data.results[0].confidence).toBe(0.85);
    expect(data.results[0].engine).toBe("pass1");
    expect(data.results[0].error).toBeUndefined();
    expect(data.metrics.totals.count).toBe(1);
    expect(data.metrics.totals.pass1Only).toBe(1);
    expect(data.metrics.totals.llmUsed).toBe(0);
  });

  test("processes Pass-2 only mode successfully", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    mockScoreWithLLM.mockResolvedValue({
      categoryId: "meals",
      confidence: 0.92,
      rationale: "Coffee shop transaction based on description pattern",
    });

    // Set environment variable for LLM key
    process.env.GEMINI_API_KEY = "test-key";

    const requestBody = {
      dataset: [
        {
          id: "tx-1",
          description: "COFFEE SHOP PAYMENT",
          amountCents: "-750",
        },
      ],
      options: {
        mode: "pass2",
        batchSize: 10,
        concurrency: 1,
        hybridThreshold: 0.85,
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("success");
    expect(data.results).toHaveLength(1);
    expect(data.results[0].predictedCategoryId).toBe("meals");
    expect(data.results[0].confidence).toBe(0.92);
    expect(data.results[0].engine).toBe("llm");
    expect(data.metrics.totals.llmUsed).toBe(1);
    expect(data.metrics.cost).toBeDefined();
    expect(data.metrics.cost!.calls).toBe(1);
  });

  test("processes hybrid mode with Pass-1 confidence above threshold", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    mockPass1Categorize.mockResolvedValue({
      categoryId: "meals",
      confidence: 0.95, // Above threshold
      rationale: ["Strong MCC match"],
    });

    const requestBody = {
      dataset: [
        {
          id: "tx-1",
          description: "CLEAR RESTAURANT",
          amountCents: "-1200",
          mcc: "5812",
        },
      ],
      options: {
        mode: "hybrid",
        batchSize: 10,
        concurrency: 1,
        hybridThreshold: 0.85,
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].engine).toBe("pass1"); // Should use Pass-1 result
    expect(data.results[0].confidence).toBe(0.95);
    expect(mockScoreWithLLM).not.toHaveBeenCalled(); // LLM should not be called
  });

  test("processes hybrid mode with Pass-1 confidence below threshold", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    mockPass1Categorize.mockResolvedValue({
      categoryId: "unclear",
      confidence: 0.3, // Below threshold
      rationale: ["Weak pattern match"],
    });
    mockScoreWithLLM.mockResolvedValue({
      categoryId: "office-supplies",
      confidence: 0.88,
      rationale: "Office supply purchase based on description",
    });

    process.env.GEMINI_API_KEY = "test-key";

    const requestBody = {
      dataset: [
        {
          id: "tx-1",
          description: "AMBIGUOUS PURCHASE",
          amountCents: "-2500",
        },
      ],
      options: {
        mode: "hybrid",
        batchSize: 10,
        concurrency: 1,
        hybridThreshold: 0.85,
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].engine).toBe("llm"); // Should use LLM result
    expect(data.results[0].confidence).toBe(0.88);
    expect(data.results[0].predictedCategoryId).toBe("office-supplies");
    expect(mockPass1Categorize).toHaveBeenCalled();
    expect(mockScoreWithLLM).toHaveBeenCalled();
  });

  test("handles Pass-1 errors gracefully", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    mockPass1Categorize.mockRejectedValue(new Error("Pass-1 failed"));

    const requestBody = {
      dataset: [
        {
          id: "tx-1",
          description: "ERROR TRANSACTION",
          amountCents: "-1000",
        },
      ],
      options: {
        mode: "pass1",
        batchSize: 10,
        concurrency: 1,
        hybridThreshold: 0.85,
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("partial"); // Some errors occurred
    expect(data.results[0].error).toBe("Pass-1 failed");
    expect(data.errors).toHaveLength(1);
    expect(data.metrics.totals.errors).toBe(1);
  });

  test("handles Pass-2 mode without API key", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    delete process.env.GEMINI_API_KEY;

    const requestBody = {
      dataset: [
        {
          id: "tx-1",
          description: "TEST TRANSACTION",
          amountCents: "-1000",
        },
      ],
      options: {
        mode: "pass2",
        batchSize: 10,
        concurrency: 1,
        hybridThreshold: 0.85,
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("partial");
    expect(data.results[0].error).toContain("GEMINI_API_KEY not configured");
  });

  test("validates request payload", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);

    const invalidRequestBody = {
      dataset: [], // Empty dataset
      options: {
        mode: "invalid-mode", // Invalid mode
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidRequestBody),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  test("calculates metrics correctly", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    mockPass1Categorize
      .mockResolvedValueOnce({
        categoryId: "meals",
        confidence: 0.9,
        rationale: ["Clear match"],
      })
      .mockResolvedValueOnce({
        categoryId: "utilities",
        confidence: 0.8,
        rationale: ["MCC match"],
      });

    const requestBody = {
      dataset: [
        {
          id: "tx-1",
          description: "RESTAURANT",
          amountCents: "-1000",
          categoryId: "meals", // Ground truth
        },
        {
          id: "tx-2",
          description: "ELECTRIC BILL",
          amountCents: "-5000",
          categoryId: "utilities", // Ground truth
        },
      ],
      options: {
        mode: "pass1",
        batchSize: 10,
        concurrency: 1,
        hybridThreshold: 0.85,
      },
    };

    const request = new NextRequest("http://localhost/api/dev/categorizer-lab/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metrics.totals.count).toBe(2);
    expect(data.metrics.accuracy).toBeDefined();
    expect(data.metrics.accuracy!.overall).toBe(1.0); // 100% accuracy
    expect(data.metrics.confidence.mean).toBe(0.85); // (0.9 + 0.8) / 2
  });
});

describe("GET /api/dev/categorizer-lab/run (health check)", () => {
  test("returns 404 when lab is disabled", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(false);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.available).toBe(false);
  });

  test("returns health status when lab is enabled", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    process.env.GEMINI_API_KEY = "test-key";

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.available).toBe(true);
    expect(data.features.pass1).toBe(true);
    expect(data.features.pass2).toBe(true);
    expect(data.features.hybrid).toBe(true);
  });

  test("indicates limited features without API key", async () => {
    vi.mocked(isCategorizerLabEnabled).mockReturnValue(true);
    delete process.env.GEMINI_API_KEY;

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.features.pass1).toBe(true);
    expect(data.features.pass2).toBe(false);
    expect(data.features.hybrid).toBe(false);
  });
});
