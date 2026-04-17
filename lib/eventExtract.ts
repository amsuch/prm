/**
 * Extract structured event fields from a user-supplied URL or free-form
 * description using the configured LLM.
 *
 * For URLs, we include the URL as-is in the prompt and ask the model to infer
 * name/category/date/location from the URL path/slug. We don't fetch the page
 * (the app runs client-side and many hosts block CORS); the user can paste the
 * full event description if richer extraction is needed.
 */

import { callLLM, type LLMConfig } from "@/lib/llm";

export type ExtractedEvent = {
  name?: string;
  category?: string;
  event_date?: string; // ISO date (YYYY-MM-DD)
  location?: string;
  url?: string;
  description?: string;
};

const SYSTEM_PROMPT = `You extract structured event details from user input (a URL or free-text description).

Return ONLY a compact JSON object with these optional keys:
- name: short event title (required if inferrable)
- category: one of Conference, Meetup, Party, Workshop, Wedding, Concert, Sports, Dinner, Travel, Other (pick best fit)
- event_date: ISO date YYYY-MM-DD if a specific date is mentioned
- location: city, venue, or address if mentioned
- url: a URL if the input contains one
- description: a one- to two-sentence summary

Do not invent data. Leave keys out if unknown. Respond with JSON only — no prose, no code fences.`;

export async function extractEventFromInput(
  input: string,
  config: LLMConfig,
): Promise<ExtractedEvent> {
  const trimmed = input.trim();
  if (!trimmed) return {};

  const isUrl = /^https?:\/\//i.test(trimmed);
  const userMessage = isUrl
    ? `URL: ${trimmed}\n\nExtract event details from this URL.`
    : `Description:\n${trimmed}\n\nExtract event details from this description.`;

  const res = await callLLM(
    { ...config, systemPrompt: SYSTEM_PROMPT },
    [{ role: "user", content: userMessage }],
  );

  const parsed = parseJSONResponse(res.content);
  if (isUrl && !parsed.url) parsed.url = trimmed;
  return parsed;
}

function parseJSONResponse(raw: string): ExtractedEvent {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  const match = stripped.match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : stripped;

  try {
    const obj = JSON.parse(candidate);
    const out: ExtractedEvent = {};
    if (typeof obj.name === "string") out.name = obj.name.trim();
    if (typeof obj.category === "string") out.category = obj.category.trim();
    if (typeof obj.event_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.event_date)) {
      out.event_date = obj.event_date;
    }
    if (typeof obj.location === "string") out.location = obj.location.trim();
    if (typeof obj.url === "string") out.url = obj.url.trim();
    if (typeof obj.description === "string") out.description = obj.description.trim();
    return out;
  } catch {
    return {};
  }
}
