import { test, expect } from "@playwright/test";

test.describe("Contact detail page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");

    // Click first contact card
    const contactCard = page.locator("[role='button']").first();
    if (!(await contactCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No contacts exist in dev environment");
      return;
    }
    await contactCard.click();
    await page.waitForURL("**/contact/*");
  });

  test("shows stats bar", async ({ page }) => {
    await expect(page.getByText("Last Contacted")).toBeVisible();
    await expect(page.getByText("Interactions")).toBeVisible();
    await expect(page.getByText("Connected")).toBeVisible();
  });

  test("shows contact info section", async ({ page }) => {
    await expect(page.getByText("Contact Info")).toBeVisible();
  });

  test("shows enrichment fields when present", async ({ page }) => {
    // The "Details" section only renders if enrichment data exists
    const detailsHeader = page.getByText("Details", { exact: true });
    if (await detailsHeader.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // At least one enrichment field should be visible
      await expect(
        page
          .getByText("Location")
          .or(page.getByText("Education"))
          .or(page.getByText("Previous Companies")),
      ).toBeVisible();
    }
  });

  test("shows bottom action bar with Edit and Log Interaction", async ({ page }) => {
    await expect(page.getByText("Edit")).toBeVisible();
    await expect(page.getByText("Log Interaction")).toBeVisible();
  });

  test("shows Activity and Relationships sections", async ({ page }) => {
    await expect(page.getByText("Activity")).toBeVisible();
    await expect(page.getByText("Relationships")).toBeVisible();
  });
});
