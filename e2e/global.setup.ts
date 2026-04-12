import { test as setup, expect } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/sign-in");

  // Wait for the sign-in page to load
  await page.waitForLoadState("networkidle");

  // Click the Dev Quick Sign In button (only visible in __DEV__ mode)
  const devButton = page.getByText("Dev Quick Sign In");
  await expect(devButton).toBeVisible({ timeout: 15_000 });
  await devButton.click();

  // Wait for redirect to authenticated area
  await page.waitForURL("**/", { timeout: 15_000 });

  // Verify we're authenticated by checking for a tab label
  await expect(
    page.getByText("Home").or(page.getByText("People")),
  ).toBeVisible({ timeout: 10_000 });

  // Save the authenticated state
  await page.context().storageState({ path: "./e2e/.auth/user.json" });
});
