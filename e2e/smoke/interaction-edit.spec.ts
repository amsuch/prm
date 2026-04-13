import { test, expect } from "@playwright/test";
import { goToFirstContactDetail } from "../helpers/contacts";

test.describe("Interaction modals", () => {
  test.beforeEach(async ({ page }) => {
    const hasContact = await goToFirstContactDetail(page);
    if (!hasContact) {
      test.skip(true, "No contacts exist in dev environment");
    }
  });

  test("Log Interaction modal has date/time picker", async ({ page }) => {
    // Open the Log Interaction modal
    await page.getByText("Log Interaction", { exact: true }).click();

    // Modal should show form fields
    await expect(page.getByText("Type", { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Direction", { exact: true })).toBeVisible();
    await expect(page.getByText("Date & Time", { exact: true })).toBeVisible();

    // On web, the date picker is a native <input type="datetime-local">
    const dateInput = page.locator('input[type="datetime-local"]');
    await expect(dateInput).toBeVisible();

    // Verify the date input has a value (defaults to now)
    const value = await dateInput.inputValue();
    expect(value).toBeTruthy();
  });

  test("can change date in Log Interaction modal", async ({ page }) => {
    await page.getByText("Log Interaction", { exact: true }).click();
    await expect(page.getByText("Date & Time", { exact: true })).toBeVisible({ timeout: 5_000 });

    // Set a specific date/time
    const dateInput = page.locator('input[type="datetime-local"]');
    await dateInput.fill("2026-01-15T14:30");

    const value = await dateInput.inputValue();
    expect(value).toBe("2026-01-15T14:30");
  });

  test("clicking an interaction opens edit modal", async ({ page }) => {
    // Check if any interactions exist in the Activity section
    const activitySection = page.getByText("Activity", { exact: true });
    await expect(activitySection).toBeVisible();

    // No interactions exist for this test contact ("Test" has no interactions)
    // So we check for the empty state
    const noInteractions = page.getByText("No interactions yet");
    if (await noInteractions.isVisible({ timeout: 2_000 }).catch(() => false)) {
      test.skip(true, "No interactions exist for this contact");
      return;
    }

    // If interactions exist, they're rendered as div elements (not role="button")
    // because React Native Web's Pressable wrapped in reanimated doesn't add role.
    // Look for interaction type text within the Activity section area
    const interactionTypes = ["Meeting", "Call", "Email", "Note", "Message"];
    let foundInteraction = false;

    for (const type of interactionTypes) {
      const item = page.getByText(type, { exact: true }).first();
      if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
        await item.click();
        foundInteraction = true;
        break;
      }
    }

    if (!foundInteraction) {
      test.skip(true, "No interactions found for this contact");
      return;
    }

    // Edit Interaction modal should open
    await expect(page.getByText("Edit Interaction")).toBeVisible({
      timeout: 5_000,
    });

    // Should have the same fields as log modal plus save button
    await expect(page.getByText("Type", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Date & Time", { exact: true })).toBeVisible();
    await expect(page.getByText("Save Changes", { exact: true })).toBeVisible();
  });
});
