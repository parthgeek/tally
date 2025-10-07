import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import {
  redactSensitiveFields,
  logError,
  safeRequestLog,
  safeResponseLog,
  logPlaidError,
} from "./logging";

describe("redactSensitiveFields", () => {
  test("redacts sensitive field names", () => {
    const sensitive = {
      access_token: "secret-token",
      refresh_token: "refresh-secret",
      api_key: "api-secret",
      password: "user-password",
      authorization: "Bearer token",
      normal_field: "safe-value",
    };

    const result = redactSensitiveFields(sensitive);

    expect(result.access_token).toBe("[REDACTED]");
    expect(result.refresh_token).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.authorization).toBe("[REDACTED]");
    expect(result.normal_field).toBe("safe-value");
  });

  test("handles nested objects", () => {
    const nested = {
      user: {
        name: "John Doe",
        password: "secret123",
        session: {
          access_token: "token123",
          expires_at: "2024-01-01",
        },
      },
      data: {
        value: "safe",
      },
    };

    const result = redactSensitiveFields(nested);

    expect(result.user.name).toBe("John Doe");
    expect(result.user.password).toBe("[REDACTED]");
    expect(result.user.session.access_token).toBe("[REDACTED]");
    expect(result.user.session.expires_at).toBe("2024-01-01");
    expect(result.data.value).toBe("safe");
  });

  test("handles arrays", () => {
    const withArray = {
      items: [
        { id: 1, secret: "hidden" },
        { id: 2, name: "visible" },
      ],
    };

    const result = redactSensitiveFields(withArray);

    expect(result.items[0].id).toBe(1);
    expect(result.items[0].secret).toBe("[REDACTED]");
    expect(result.items[1].id).toBe(2);
    expect(result.items[1].name).toBe("visible");
  });

  test("prevents infinite recursion", () => {
    const circular: any = { name: "test" };
    circular.self = circular;

    const result = redactSensitiveFields(circular);

    expect(result.name).toBe("test");
    expect(result.self).toBe("[MAX_DEPTH_REACHED]");
  });

  test("handles null and undefined values", () => {
    const data = {
      null_field: null,
      undefined_field: undefined,
      secret: "hidden",
    };

    const result = redactSensitiveFields(data);

    expect(result.null_field).toBe(null);
    expect(result.undefined_field).toBe(undefined);
    expect(result.secret).toBe("[REDACTED]");
  });
});

describe("logError", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test("logs error with message and safe error details", () => {
    const error = new Error("Test error");
    error.stack = "Error: Test error\n  at test.js:1:1\n  at main.js:2:2";

    logError("Test message", error);

    expect(consoleSpy).toHaveBeenCalledWith("Test message", {
      error: {
        message: "Test error",
        name: "Error",
        stack: "Error: Test error\n  at test.js:1:1\n  at main.js:2:2",
        code: undefined,
        status: undefined,
      },
      context: undefined,
    });
  });

  test("logs error with redacted context", () => {
    const error = new Error("Test error");
    const context = {
      user_id: "123",
      access_token: "secret-token",
      request_data: "safe-data",
    };

    logError("Test message", error, context);

    expect(consoleSpy).toHaveBeenCalledWith("Test message", {
      error: expect.any(Object),
      context: {
        user_id: "123",
        access_token: "[REDACTED]",
        request_data: "safe-data",
      },
    });
  });

  test("handles non-Error objects", () => {
    const notAnError = "String error";

    logError("Test message", notAnError);

    expect(consoleSpy).toHaveBeenCalledWith("Test message", {
      error: {
        message: "String error",
        name: undefined,
        stack: undefined,
        code: undefined,
        status: undefined,
      },
      context: undefined,
    });
  });

  test("limits stack trace length", () => {
    const error = new Error("Test error");
    const longStack = Array.from({ length: 10 }, (_, i) => `  at line${i}:1:1`).join("\n");
    error.stack = `Error: Test error\n${longStack}`;

    logError("Test message", error);

    const logged = consoleSpy.mock.calls[0][1];
    const stackLines = logged.error.stack.split("\n");
    expect(stackLines.length).toBeLessThanOrEqual(6); // Error message + 5 stack lines
  });
});

describe("safeRequestLog", () => {
  test("creates safe request log object", () => {
    const request = new Request("http://localhost:3000/api/test?param=value", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret-token",
        "X-Custom": "safe-value",
      },
      body: JSON.stringify({ data: "test" }),
    });

    const result = safeRequestLog(request);

    expect(result.method).toBe("POST");
    expect(result.pathname).toBe("/api/test");
    expect(result.search).toBe("?param=value");
    expect(result.headers.authorization).toBe("[REDACTED]");
    expect(result.headers["x-custom"]).toBe("safe-value");
    expect(result.headers["content-type"]).toBe("application/json");
    expect(result.hasBody).toBe(true);
    expect(result).not.toHaveProperty("body"); // Body should never be logged
  });

  test("handles request without body", () => {
    const request = new Request("http://localhost:3000/api/test", {
      method: "GET",
    });

    const result = safeRequestLog(request);

    expect(result.method).toBe("GET");
    expect(result.hasBody).toBe(false);
  });
});

describe("safeResponseLog", () => {
  test("creates safe response log object", () => {
    const response = new Response(JSON.stringify({ data: "test" }), {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "session=secret-value",
        "X-Custom": "safe-value",
      },
    });

    const result = safeResponseLog(response);

    expect(result.status).toBe(200);
    expect(result.statusText).toBe("OK");
    expect(result.headers.cookie).toBe("[REDACTED]");
    expect(result.headers["x-custom"]).toBe("safe-value");
    expect(result.hasBody).toBe(true);
    expect(result).not.toHaveProperty("body"); // Body should never be logged
  });
});

describe("logPlaidError", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test("logs Plaid error with safe fields only", () => {
    const plaidError = {
      error_code: "ITEM_LOGIN_REQUIRED",
      error_type: "ITEM_ERROR",
      error_message: "the login details of this item have changed",
      display_message: "Please update your login information",
      request_id: "req-123",
      sensitive_data: "should-not-be-logged",
      access_token: "secret-token",
    };

    logPlaidError("token_exchange", plaidError, "req-456");

    expect(consoleSpy).toHaveBeenCalledWith("Plaid API error", {
      operation: "token_exchange",
      error_code: "ITEM_LOGIN_REQUIRED",
      error_type: "ITEM_ERROR",
      error_message: "the login details of this item have changed",
      display_message: "Please update your login information",
      request_id: "req-456", // Should use provided request_id
      status: undefined,
    });

    // Verify sensitive fields are not logged
    const logged = consoleSpy.mock.calls[0][1];
    expect(logged).not.toHaveProperty("sensitive_data");
    expect(logged).not.toHaveProperty("access_token");
  });

  test("uses error request_id when not provided separately", () => {
    const plaidError = {
      error_code: "RATE_LIMIT_EXCEEDED",
      request_id: "req-from-error",
    };

    logPlaidError("api_call", plaidError);

    expect(consoleSpy).toHaveBeenCalledWith("Plaid API error", {
      operation: "api_call",
      error_code: "RATE_LIMIT_EXCEEDED",
      error_type: undefined,
      error_message: undefined,
      display_message: undefined,
      request_id: "req-from-error",
      status: undefined,
    });
  });

  test("handles HTTP response errors", () => {
    const httpError = {
      response: {
        status: 400,
      },
      error_code: "INVALID_REQUEST",
    };

    logPlaidError("http_request", httpError);

    const logged = consoleSpy.mock.calls[0][1];
    expect(logged.status).toBe(400);
  });
});
