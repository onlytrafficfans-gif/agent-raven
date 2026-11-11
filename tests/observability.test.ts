import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logger";
import { frameworkErrorFields } from "@/lib/observability";

afterEach(() => vi.restoreAllMocks());

describe("sanitized production observability", () => {
  it("records framework failures without request URLs, headers, messages, or unsafe digests", () => {
    const error = Object.assign(new Error("password=do-not-log"), { digest: "token=do-not-log" });
    const fields = frameworkErrorFields(
      error,
      { method: "GET" },
      { routerKind: "App Router", routePath: "/prospects/[id]", routeType: "render", renderSource: "server-rendering" },
    );

    expect(fields).toEqual({
      errorType: "Error",
      method: "GET",
      routerKind: "App Router",
      routePath: "/prospects/[id]",
      routeType: "render",
      renderSource: "server-rendering",
    });
    expect(JSON.stringify(fields)).not.toContain("do-not-log");
  });

  it("redacts nested secrets from structured events", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logEvent("error", "test.failure", {
      authorization: "Bearer secret-value",
      detail: "api_key=secret-value",
      nested: { password: "secret-value" },
    });

    const line = String(write.mock.calls[0]?.[0]);
    expect(line).toContain('"event":"test.failure"');
    expect(line).toContain("[REDACTED]");
    expect(line).not.toContain("secret-value");
  });

  it("logs only the correlation ID and error type for unexpected API failures", async () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = jsonError(new Error("credential=do-not-log"), "safe-correlation-id");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
      correlationId: "safe-correlation-id",
    });
    const line = String(write.mock.calls[0]?.[0]);
    expect(line).toContain('"event":"http.unhandled_error"');
    expect(line).toContain('"errorType":"Error"');
    expect(line).toContain('"correlationId":"safe-correlation-id"');
    expect(line).not.toContain("do-not-log");
  });
});
