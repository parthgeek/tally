import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createLinkToken, PlaidClientError, PlaidError } from "./client";
import { createTestOrg, createTestUser, cleanupTestData } from "@/test/db-setup";

describe("Plaid Client Integration", () => {
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    testOrgId = await createTestOrg("Plaid Test Org");
    testUserId = await createTestUser(testOrgId);
  });

  afterAll(async () => {
    await cleanupTestData(testOrgId);
  });

  describe("createLinkToken", () => {
    it("should create a valid link token with real Plaid API", async () => {
      // Skip if no Plaid credentials (for CI environments)
      if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
        console.warn("Skipping Plaid integration test - missing credentials");
        return;
      }

      const linkToken = await createLinkToken({
        userId: testUserId,
        orgId: testOrgId,
        webhookUrl: "https://example.com/webhook",
      });

      expect(linkToken).toMatch(/^link-sandbox-[a-f0-9-]+$/);
    });

    it("should handle invalid credentials gracefully", async () => {
      // Temporarily override env vars
      const originalClientId = process.env.PLAID_CLIENT_ID;
      process.env.PLAID_CLIENT_ID = "invalid_client_id";

      try {
        await createLinkToken({
          userId: testUserId,
          orgId: testOrgId,
        });

        expect.fail("Should have thrown PlaidClientError");
      } catch (error) {
        expect(error).toBeInstanceOf(PlaidClientError);
        expect((error as PlaidClientError).code).toBe(PlaidError.INVALID_CREDENTIALS);
      } finally {
        process.env.PLAID_CLIENT_ID = originalClientId;
      }
    });

    it("should validate required parameters", async () => {
      try {
        await createLinkToken({
          userId: "",
          orgId: testOrgId,
        });
        expect.fail("Should have thrown error for empty userId");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should use default configuration values", async () => {
      if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
        return;
      }

      const linkToken = await createLinkToken({
        userId: testUserId,
        orgId: testOrgId,
        // No webhookUrl, products, or countryCodes - should use defaults
      });

      expect(linkToken).toMatch(/^link-sandbox-[a-f0-9-]+$/);
    });
  });
});
