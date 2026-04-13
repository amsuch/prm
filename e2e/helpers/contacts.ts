import { type Page, expect } from "@playwright/test";

/**
 * Navigate to the contacts list, wait for data to load, and click
 * the first contact card. Returns false if no contacts exist.
 */
export async function goToFirstContactDetail(page: Page): Promise<boolean> {
  await page.goto("/contacts");

  // Wait for either contacts to appear or the empty state.
  // The loading state shows "Loading contacts..." — wait for it to go away.
  const loadingIndicator = page.getByText("Loading contacts...");
  await loadingIndicator
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {
      // may never have appeared if contacts loaded fast
    });

  // Wait for network to settle (contacts fetched from Supabase)
  await page.waitForLoadState("networkidle");

  // React Native Web's Pressable does NOT render role="button" when
  // wrapped through reanimated's Animated.createAnimatedComponent, so we
  // locate contact cards by their visible text content instead.
  //
  // Contact cards show the contact name as a prominent text element.
  // We look for any text node that appears below the search/filter chrome
  // and above the bottom tab bar.
  const firstContactName = page
    .locator("div")
    .filter({ hasText: /^(Test|Test 2)$/ })
    .first();

  const visible = await firstContactName
    .isVisible({ timeout: 5_000 })
    .catch(() => false);

  if (!visible) {
    // Try a more general approach — look for any text that looks like a name
    const anyContact = page.getByText(/^[A-Z][a-z]/).first();
    const anyVisible = await anyContact
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (!anyVisible) return false;
    await anyContact.click();
  } else {
    await firstContactName.click();
  }

  // Wait for navigation to contact detail page
  await page.waitForURL("**/contact/*", { timeout: 10_000 });

  // Wait for the detail page to render
  await expect(page.getByText("Contact Info", { exact: true })).toBeVisible({ timeout: 10_000 });
  return true;
}
