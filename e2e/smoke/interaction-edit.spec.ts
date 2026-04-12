import { test, expect } from "@playwright/test";

test.describe("Interaction modals", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");

    const contactCard = page.locator("[role='button']").first();
    if (!(await contactCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "No contacts exist in dev environment");
      return;
    }
    await contactCard.click();
    await page.waitForURL("**/contact/*");
  });

  test("Log Interaction modal has date/time picker", async ({ page }) => {
    // Open the Log Interaction modal
    await page.getByText("Log Interaction").click();

    // Modal should show form fields
    await expect(page.getByText("Type")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Direction")).toBeVisible();
    await expect(page.getByText("Date & Time")).toBeVisible();

    // On web, the date picker is a native <input type="datetime-local">
    const dateInput = page.locator('input[type="datetime-local"]');
    await expect(dateInput).toBeVisible();

    // Verify the date input has a value (defaults to now)
    const value = await dateInput.inputValue();
    expect(value).toBeTruthy();
  });

  test("can change date in Log Interaction modal", async ({ page }) => {
    await page.getByText("Log Interaction").click();
    await expect(page.getByText("Date & Time")).toBeVisible({ timeout: 5_000 });

    // Set a specific date/time
    const dateInput = page.locator('input[type="datetime-local"]');
    await dateInput.fill("2026-01-15T14:30");

    const value = await dateInput.inputValue();
    expect(value).toBe("2026-01-15T14:30");
  });

  test("clicking an interaction opens edit modal", async ({ page }) => {
    // Check if any interactions exist in the Activity section
    const activitySection = page.getByText("Activity");
    await expect(activitySection).toBeVisible();

    // Look for interaction items (they have chevron-forward icons now)
    // Interactions are inside the activity timeline
    const interactionItems = page.locator(
      "[role='button']:below(:text('Activity')):above(:text('Notes'))",
    );

    const firstInteraction = interactionItems.first();
    if (
      !(await firstInteraction.isVisible({ timeout: 3_000 }).catch(() => false))
    ) {
      test.skip(true, "No interactions exist for this contact");
      return;
    }

    await firstInteraction.click();

    // Edit Interaction modal should open
    await expect(page.getByText("Edit Interaction")).toBeVisible({
      timeout: 5_000,
    });

    // Should have the same fields as log modal plus a delete button
    await expect(page.getByText("Type")).toBeVisible();
    await expect(page.getByText("Date & Time")).toBeVisible();
    await expect(page.getByText("Save Changes")).toBeVisible();
  });
});
