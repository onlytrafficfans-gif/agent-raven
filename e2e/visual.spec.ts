import { test,expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function signIn(page: import("@playwright/test").Page){
  const email=process.env.SEED_OWNER_EMAIL,password=process.env.SEED_OWNER_PASSWORD;
  if(!email||!password)throw new Error("Seeded owner credentials are required for E2E testing.");
  await page.goto("/sign-in");await page.getByLabel("Email").fill(email);await page.getByLabel("Password").fill(password);await page.getByRole("button",{name:"Sign in"}).click();await expect(page).toHaveURL(/\/overview$/);
}

test("capture verified Phase 1 screens",async({page},testInfo)=>{
  await signIn(page);
  await mkdir("docs/screenshots",{recursive:true});
  for(const route of ["overview","find-businesses","prospects"]){
    await page.goto(`/${route}`);await expect(page.getByRole("heading",{level:1})).toBeVisible();
    await page.screenshot({path:`docs/screenshots/${route}-${testInfo.project.name}.png`,fullPage:true});
  }
  await page.goto("/overview");
  await page.getByRole("button",{name:"Switch to light mode"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await page.screenshot({path:`docs/screenshots/overview-light-${testInfo.project.name}.png`,fullPage:true});
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
});
