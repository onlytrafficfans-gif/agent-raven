import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
});

async function signUp(page: Page, input: { email: string; password: string; workspace: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Raven Tenant Test");
  await page.getByLabel("Workspace name").fill(input.workspace);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password", { exact: true }).fill(input.password);
  await page.getByLabel("Confirm password").fill(input.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/overview$/);
}

async function importProspect(page: Page, name: string, domain: string) {
  await page.goto("/find-businesses");
  await page.getByLabel("Upload CSV").setInputFiles({
    name: "tenant-prospect.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`company_name,domain,website_url,industry,location,employee_count,estimated_revenue\n${name},${domain},https://${domain},Roofing,Las Vegas NV,18,900000\n`),
  });
  await expect(page.getByRole("status")).toContainText("1 created");
}

async function close(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}

test("separate organizations cannot read or mutate each other's prospects", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  const firstEmail = `e2e-tenant-a-${suffix}@example.com`;
  const secondEmail = `e2e-tenant-b-${suffix}@example.com`;
  const password = `Raven!Tenant-${randomUUID()}`;
  const firstName = `E2E Tenant A ${suffix}`;
  const secondName = `E2E Tenant B ${suffix}`;
  const sharedDomain = `tenant-${suffix}.example`;
  const baseURL = testInfo.project.use.baseURL as string;
  const contexts: BrowserContext[] = [];

  try {
    const firstContext = await browser.newContext({ baseURL, userAgent: `AgentRaven-E2E/1.0 tenant-a-${testInfo.project.name}` });
    contexts.push(firstContext);
    const firstPage = await firstContext.newPage();
    await signUp(firstPage, { email: firstEmail, password, workspace: `Tenant A ${suffix}` });
    await importProspect(firstPage, firstName, sharedDomain);

    const firstList = await firstPage.request.get(`/api/prospects?q=${encodeURIComponent(firstName)}`);
    expect(firstList.status()).toBe(200);
    const firstBody = await firstList.json();
    expect(firstBody.prospects).toHaveLength(1);
    const firstProspectId = firstBody.prospects[0].id as string;

    const secondContext = await browser.newContext({ baseURL, userAgent: `AgentRaven-E2E/1.0 tenant-b-${testInfo.project.name}` });
    contexts.push(secondContext);
    const secondPage = await secondContext.newPage();
    await signUp(secondPage, { email: secondEmail, password, workspace: `Tenant B ${suffix}` });

    const hiddenList = await secondPage.request.get(`/api/prospects?q=${encodeURIComponent(firstName)}`);
    expect(hiddenList.status()).toBe(200);
    await expect(hiddenList.json()).resolves.toMatchObject({ prospects: [] });

    const forbiddenMutation = await secondPage.request.patch(`/api/prospects/${firstProspectId}`, {
      data: { status: "QUALIFIED", note: "Cross-tenant mutation must never persist." },
    });
    expect(forbiddenMutation.status()).toBe(404);
    await expect(forbiddenMutation.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });

    await importProspect(secondPage, secondName, sharedDomain);
    const secondList = await secondPage.request.get(`/api/prospects?q=${encodeURIComponent(sharedDomain)}`);
    expect(secondList.status()).toBe(200);
    const secondBody = await secondList.json();
    expect(secondBody.prospects).toHaveLength(1);
    expect(secondBody.prospects[0]).toMatchObject({ name: secondName, normalizedDomain: sharedDomain });
    expect(secondBody.prospects[0].id).not.toBe(firstProspectId);

    const firstAfter = await firstPage.request.get(`/api/prospects?q=${encodeURIComponent(sharedDomain)}`);
    expect(firstAfter.status()).toBe(200);
    const firstAfterBody = await firstAfter.json();
    expect(firstAfterBody.prospects).toHaveLength(1);
    expect(firstAfterBody.prospects[0]).toMatchObject({ id: firstProspectId, name: firstName, status: "NEW" });
  } finally {
    await close(contexts);
    const users = await db.user.findMany({
      where: { email: { in: [firstEmail, secondEmail] } },
      include: { memberships: true },
    });
    const organizationIds = users.flatMap(({ memberships }) => memberships.map(({ organizationId }) => organizationId));
    if (organizationIds.length) await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    if (users.length) await db.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } });
  }
});
