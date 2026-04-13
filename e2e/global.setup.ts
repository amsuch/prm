import { test as setup, expect } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  // Listen for console errors to help debug network issues
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[browser error] ${msg.text()}`);
    }
  });

  await page.goto("/sign-in");

  // Wait for the sign-in page to load
  await page.waitForLoadState("networkidle");

  // Click the Dev Quick Sign In button (only visible in __DEV__ mode)
  const devButton = page.getByText("Dev Quick Sign In");
  await expect(devButton).toBeVisible({ timeout: 15_000 });
  await devButton.click();

  // Wait for either redirect or error
  // The sign-in may take a moment to process the API call
  await page.waitForTimeout(3_000);

  // Check if sign-in succeeded (redirected) or failed (still on sign-in page)
  const currentUrl = page.url();
  if (currentUrl.includes("sign-in")) {
    // Still on sign-in page — check for error
    const errorText = page.locator("text=Failed");
    if (await errorText.isVisible()) {
      const msg = await errorText.textContent();
      throw new Error(`Sign-in failed: ${msg}. The browser may not be able to reach the Supabase API through the network proxy.`);
    }
  }

  // Wait for redirect to authenticated area
  await page.waitForURL("**/", { timeout: 20_000 });

  // Verify we're authenticated by checking for a tab
  await expect(
    page.getByRole("heading", { name: "Home" }),
  ).toBeVisible({ timeout: 10_000 });

  // Save the authenticated state
  await page.context().storageState({ path: "./e2e/.auth/user.json" });
});
