import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
});

test("signup provisions a real workspace, password reset works, and remember me controls persistence", async ({ page, context, request }, testInfo) => {
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  const email = `e2e-auth-${suffix}@example.com`;
  const originalPassword = `Raven!Original-${randomUUID()}`;
  const newPassword = `Raven!Updated-${randomUUID()}`;
  const workspaceName = `E2E Raven ${suffix}`;
  let organizationIds: string[] = [];

  try {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Remember me on this device")).toBeChecked();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/sign-up$/);

    await page.getByLabel("Your name").fill("Raven Auth Test");
    await page.getByLabel("Workspace name").fill(workspaceName);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(originalPassword);
    await page.getByLabel("Confirm password").fill(originalPassword);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByText(workspaceName).filter({ visible: true }).first()).toBeVisible();

    const createdUser = await db.user.findUnique({
      where: { email },
      include: { memberships: { include: { organization: { include: { integrations: true } } } } },
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser?.memberships).toHaveLength(1);
    expect(createdUser?.memberships[0]?.role).toBe("OWNER");
    expect(createdUser?.memberships[0]?.organization.integrations[0]?.provider).toBe("APOLLO");
    expect(createdUser?.memberships[0]?.organization.integrations[0]?.state).toBe("DISCONNECTED");
    organizationIds = createdUser?.memberships.map(({ organizationId }) => organizationId) ?? [];

    const token = randomUUID().replaceAll("-", "");
    await db.verification.create({
      data: { identifier: `reset-password:${token}`, value: createdUser!.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await page.goto(`/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent("/reset-password")}`);
    await expect(page).toHaveURL(/\/reset-password\?token=/);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("status")).toContainText("existing sessions were signed out");
    const replay = await request.post("/api/auth/reset-password", { data: { newPassword: `${newPassword}-replay`, token } });
    expect(replay.status()).toBe(400);

    await page.goto("/overview");
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByLabel("Remember me on this device").uncheck();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/overview$/);

    const sessionCookie = (await context.cookies()).find(({ name }) => name.includes("session_token"));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.expires).toBeLessThanOrEqual(0);

    if (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM) {
      await page.goto("/forgot-password");
      await page.getByLabel("Account email").fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.locator(".form-error")).toContainText("not configured");
    }
  } finally {
    const user = await db.user.findUnique({ where: { email }, include: { memberships: true } });
    const ids = user?.memberships.map(({ organizationId }) => organizationId) ?? organizationIds;
    if (user) await db.user.delete({ where: { id: user.id } });
    if (ids.length) await db.organization.deleteMany({ where: { id: { in: ids } } });
  }
});
