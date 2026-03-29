/**
 * Multi-strategy photo search for contacts.
 *
 * Tries several approaches in order:
 *   1. LinkedIn og:image extraction (if LinkedIn URL provided)
 *   2. Clearbit Logo API (if company provided) - free, no API key
 *   3. UI Avatars fallback - always works, generates avatar from initials
 *
 * Every step is logged with [PhotoSearch] prefix for easy console filtering.
 */

import { fetchLinkedInPhoto } from "@/lib/linkedin";

const TAG = "[PhotoSearch]";

/**
 * Attempt to find or generate a photo URL for a contact.
 *
 * @param name     - Full display name (e.g. "Jane Smith")
 * @param company  - Company name, used for Clearbit logo lookup
 * @param linkedinUrl - LinkedIn profile URL for og:image extraction
 * @returns A usable image URL, or null if all strategies fail
 */
export async function fetchContactPhoto(
  name: string,
  company?: string | null,
  linkedinUrl?: string | null,
): Promise<string | null> {
  console.log(TAG, "Starting photo search for:", name);
  console.log(TAG, "  company:", company ?? "(none)");
  console.log(TAG, "  linkedinUrl:", linkedinUrl ?? "(none)");

  // ── Strategy 1: LinkedIn og:image ──────────────────────────────
  if (linkedinUrl) {
    console.log(TAG, "Strategy 1: LinkedIn og:image");
    try {
      const url = await fetchLinkedInPhoto(linkedinUrl);
      if (url) {
        console.log(TAG, "Strategy 1 SUCCESS - found image:", url);
        return url;
      }
      console.log(TAG, "Strategy 1 returned null (no image found)");
    } catch (err) {
      console.log(TAG, "Strategy 1 ERROR:", err);
    }
  } else {
    console.log(TAG, "Strategy 1: SKIPPED (no LinkedIn URL)");
  }

  // ── Strategy 2: Clearbit Logo API ──────────────────────────────
  if (company) {
    console.log(TAG, "Strategy 2: Clearbit Logo API");
    try {
      // Derive a plausible domain from the company name
      const domain = companyToDomain(company);
      const clearbitUrl = `https://logo.clearbit.com/${domain}`;
      console.log(TAG, "  Trying Clearbit URL:", clearbitUrl);

      const response = await fetch(clearbitUrl, { method: "HEAD" });
      console.log(TAG, "  Clearbit response status:", response.status);

      if (response.ok) {
        console.log(TAG, "Strategy 2 SUCCESS - company logo:", clearbitUrl);
        return clearbitUrl;
      }
      console.log(TAG, "Strategy 2 returned non-OK status");
    } catch (err) {
      console.log(TAG, "Strategy 2 ERROR:", err);
    }
  } else {
    console.log(TAG, "Strategy 2: SKIPPED (no company)");
  }

  // ── Strategy 3: UI Avatars (generated fallback) ────────────────
  console.log(TAG, "Strategy 3: UI Avatars (generated fallback)");
  try {
    const encoded = encodeURIComponent(name.trim());
    const avatarUrl = `https://ui-avatars.com/api/?name=${encoded}&background=random&size=200`;
    console.log(TAG, "  UI Avatars URL:", avatarUrl);

    const response = await fetch(avatarUrl, { method: "HEAD" });
    console.log(TAG, "  UI Avatars response status:", response.status);

    if (response.ok) {
      console.log(TAG, "Strategy 3 SUCCESS - generated avatar:", avatarUrl);
      return avatarUrl;
    }
    console.log(TAG, "Strategy 3 returned non-OK status");
  } catch (err) {
    console.log(TAG, "Strategy 3 ERROR:", err);
  }

  console.log(TAG, "All strategies exhausted - returning null");
  return null;
}

/**
 * Best-effort conversion of a company name to a domain.
 *
 * Examples:
 *   "Google"       -> "google.com"
 *   "McKinsey & Company" -> "mckinsey.com"
 *   "Foo Bar Inc." -> "foobar.com"
 */
function companyToDomain(company: string): string {
  const cleaned = company
    .toLowerCase()
    .replace(/[&+]/g, "")
    .replace(
      /\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|company|group|holdings|partners|plc)\b/gi,
      "",
    )
    .replace(/[^a-z0-9]/g, "")
    .trim();

  return `${cleaned}.com`;
}
