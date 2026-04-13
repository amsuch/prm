import { test, expect } from "@playwright/test";
import { goToFirstContactDetail } from "../helpers/contacts";

test.describe("Contact detail page", () => {
  test.beforeEach(async ({ page }) => {
    const hasContact = await goToFirstContactDetail(page);
    if (!hasContact) {
      test.skip(true, "No contacts exist in dev environment");
    }
  });

  test("shows stats bar", async ({ page }) => {
    await expect(page.getByText("Last Contacted")).toBeVisible();
    await expect(page.getByText("Interactions", { exact: true })).toBeVisible();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  });

  test("shows contact info section", async ({ page }) => {
    await expect(page.getByText("Contact Info", { exact: true })).toBeVisible();
  });

  test("shows enrichment fields when present", async ({ page }) => {
    // The "Details" section only renders if enrichment data exists
    const detailsHeader = page.getByText("Details", { exact: true });
    if (await detailsHeader.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // At least one enrichment field should be visible
      await expect(
        page
          .getByText("Location", { exact: true })
          .or(page.getByText("Education", { exact: true }))
          .or(page.getByText("Previous Companies", { exact: true })),
      ).toBeVisible();
    }
  });

  test("shows bottom action bar with Edit and Log Interaction", async ({ page }) => {
    await expect(page.getByText("Edit", { exact: true })).toBeVisible();
    await expect(page.getByText("Log Interaction", { exact: true })).toBeVisible();
  });

  test("shows Activity and Relationships sections", async ({ page }) => {
    await expect(page.getByText("Activity", { exact: true })).toBeVisible();
    await expect(page.getByText("Relationships", { exact: true })).toBeVisible();
  });
});
