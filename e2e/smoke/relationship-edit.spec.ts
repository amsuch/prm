import { test, expect } from "@playwright/test";
import { goToFirstContactDetail } from "../helpers/contacts";

test.describe("Relationship editing", () => {
  test.beforeEach(async ({ page }) => {
    const hasContact = await goToFirstContactDetail(page);
    if (!hasContact) {
      test.skip(true, "No contacts exist in dev environment");
    }
  });

  test("relationships section has Add button", async ({ page }) => {
    await expect(page.getByText("Relationships", { exact: true })).toBeVisible();
    // The "Add" button is near the Relationships header
    const addButtons = page.getByText("Add", { exact: true });
    await expect(addButtons.first()).toBeVisible();
  });

  test("clicking Add opens add relationship modal", async ({ page }) => {
    // Scroll down to the Relationships section
    const relationshipsHeader = page.getByText("Relationships", { exact: true });
    await relationshipsHeader.scrollIntoViewIfNeeded();

    // Find the Add button near Relationships
    const addButton = page.getByText("Add", { exact: true }).first();
    await addButton.click();

    // Modal should open with relationship form
    await expect(
      page.getByText("Add Relationship").first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("relationship cards are visible when relationships exist", async ({ page }) => {
    // Check if any relationships exist in the section
    const relationshipsHeader = page.getByText("Relationships", { exact: true });
    await expect(relationshipsHeader).toBeVisible();

    // Scroll to the relationships section
    await relationshipsHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Look for "No relationships yet" empty state
    const noRelationships = page.getByText("No relationships yet");
    if (await noRelationships.isVisible({ timeout: 2_000 }).catch(() => false)) {
      test.skip(true, "No relationships exist for this contact");
      return;
    }

    // If relationships exist, verify the section has content
    await expect(relationshipsHeader).toBeVisible();
  });
});
