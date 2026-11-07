import { describe, expect, it, vi } from "vitest";
import { verifyDeployment } from "@/lib/deployment-verifier";

function operationalResponses() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const requestId = new Headers(init?.headers).get("x-request-id") ?? "";
    if (url.endsWith("/api/health/live")) {
      return json(
        { status: "operational", application: "operational", timestamp: new Date().toISOString(), correlationId: requestId },
        { "cache-control": "no-store", "x-health-status": "operational", "x-request-id": requestId },
      );
    }
    if (url.endsWith("/api/health")) {
      return json(
        {
          status: "operational",
          application: "operational",
          database: "operational",
          databaseLatencyMs: 4,
          databaseLatencyWarningMs: 250,
          apollo: "credential status available only to authenticated organization members",
          timestamp: new Date().toISOString(),
          correlationId: requestId,
        },
        {
          "cache-control": "no-store",
          "server-timing": "database;dur=4",
          "x-health-status": "operational",
          "x-request-id": requestId,
        },
      );
    }
    return new Response("<!doctype html>", {
      status: 200,
      headers: {
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), microphone=()",
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-resource-policy": "same-origin",
      },
    });
  });
}

function json(body: object, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });
}

describe("production deployment verification", () => {
  it("verifies dependency health and browser security without retaining response content", async () => {
    const result = await verifyDeployment("https://raven.example", { fetcher: operationalResponses() });
    expect(result).toEqual({
      valid: true,
      origin: "https://raven.example",
      checks: { liveness: true, readiness: true, signIn: true },
      errors: [],
      observed: { databaseLatencyMs: 4, databaseLatencyWarningMs: 250, securityHeaders: true },
    });
  });

  it.each([
    "http://raven.example",
    "https://user:password@raven.example",
    "https://raven.example/sign-in",
    "https://raven.example?preview=true",
  ])("rejects unsafe or non-canonical deployment URL %s", async (url) => {
    const fetcher = operationalResponses();
    const result = await verifyDeployment(url, { fetcher });
    expect(result.valid).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("allows HTTP only for an explicitly enabled loopback verification", async () => {
    const result = await verifyDeployment("http://127.0.0.1:3200", {
      fetcher: operationalResponses(),
      allowInsecureLoopback: true,
    });
    expect(result.valid).toBe(true);
  });

  it("fails closed when a deployment probe cannot be reached", async () => {
    const fetcher = operationalResponses();
    fetcher.mockImplementationOnce(async () => {
      throw new Error("unreachable");
    });
    const result = await verifyDeployment("https://raven.example", { fetcher });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Liveness request failed.");
  });

  it("fails when the deployed sign-in response is missing a required security header", async () => {
    const base = operationalResponses();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const response = await base(input, init);
      if (!String(input).endsWith("/sign-in")) return response;
      const headers = new Headers(response.headers);
      headers.delete("x-frame-options");
      return new Response(await response.text(), { status: response.status, headers });
    });
    const result = await verifyDeployment("https://raven.example", { fetcher });
    expect(result.valid).toBe(false);
    expect(result.checks.signIn).toBe(false);
    expect(result.errors).toContain("Sign-in page failed the direct-response security contract.");
  });
});
