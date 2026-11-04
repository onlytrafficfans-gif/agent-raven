import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { rateLimitPolicies } from "@/lib/rate-limit";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
});

async function signUp(page: Page, input: { email: string; password: string; workspace: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Raven Rate Limit Test");
  await page.getByLabel("Workspace name").fill(input.workspace);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password", { exact: true }).fill(input.password);
  await page.getByLabel("Confirm password").fill(input.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/overview$/);
}

test("prospect writes are persistently rate limited with a retry contract", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  const email = `e2e-rate-${suffix}@example.com`;
  const password = `Raven!Rate-${randomUUID()}`;
  let organizationId: string | undefined;

  try {
    await signUp(page, { email, password, workspace: `Rate Limit ${suffix}` });
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { memberships: true } });
    organizationId = user.memberships[0]?.organizationId;
    if (!organizationId) throw new Error("Rate-limit test user must belong to an organization.");

    const responses = [];
    for (let index = 0; index <= rateLimitPolicies.prospectCreate.limit; index++) {
      responses.push(await page.request.post("/api/prospects", {
        data: {
          providerName: "CSV import",
          providerOrganizationId: `rate-${suffix}-${index}`,
          name: `E2E Rate ${suffix} ${index}`,
          domain: `rate-${suffix}-${index}.example`,
          industry: "Roofing",
          location: "Las Vegas NV",
          retrievedAt: new Date().toISOString(),
          provenance: { source: "E2E persistent rate limit", index },
        },
      }));
    }

    expect(responses.filter((response) => response.status() === 201)).toHaveLength(rateLimitPolicies.prospectCreate.limit);
    const limited = responses.filter((response) => response.status() === 429);
    expect(limited).toHaveLength(1);
    const retryAfter = Number(limited[0].headers()["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    await expect(limited[0].json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED", retryAfter },
      correlationId: expect.any(String),
    });

    await expect(db.prospectCompany.count({ where: { organizationId, name: { startsWith: `E2E Rate ${suffix}` } } })).resolves.toBe(rateLimitPolicies.prospectCreate.limit);
    await expect(db.auditLog.count({ where: { organizationId, action: "PROSPECT_CREATED", targetType: "ProspectCompany" } })).resolves.toBe(rateLimitPolicies.prospectCreate.limit);
    await expect(db.apiRateLimitBucket.findFirstOrThrow({ where: { organizationId, bucketKey: { startsWith: "prospectCreate:" } } })).resolves.toMatchObject({ count: rateLimitPolicies.prospectCreate.limit + 1 });
  } finally {
    const user = await db.user.findUnique({ where: { email }, include: { memberships: true } });
    const organizationIds = user?.memberships.map(({ organizationId: id }) => id) ?? (organizationId ? [organizationId] : []);
    if (organizationIds.length) await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    if (user) await db.user.delete({ where: { id: user.id } });
  }
});
