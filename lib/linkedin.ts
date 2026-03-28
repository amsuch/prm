/**
 * LinkedIn photo extraction.
 *
 * Fetches the og:image from a LinkedIn profile page to use as an avatar.
 * This may fail due to CORS on web -- handled gracefully by returning null.
 */

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
  if (!isLinkedInUrl(linkedinUrl)) {
    return null;
  }

  try {
    const response = await fetch(linkedinUrl, {
      headers: {
        // Use a standard user-agent to avoid being blocked
        "User-Agent":
          "Mozilla/5.0 (compatible; PersonalCRM/1.0)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract og:image content from the HTML
    // Match: <meta property="og:image" content="URL" />
    const ogImageMatch = html.match(
      /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i,
    );

    if (ogImageMatch?.[1]) {
      const imageUrl = ogImageMatch[1];
      // Validate it looks like a real image URL (not a placeholder)
      if (
        imageUrl.startsWith("http") &&
        !imageUrl.includes("ghost-person") &&
        !imageUrl.includes("default-avatar")
      ) {
        return imageUrl;
      }
    }

    // Try alternate meta tag format: content before property
    const altMatch = html.match(
      /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i,
    );

    if (altMatch?.[1]) {
      const imageUrl = altMatch[1];
      if (
        imageUrl.startsWith("http") &&
        !imageUrl.includes("ghost-person") &&
        !imageUrl.includes("default-avatar")
      ) {
        return imageUrl;
      }
    }

    return null;
  } catch {
    // CORS or network error -- expected on web
    return null;
  }
}
