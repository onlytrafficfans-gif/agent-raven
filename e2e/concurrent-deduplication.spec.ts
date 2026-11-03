import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const concurrentRequests = 12;

test.afterAll(async () => {
  await db.$disconnect();
});

async function signIn(page: Page) {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password) throw new Error("Seeded owner credentials are required for E2E testing.");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/overview$/);
}

test("concurrent identical prospect saves create one record and one audit event", async ({ page }, testInfo) => {
  const email = process.env.SEED_OWNER_EMAIL!;
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  const name = `E2E Concurrent ${suffix}`;
  const domain = `concurrent-${suffix}.example`;
  const providerOrganizationId = `e2e-concurrent-${suffix}`;
  let prospectId: string | undefined;

  await signIn(page);
  const owner = await db.user.findUniqueOrThrow({ where: { email }, include: { memberships: true } });
  const organizationId = owner.memberships[0]?.organizationId;
  if (!organizationId) throw new Error("Seeded owner must belong to an organization.");

  const payload = {
    providerName: "CSV import",
    providerOrganizationId,
    name,
    domain,
    websiteUrl: `https://${domain}`,
    industry: "Roofing",
    location: "Las Vegas NV",
    retrievedAt: new Date().toISOString(),
    provenance: { source: "E2E concurrent deduplication", requestCount: concurrentRequests },
  };

  try {
    const firstWave = await Promise.all(
      Array.from({ length: concurrentRequests }, () => page.request.post("/api/prospects", { data: payload })),
    );
    expect(firstWave.every((response) => [200, 201].includes(response.status()))).toBe(true);

    const firstBodies = await Promise.all(firstWave.map((response) => response.json()));
    expect(firstBodies.filter(({ created }) => created === true)).toHaveLength(1);
    expect(firstBodies.filter(({ created }) => created === false)).toHaveLength(concurrentRequests - 1);
    expect(new Set(firstBodies.map(({ prospect }) => prospect.id)).size).toBe(1);
    prospectId = firstBodies[0].prospect.id as string;

    const replayWave = await Promise.all(
      Array.from({ length: concurrentRequests }, () => page.request.post("/api/prospects", { data: payload })),
    );
    expect(replayWave.every((response) => response.status() === 200)).toBe(true);
    const replayBodies = await Promise.all(replayWave.map((response) => response.json()));
    expect(replayBodies.every(({ created, prospect }) => created === false && prospect.id === prospectId)).toBe(true);

    await expect(
      db.prospectCompany.count({ where: { organizationId, normalizedDomain: domain } }),
    ).resolves.toBe(1);
    await expect(
      db.auditLog.count({
        where: { organizationId, prospectId, action: "PROSPECT_CREATED", targetId: prospectId },
      }),
    ).resolves.toBe(1);
  } finally {
    if (prospectId) {
      await db.auditLog.deleteMany({ where: { organizationId, OR: [{ prospectId }, { targetId: prospectId }] } });
      await db.prospectCompany.deleteMany({ where: { organizationId, id: prospectId } });
    } else {
      const prospects = await db.prospectCompany.findMany({
        where: { organizationId, normalizedDomain: domain },
        select: { id: true },
      });
      const ids = prospects.map(({ id }) => id);
      await db.auditLog.deleteMany({ where: { organizationId, OR: [{ prospectId: { in: ids } }, { targetId: { in: ids } }] } });
      await db.prospectCompany.deleteMany({ where: { organizationId, id: { in: ids } } });
    }
  }
});
