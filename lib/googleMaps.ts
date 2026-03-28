/**
 * Parse Google Maps URLs to extract place name and address.
 *
 * Supports formats:
 *   - https://maps.google.com/?q=Joe's+Diner,+123+Main+St,+Portland
 *   - https://www.google.com/maps/place/Joe's+Diner/@45.5,-122.6,17z/
 *   - https://maps.app.goo.gl/ABC123 (short link - follows redirect)
 *   - https://goo.gl/maps/ABC123 (short link - follows redirect)
 */

export type GoogleMapsResult = {
  name: string | null;
  address: string | null;
};

/**
 * Check whether a string looks like a Google Maps URL.
 */
export function isGoogleMapsUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.includes("google.com/maps") ||
    trimmed.includes("maps.google.com") ||
    trimmed.includes("maps.app.goo.gl") ||
    trimmed.includes("goo.gl/maps")
  );
}

/**
 * Follow a short Google Maps URL redirect to get the full URL.
 * Returns the redirect location or the original URL on failure.
 */
async function resolveShortUrl(shortUrl: string): Promise<string> {
  try {
    const response = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "follow",
    });
    // The final URL after redirects
    return response.url || shortUrl;
  } catch {
    // On web, CORS may block this. Try with a GET and manual redirect
    try {
      const response = await fetch(shortUrl, { redirect: "follow" });
      return response.url || shortUrl;
    } catch {
      return shortUrl;
    }
  }
}

/**
 * Parse a full Google Maps URL (not a short link) to extract name/address.
 */
function parseFullUrl(url: string): GoogleMapsResult {
  const result: GoogleMapsResult = { name: null, address: null };

  try {
    const parsed = new URL(url);

    // Format: /maps/place/Place+Name/@lat,lng,zoom/
    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      // If it contains commas, it might be "Name, Address"
      const parts = decoded.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        result.name = parts[0];
        result.address = parts.slice(1).join(", ");
      } else {
        result.name = decoded;
      }
    }

    // Format: ?q=Place+Name,+Address
    const qParam = parsed.searchParams.get("q");
    if (qParam && !result.name) {
      const decoded = decodeURIComponent(qParam.replace(/\+/g, " "));
      const parts = decoded.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        result.name = parts[0];
        result.address = parts.slice(1).join(", ");
      } else {
        result.name = decoded;
      }
    }

    // Format: /maps/search/query/
    if (!result.name) {
      const searchMatch = parsed.pathname.match(/\/maps\/search\/([^/]+)/);
      if (searchMatch) {
        const decoded = decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
        const parts = decoded.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          result.name = parts[0];
          result.address = parts.slice(1).join(", ");
        } else {
          result.name = decoded;
        }
      }
    }

    // Check for "query" search param as well
    const queryParam = parsed.searchParams.get("query");
    if (queryParam && !result.name) {
      const decoded = decodeURIComponent(queryParam.replace(/\+/g, " "));
      const parts = decoded.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        result.name = parts[0];
        result.address = parts.slice(1).join(", ");
      } else {
        result.name = decoded;
      }
    }
  } catch {
    // Invalid URL - ignore
  }

  return result;
}

/**
 * Parse a Google Maps URL and extract the place name and address.
 * Handles both short links (goo.gl) and full URLs.
 *
 * Returns null if the URL cannot be parsed or is not a Google Maps URL.
 */
export async function parseGoogleMapsUrl(
  url: string,
): Promise<GoogleMapsResult | null> {
  const trimmed = url.trim();

  if (!isGoogleMapsUrl(trimmed)) {
    return null;
  }

  let fullUrl = trimmed;

  // Resolve short links
  if (
    trimmed.includes("maps.app.goo.gl") ||
    trimmed.includes("goo.gl/maps")
  ) {
    fullUrl = await resolveShortUrl(trimmed);
  }

  const result = parseFullUrl(fullUrl);

  // Return null if we couldn't extract anything useful
  if (!result.name && !result.address) {
    return null;
  }

  return result;
}
