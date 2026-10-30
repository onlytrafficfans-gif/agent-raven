import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const roles = ["OWNER", "ADMIN", "ANALYST", "VIEWER"] as const;
type Role = (typeof roles)[number];
type Actor = { role: Role; email: string; context: BrowserContext; page: Page };

test.afterAll(async () => {
  await db.$disconnect();
});

async function signUp(page: Page, input: { email: string; password: string; workspace: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Raven Role Test");
  await page.getByLabel("Workspace name").fill(input.workspace);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password", { exact: true }).fill(input.password);
  await page.getByLabel("Confirm password").fill(input.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/overview$/);
}

async function expectCode(response: Awaited<ReturnType<Page["request"]["get"]>>, status: number, code: string) {
  expect(response.status()).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error: { code } });
}

test("Owner, Admin, Analyst, and Viewer permissions are enforced at API boundaries", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  const password = `Raven!Roles-${randomUUID()}`;
  const baseURL = testInfo.project.use.baseURL as string;
  const actors: Actor[] = [];
  let sharedOrganizationId: string | undefined;

  try {
    for (const role of roles) {
      const email = `e2e-role-${role.toLowerCase()}-${suffix}@example.com`;
      const context = await browser.newContext({
        baseURL,
        userAgent: `AgentRaven-E2E/1.0 role-${role.toLowerCase()}-${testInfo.project.name}`,
        extraHTTPHeaders: { "x-request-id": `e2e-role-${role.toLowerCase()}` },
      });
      const page = await context.newPage();
      actors.push({ role, email, context, page });
      await signUp(page, { email, password, workspace: `Role ${role} ${suffix}` });

      const user = await db.user.findUniqueOrThrow({ where: { email }, include: { memberships: true } });
      const membership = user.memberships[0];
      if (!membership) throw new Error(`Membership was not provisioned for ${role}.`);
      if (!sharedOrganizationId) sharedOrganizationId = membership.organizationId;
      await db.membership.update({
        where: { userId: user.id },
        data: { organizationId: sharedOrganizationId, role },
      });
      if (membership.organizationId !== sharedOrganizationId) {
        await db.organization.delete({ where: { id: membership.organizationId } });
      }
    }

    for (const actor of actors) {
      const response = await actor.page.request.delete("/api/integrations/apollo");
      if (actor.role === "OWNER" || actor.role === "ADMIN") {
        expect(response.status()).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ state: "DISCONNECTED" });
      } else {
        await expectCode(response, 403, "FORBIDDEN");
      }
    }

    for (const actor of actors) {
      const search = await actor.page.request.post("/api/search", {
        data: { industry: "roofing", location: "Las Vegas", page: 1, perPage: 25 },
      });
      const detail = await actor.page.request.get("/api/companies/not-a-live-provider-id");
      if (actor.role === "VIEWER") {
        await expectCode(search, 403, "FORBIDDEN");
        await expectCode(detail, 403, "FORBIDDEN");
      } else {
        await expectCode(search, 401, "INVALID_CREDENTIAL");
        await expectCode(detail, 409, "DISCONNECTED");
      }
    }

    const created = new Map<Role, string>();
    for (const actor of actors) {
      const response = await actor.page.request.post("/api/prospects", {
        data: {
          providerName: "CSV import",
          name: `E2E Role ${actor.role} ${suffix}`,
          domain: `role-${actor.role.toLowerCase()}-${suffix}.example`,
          industry: "Roofing",
          location: "Las Vegas NV",
          retrievedAt: new Date().toISOString(),
          provenance: { source: "E2E permission matrix" },
        },
      });
      if (actor.role === "VIEWER") {
        await expectCode(response, 403, "FORBIDDEN");
      } else {
        expect(response.status()).toBe(201);
        const body = await response.json();
        created.set(actor.role, body.prospect.id as string);
      }
    }

    for (const actor of actors) {
      const response = await actor.page.request.get(`/api/prospects?q=${encodeURIComponent("E2E Role")}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.prospects).toHaveLength(3);
    }

    for (const actor of actors.filter(({ role }) => role !== "VIEWER")) {
      const response = await actor.page.request.patch(`/api/prospects/${created.get(actor.role)}`, {
        data: { status: "QUALIFIED" },
      });
      expect(response.status()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ prospect: { status: "QUALIFIED" } });
    }
    await expectCode(
      await actors.find(({ role }) => role === "VIEWER")!.page.request.patch(`/api/prospects/${created.get("OWNER")}`, {
        data: { status: "REJECTED" },
      }),
      403,
      "FORBIDDEN",
    );

    const persisted = await db.prospectCompany.findMany({
      where: { organizationId: sharedOrganizationId, name: { startsWith: "E2E Role " } },
    });
    expect(persisted).toHaveLength(3);
    expect(persisted.every(({ status }) => status === "QUALIFIED")).toBe(true);
  } finally {
    await Promise.all(actors.map(({ context }) => context.close()));
    const emails = actors.map(({ email }) => email);
    const users = emails.length
      ? await db.user.findMany({ where: { email: { in: emails } }, include: { memberships: true } })
      : [];
    const organizationIds = [...new Set(users.flatMap(({ memberships }) => memberships.map(({ organizationId }) => organizationId)))];
    if (organizationIds.length) await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    if (users.length) await db.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } });
  }
});
