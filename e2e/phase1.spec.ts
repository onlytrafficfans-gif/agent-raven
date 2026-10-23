import { test, expect, type Page } from "@playwright/test";

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

test.beforeEach(async ({ page }) => signIn(page));

test("real database-backed navigation shows the disconnected workspace", async ({ page }) => {
  await page.goto("/find-businesses");
  await expect(page.getByRole("heading", { name: "Find Businesses" })).toBeVisible();
  await expect(page.getByText("Apollo connection required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search businesses" })).toBeDisabled();
  await page.goto("/prospects");
  await expect(page.getByRole("heading", { name: "Prospects" })).toBeVisible();
});

test("CSV import persists a prospect and status update to PostgreSQL", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const name = `E2E Roofing ${suffix}`;
  const domain = `${suffix}.com`;
  await page.goto("/find-businesses");
  await page.getByLabel("Upload CSV").setInputFiles({
    name: "prospects.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`company_name,domain,website_url,industry,location,employee_count,estimated_revenue\n${name},${domain},https://${domain},Roofing,Las Vegas NV,24,1800000\n`),
  });
  await expect(page.getByRole("status")).toContainText("1 created");
  await page.goto("/prospects");
  await page.getByLabel("Search").fill(name);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.click();
  await page.getByLabel("Status", { exact: true }).last().selectOption("QUALIFIED");
  await page.getByLabel("Tags").fill("priority, roofing, vegas");
  await page.getByLabel("Add note").fill("Verified through the real persistence flow.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await page.getByLabel("Search").fill(name);
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("Qualified");
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("priority");
  await page.getByLabel("Search").fill("");
  await page.getByLabel("Source").selectOption("CSV import");
  await page.getByLabel("Industry").selectOption("Roofing");
  await page.getByLabel("Location").selectOption("Las Vegas NV");
  await page.getByLabel("Sort by").selectOption("name");
  await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
});
