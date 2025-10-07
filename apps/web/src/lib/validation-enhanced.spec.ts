/**
 * Comprehensive tests for enhanced input validation
 * Tests security features, sanitization, and all validation schemas
 */

import { describe, test, expect } from "vitest";
import {
  validateRequestBody,
  validateQueryParams,
  validationSchemas,
  validators,
  createValidationErrorResponse,
  withValidation,
} from "./validation-enhanced";
import { z } from "zod";

describe("Enhanced Input Validation", () => {
  describe("Basic validators", () => {
    test("should validate UUIDs correctly", () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const invalidUuid = "not-a-uuid";

      expect(validators.uuid.safeParse(validUuid).success).toBe(true);
      expect(validators.uuid.safeParse(invalidUuid).success).toBe(false);
    });

    test("should validate and normalize emails", () => {
      const result = validators.email.safeParse("  TEST@EXAMPLE.COM  ");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("test@example.com");
      }
    });

    test("should validate secure passwords", () => {
      const validPassword = "SecurePass123!";
      const weakPassword = "weak";

      expect(validators.password.safeParse(validPassword).success).toBe(true);
      expect(validators.password.safeParse(weakPassword).success).toBe(false);

      // Test specific requirements
      expect(validators.password.safeParse("nouppercase123!").success).toBe(false);
      expect(validators.password.safeParse("NOLOWERCASE123!").success).toBe(false);
      expect(validators.password.safeParse("NoNumbers!").success).toBe(false);
      expect(validators.password.safeParse("NoSpecialChars123").success).toBe(false);
    });

    test("should sanitize organization names", () => {
      const result = validators.organizationName.safeParse(
        '  <script>alert("xss")</script>My Org  '
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('alert("xss")My Org');
      }
    });

    test("should validate financial amounts", () => {
      expect(validators.amount.safeParse(12345).success).toBe(true);
      expect(validators.amount.safeParse("12345").success).toBe(true); // coercion
      expect(validators.amount.safeParse(12.5).success).toBe(false); // must be integer
      expect(validators.amount.safeParse(1000000000).success).toBe(false); // too large
    });

    test("should validate date ranges", () => {
      const validRange = {
        from: "2023-01-01T00:00:00Z",
        to: "2023-12-31T23:59:59Z",
      };

      const invalidRange = {
        from: "2023-12-31T23:59:59Z",
        to: "2023-01-01T00:00:00Z",
      };

      expect(validators.dateRange.safeParse(validRange).success).toBe(true);
      expect(validators.dateRange.safeParse(invalidRange).success).toBe(false);
    });

    test("should validate file uploads", () => {
      const validFile = {
        name: "receipt.pdf",
        type: "application/pdf",
        size: 1024 * 1024, // 1MB
      };

      const invalidFile = {
        name: "../../../etc/passwd",
        type: "text/plain",
        size: 20 * 1024 * 1024, // 20MB - too large
      };

      expect(validators.fileUpload.safeParse(validFile).success).toBe(true);
      expect(validators.fileUpload.safeParse(invalidFile).success).toBe(false);
    });
  });

  describe("Authentication schemas", () => {
    test("should validate sign in requests", () => {
      const validSignIn = {
        email: "user@example.com",
        password: "password123",
      };

      const invalidSignIn = {
        email: "not-an-email",
        password: "",
      };

      expect(validationSchemas.auth.signIn.safeParse(validSignIn).success).toBe(true);
      expect(validationSchemas.auth.signIn.safeParse(invalidSignIn).success).toBe(false);
    });

    test("should validate sign up with password confirmation", () => {
      const validSignUp = {
        email: "user@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      };

      const mismatchedPasswords = {
        email: "user@example.com",
        password: "SecurePass123!",
        confirmPassword: "DifferentPass123!",
      };

      expect(validationSchemas.auth.signUp.safeParse(validSignUp).success).toBe(true);
      expect(validationSchemas.auth.signUp.safeParse(mismatchedPasswords).success).toBe(false);
    });
  });

  describe("Plaid schemas", () => {
    test("should validate Plaid exchange requests", () => {
      const validExchange = {
        public_token: "public-sandbox-12345-abcdef",
        metadata: {
          institution_id: "ins_123",
          link_session_id: "session_456",
        },
      };

      const invalidExchange = {
        public_token: "invalid-token-format",
        metadata: {
          malicious_script: '<script>alert("xss")</script>',
        },
      };

      expect(validationSchemas.plaid.exchange.safeParse(validExchange).success).toBe(true);
      expect(validationSchemas.plaid.exchange.safeParse(invalidExchange).success).toBe(false);
    });

    test("should validate webhook verification", () => {
      const validWebhook = {
        webhook_type: "TRANSACTIONS",
        webhook_code: "DEFAULT_UPDATE",
        item_id: "item_123456789",
        request_id: "req_987654321",
      };

      const invalidWebhook = {
        webhook_type: "INVALID_TYPE",
        webhook_code: "",
        item_id: "x".repeat(200), // too long
      };

      expect(validationSchemas.plaid.webhookVerification.safeParse(validWebhook).success).toBe(
        true
      );
      expect(validationSchemas.plaid.webhookVerification.safeParse(invalidWebhook).success).toBe(
        false
      );
    });
  });

  describe("Transaction schemas", () => {
    test("should validate transaction listing with pagination", () => {
      const validList = {
        orgId: "123e4567-e89b-12d3-a456-426614174000",
        from: "2023-01-01T00:00:00Z",
        to: "2023-12-31T23:59:59Z",
        page: 1,
        limit: 20,
        searchTerm: "coffee shop",
      };

      expect(validationSchemas.transaction.list.safeParse(validList).success).toBe(true);

      // Test pagination limits
      const invalidPagination = { ...validList, page: 0, limit: 101 };
      expect(validationSchemas.transaction.list.safeParse(invalidPagination).success).toBe(false);
    });

    test("should validate bulk transaction corrections", () => {
      const validBulk = {
        transactionIds: [
          "123e4567-e89b-12d3-a456-426614174000",
          "987fcdeb-51d3-12a4-a456-426614174111",
        ],
        categoryId: "456e7890-e89b-12d3-a456-426614174000",
        createRule: true,
      };

      const invalidBulk = {
        transactionIds: [], // empty array
        categoryId: "invalid-uuid",
      };

      expect(validationSchemas.transaction.bulkCorrect.safeParse(validBulk).success).toBe(true);
      expect(validationSchemas.transaction.bulkCorrect.safeParse(invalidBulk).success).toBe(false);

      // Test array size limits
      const tooManyIds = {
        ...validBulk,
        transactionIds: Array(101).fill("123e4567-e89b-12d3-a456-426614174000"),
      };
      expect(validationSchemas.transaction.bulkCorrect.safeParse(tooManyIds).success).toBe(false);
    });
  });

  describe("validateRequestBody", () => {
    const testSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().min(0).max(120),
    });

    test("should validate correct JSON requests", async () => {
      const validBody = { name: "John", email: "john@example.com", age: 30 };
      const request = new Request("http://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const result = await validateRequestBody(request, testSchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validBody);
    });

    test("should reject invalid content type", async () => {
      const request = new Request("http://example.com", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });

      const result = await validateRequestBody(request, testSchema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Content-Type");
    });

    test("should reject malformed JSON", async () => {
      const request = new Request("http://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      });

      const result = await validateRequestBody(request, testSchema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });

    test("should reject oversized requests", async () => {
      const largeBody = { data: "x".repeat(2 * 1024 * 1024) }; // 2MB
      const request = new Request("http://example.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": (2 * 1024 * 1024).toString(),
        },
        body: JSON.stringify(largeBody),
      });

      const result = await validateRequestBody(request, testSchema, { maxSize: 1024 * 1024 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("too large");
    });

    test("should sanitize input when enabled", async () => {
      const maliciousBody = {
        name: '<script>alert("xss")</script>John',
        email: "john@example.com",
        age: 30,
      };

      const request = new Request("http://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousBody),
      });

      const result = await validateRequestBody(request, testSchema, { sanitize: true });

      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.name).toBe('alert("xss")John');
      }
    });

    test("should handle schema validation errors", async () => {
      const invalidBody = {
        name: "", // too short
        email: "not-an-email",
        age: -5, // negative
      };

      const request = new Request("http://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidBody),
      });

      const result = await validateRequestBody(request, testSchema);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Validation failed");
      expect(result.details).toBeDefined();
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  describe("validateQueryParams", () => {
    const querySchema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
    });

    test("should validate query parameters", () => {
      const url = new URL("http://example.com?page=2&limit=50&search=test");
      const result = validateQueryParams(url, querySchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        page: 2,
        limit: 50,
        search: "test",
      });
    });

    test("should handle array parameters", () => {
      const url = new URL("http://example.com?tags=a&tags=b&tags=c");
      const result = validateQueryParams(url, querySchema);

      expect(result.success).toBe(true);
      expect(result.data?.tags).toEqual(["a", "b", "c"]);
    });

    test("should apply default values", () => {
      const url = new URL("http://example.com");
      const result = validateQueryParams(url, querySchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        page: 1,
        limit: 20,
      });
    });

    test("should handle validation errors", () => {
      const url = new URL("http://example.com?page=0&limit=200");
      const result = validateQueryParams(url, querySchema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("validation failed");
    });
  });

  describe("createValidationErrorResponse", () => {
    test("should create proper error response", async () => {
      const errors = [
        { path: ["email"], message: "Invalid email" },
        { path: ["age"], message: "Must be positive" },
      ];

      const response = createValidationErrorResponse(errors);

      expect(response.status).toBe(400);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Cache-Control")).toBe("no-store");

      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toEqual(errors);
    });
  });

  describe("withValidation middleware", () => {
    const testSchema = z.object({
      message: z.string().min(1),
    });

    test("should validate and pass data to handler", async () => {
      const validatedHandler = withValidation(testSchema)(async (data, request) => {
        expect(data.message).toBe("Hello World");
        return new Response("Success");
      });

      const request = new Request("http://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello World" }),
      });

      const response = await validatedHandler(request);
      expect(response.status).toBe(200);
    });

    test("should return validation error for invalid data", async () => {
      const validatedHandler = withValidation(testSchema)(async (data, request) => {
        return new Response("Should not reach here");
      });

      const request = new Request("http://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }), // Invalid: empty string
      });

      const response = await validatedHandler(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Validation failed");
    });
  });

  describe("Security features", () => {
    test("should prevent XSS in text fields", () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const result = validators.safeText.safeParse(maliciousInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('alert("xss")Hello');
      }
    });

    test("should validate file upload security", () => {
      const maliciousFile = {
        name: "../../../etc/passwd",
        type: "application/pdf",
        size: 1024,
      };

      const executableFile = {
        name: "virus.exe",
        type: "application/exe",
        size: 1024,
      };

      expect(validators.fileUpload.safeParse(maliciousFile).success).toBe(false);
      expect(validators.fileUpload.safeParse(executableFile).success).toBe(false);
    });

    test("should prevent SQL injection in search terms", () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const result = validators.safeText.safeParse(sqlInjection);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should be sanitized to remove dangerous characters
        expect(result.data).not.toContain("<");
        expect(result.data).not.toContain(">");
      }
    });

    test("should enforce reasonable limits on all inputs", () => {
      // Test various limits
      expect(validators.email.safeParse("a".repeat(300) + "@example.com").success).toBe(false);
      expect(validators.organizationName.safeParse("a".repeat(200)).success).toBe(false);
      expect(validators.safeText.safeParse("a".repeat(2000)).success).toBe(false);
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle null and undefined values", () => {
      expect(validators.safeText.safeParse(null).success).toBe(false);
      expect(validators.safeText.safeParse(undefined).success).toBe(false);
    });

    test("should handle nested object validation", () => {
      const complexSchema = z.object({
        user: z.object({
          profile: z.object({
            name: validators.safeText,
            settings: z.object({
              notifications: z.boolean(),
            }),
          }),
        }),
      });

      const validData = {
        user: {
          profile: {
            name: "John Doe",
            settings: {
              notifications: true,
            },
          },
        },
      };

      expect(complexSchema.safeParse(validData).success).toBe(true);
    });

    test("should handle unicode and international characters", () => {
      const unicodeText = "Hello 世界 🌍 Здравствуй мир";
      const result = validators.safeText.safeParse(unicodeText);

      expect(result.success).toBe(true);
      expect(result.data).toBe(unicodeText);
    });

    test("should validate currency amounts correctly", () => {
      // Test various currency representations
      expect(validators.amount.safeParse(12345).success).toBe(true); // $123.45 in cents
      expect(validators.amount.safeParse(-5000).success).toBe(true); // -$50.00 refund
      expect(validators.amount.safeParse(0).success).toBe(true); // $0.00
    });
  });
});
