import { expect, type APIResponse, test } from "@playwright/test";

async function expectUnauthenticated(response: APIResponse) {
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(response.headers()["x-request-id"]).toBe(body.correlationId);
  expect(body).toMatchObject({
    error: {
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    },
  });
}

test("unauthenticated users cannot access tenant pages or APIs", async ({ page, request }) => {
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/sign-in$/);

  await expectUnauthenticated(await request.get("/api/prospects"));
  await expectUnauthenticated(
    await request.post("/api/search", {
      data: { industry: "roofing", location: "Las Vegas", page: 1, perPage: 25 },
    }),
  );
  await expectUnauthenticated(
    await request.patch("/api/prospects/00000000-0000-0000-0000-000000000000", {
      data: { status: "QUALIFIED" },
    }),
  );
});

test("responses enforce the production browser security policy", async ({ request }) => {
  const response = await request.get("/sign-in");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-powered-by"]).toBeUndefined();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
  expect(response.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(response.headers()["cross-origin-resource-policy"]).toBe("same-origin");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
