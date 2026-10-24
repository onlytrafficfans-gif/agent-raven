import { expect, test, type Page } from "@playwright/test";

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

test("authentication controls recover when the server request fails", async ({ page }) => {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password) throw new Error("Seeded owner credentials are required for E2E testing.");
  await page.goto("/sign-in");
  await page.route("**/api/auth/sign-in/email", route => route.abort("failed"));
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".form-error")).toContainText("could not reach the server");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("Apollo connect recovers instead of leaving its button stuck", async ({ page }) => {
  await signIn(page);
  await page.goto("/integrations");
  await page.route("**/api/integrations/apollo", route => route.abort("failed"));
  await page.getByLabel("Apollo API key").fill("test-key-not-sent");
  await page.getByRole("button", { name: "Test and connect" }).click();
  await expect(page.getByRole("status")).toContainText("could not reach the server");
  await expect(page.getByRole("button", { name: "Test and connect" })).toBeEnabled();
});

test("CSV import and prospect save recover from interrupted requests", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/find-businesses");
  await page.route("**/api/import/csv", route => route.abort("failed"));
  await page.getByLabel("Upload CSV").setInputFiles({
    name: "prospects.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("company_name,domain\nInterrupted Import,interrupted.example\n"),
  });
  await expect(page.getByRole("status")).toContainText("CSV was not imported");
  await expect(page.locator('label[for="csv"]')).toHaveText("Upload CSV");
  await page.unroute("**/api/import/csv");

  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const name = `E2E Roofing resilience ${suffix}`;
  await page.getByLabel("Upload CSV").setInputFiles({
    name: "prospects.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`company_name,domain,industry,location\n${name},${suffix}.com,Roofing,Las Vegas NV\n`),
  });
  await expect(page.getByRole("status")).toContainText("1 created");
  await page.goto("/prospects");
  await page.getByLabel("Search").fill(name);
  await page.getByRole("row").filter({ hasText: name }).click();
  await page.route("**/api/prospects/*", route => route.abort("failed"));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("changes were not saved");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
});
