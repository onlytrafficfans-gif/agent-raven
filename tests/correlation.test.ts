import { describe, expect, it } from "vitest";
import { correlatedJson, jsonError } from "@/lib/http";
import { correlationId } from "@/lib/logger";

describe("request correlation", () => {
  it("preserves a bounded safe request ID", () => {
    const request = new Request("https://raven.test/api/health", { headers: { "x-request-id": "edge-123.trace_4" } });
    expect(correlationId(request)).toBe("edge-123.trace_4");
  });

  it("replaces unsafe, secret-bearing, and oversized request IDs", () => {
    for (const supplied of ["contains spaces", "email@address.test", "a".repeat(65), "semi;colon"]) {
      const request = new Request("https://raven.test/api/health", { headers: { "x-request-id": supplied } });
      expect(correlationId(request)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("returns the same correlation ID in JSON and response headers", async () => {
    const response = correlatedJson({ data: { ok: true } }, "trace-123", { status: 201 });
    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("trace-123");
    expect(await response.json()).toEqual({ data: { ok: true }, correlationId: "trace-123" });
  });

  it("adds correlation to sanitized errors", async () => {
    const response = jsonError(new Error("sensitive database detail"), "trace-error");
    expect(response.headers.get("x-request-id")).toBe("trace-error");
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
      correlationId: "trace-error",
    });
  });
});
