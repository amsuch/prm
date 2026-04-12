import { test, expect } from "@playwright/test";

test.describe("Contacts list", () => {
  test("loads contacts tab", async ({ page }) => {
    await page.goto("/");

    // Navigate to People tab
    await page.getByText("People").click();

    // Should show the search bar or empty state
    await expect(
      page
        .getByPlaceholder(/search/i)
        .or(page.getByText("No contacts")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("can navigate to a contact detail page", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");

    // Wait for contacts to load — if none exist, skip
    const contactCard = page.locator("[role='button']").first();
    if (!(await contactCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No contacts exist in dev environment");
      return;
    }

    await contactCard.click();
    await page.waitForURL("**/contact/*");

    // Should show contact detail sections
    await expect(page.getByText("Contact Info")).toBeVisible({ timeout: 10_000 });
  });
});
