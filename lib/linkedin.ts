/**
 * LinkedIn photo extraction.
 *
 * Fetches the og:image from a LinkedIn profile page to use as an avatar.
 * This may fail due to CORS on web -- handled gracefully by returning null.
 */

const TAG = "[PhotoSearch:LinkedIn]";

/**
 * Check whether a URL is a LinkedIn profile URL.
 */
export function isLinkedInUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.includes("linkedin.com/in/") ||
    trimmed.includes("linkedin.com/pub/")
  );
}

/**
 * Fetch the og:image meta tag from a LinkedIn profile page.
 *
 * LinkedIn profile pages include the profile photo as the og:image meta tag.
 * This may fail due to CORS restrictions on web or if LinkedIn blocks the request.
 *
 * @returns The image URL or null if extraction fails.
 */
export async function fetchLinkedInPhoto(
  linkedinUrl: string,
): Promise<string | null> {
  console.log(TAG, "fetchLinkedInPhoto called with:", linkedinUrl);

  if (!isLinkedInUrl(linkedinUrl)) {
    console.log(TAG, "URL is not a LinkedIn profile URL, returning null");
    return null;
  }

  try {
    console.log(TAG, "Fetching LinkedIn page...");
    const response = await fetch(linkedinUrl, {
      headers: {
        // Use a standard user-agent to avoid being blocked
        "User-Agent":
          "Mozilla/5.0 (compatible; PRM/1.0)",
      },
    });

    console.log(TAG, "Response status:", response.status, response.statusText);

    if (!response.ok) {
      console.log(TAG, "Response not OK, returning null");
      return null;
    }

    const html = await response.text();
    console.log(TAG, "HTML length:", html.length, "characters");

    // Extract og:image content from the HTML
    // Match: <meta property="og:image" content="URL" />
    const ogImageMatch = html.match(
      /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i,
    );

    if (ogImageMatch?.[1]) {
      const imageUrl = ogImageMatch[1];
      console.log(TAG, "Found og:image (property first):", imageUrl);
      // Validate it looks like a real image URL (not a placeholder)
      if (
        imageUrl.startsWith("http") &&
        !imageUrl.includes("ghost-person") &&
        !imageUrl.includes("default-avatar")
      ) {
        console.log(TAG, "Image URL is valid, returning:", imageUrl);
        return imageUrl;
      }
      console.log(TAG, "Image URL appears to be a placeholder, skipping");
    }

    // Try alternate meta tag format: content before property
    const altMatch = html.match(
      /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i,
    );

    if (altMatch?.[1]) {
      const imageUrl = altMatch[1];
      console.log(TAG, "Found og:image (content first):", imageUrl);
      if (
        imageUrl.startsWith("http") &&
        !imageUrl.includes("ghost-person") &&
        !imageUrl.includes("default-avatar")
      ) {
        console.log(TAG, "Image URL is valid, returning:", imageUrl);
        return imageUrl;
      }
      console.log(TAG, "Image URL appears to be a placeholder, skipping");
    }

    console.log(TAG, "No valid og:image found in HTML, returning null");
    return null;
  } catch (err) {
    // CORS or network error -- expected on web
    console.log(TAG, "Error fetching LinkedIn page:", err);
    return null;
  }
}
