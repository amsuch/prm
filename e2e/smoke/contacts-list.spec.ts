import { test, expect } from "@playwright/test";
import { goToFirstContactDetail } from "../helpers/contacts";

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
    const hasContact = await goToFirstContactDetail(page);
    if (!hasContact) {
      test.skip(true, "No contacts exist in dev environment");
      return;
    }

    // goToFirstContactDetail already verifies Contact Info is visible
    await expect(page.getByText("Contact Info", { exact: true })).toBeVisible();
  });
});
