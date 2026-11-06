import { expect, test } from "@playwright/test";

test("liveness and database readiness expose only sanitized operational evidence", async ({ request }) => {
  const liveness = await request.get("/api/health/live", { headers: { "x-request-id": "e2e-health-live" } });
  expect(liveness.status()).toBe(200);
  expect(liveness.headers()["cache-control"]).toContain("no-store");
  expect(liveness.headers()["x-health-status"]).toBe("operational");
  expect(liveness.headers()["x-request-id"]).toBe("e2e-health-live");
  await expect(liveness.json()).resolves.toMatchObject({
    status: "operational",
    application: "operational",
    correlationId: "e2e-health-live",
  });

  const readiness = await request.get("/api/health", { headers: { "x-request-id": "e2e-health-ready" } });
  expect(readiness.status()).toBe(200);
  expect(readiness.headers()["cache-control"]).toContain("no-store");
  expect(readiness.headers()["x-health-status"]).toBe("operational");
  expect(readiness.headers()["x-request-id"]).toBe("e2e-health-ready");
  expect(readiness.headers()["server-timing"]).toMatch(/^database;dur=\d+$/);
  const body = await readiness.json();
  expect(body).toMatchObject({
    status: "operational",
    application: "operational",
    database: "operational",
    databaseLatencyMs: expect.any(Number),
    databaseLatencyWarningMs: 250,
    apollo: "credential status available only to authenticated organization members",
    correlationId: "e2e-health-ready",
  });
  expect(body.databaseLatencyMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(body)).not.toMatch(/password|secret|token|credential.*value/i);
});
