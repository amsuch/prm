/**
 * Natural language query parser for the AI chat interface.
 *
 * Parses user questions into structured intents that can be executed
 * against Supabase. Uses regex pattern matching with flexible phrasing.
 */

export type ParsedQuery =
  | { intent: "company_lookup"; company: string }
  | { intent: "last_contact"; name: string }
  | { intent: "stale_contacts"; days: number }
  | { intent: "tag_lookup"; tag: string }
  | { intent: "relationships"; name: string }
  | { intent: "stats" }
  | { intent: "search"; query: string };

/**
 * Parse a natural language question into a structured query intent.
 */
export function parseQuery(input: string): ParsedQuery {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // --- Company lookup ---
  // "who do I know at Google?"
  // "who works at Apple?"
  // "people at Microsoft"
  // "contacts at Amazon"
  // "show me everyone at Meta"
  const companyPatterns = [
    /who\s+(?:do\s+i\s+)?know\s+at\s+(.+?)[\s?!.]*$/i,
    /who\s+(?:works?|is)\s+at\s+(.+?)[\s?!.]*$/i,
    /(?:people|contacts|everyone|anybody|anyone)\s+(?:at|from)\s+(.+?)[\s?!.]*$/i,
    /(?:show|find|list|get)\s+(?:me\s+)?(?:people|contacts|everyone|anyone)\s+(?:at|from)\s+(.+?)[\s?!.]*$/i,
    /(?:show|find|list|get)\s+(?:me\s+)?(?:everyone|all\s+contacts?|all)\s+(?:at|from)\s+(.+?)[\s?!.]*$/i,
    /who\s+is\s+(?:at|from)\s+(.+?)[\s?!.]*$/i,
  ];

  for (const pattern of companyPatterns) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      return { intent: "company_lookup", company: match[1].trim() };
    }
  }

  // --- Last contact ---
  // "when did I last talk to John?"
  // "when was my last contact with Sarah?"
  // "last time I talked to Bob"
  // "when did I speak to Jane?"
  // "how long since I contacted Mike?"
  const lastContactPatterns = [
    /when\s+(?:did\s+i\s+)?last\s+(?:talk|speak|chat|message|contact|reach\s+out)\s+(?:to|with)\s+(.+?)[\s?!.]*$/i,
    /last\s+(?:time|date)\s+i\s+(?:talked?|spoke|chatted|messaged|contacted)\s+(?:to|with)?\s*(.+?)[\s?!.]*$/i,
    /when\s+was\s+(?:my\s+)?last\s+(?:contact|interaction|conversation|call)\s+with\s+(.+?)[\s?!.]*$/i,
    /how\s+long\s+(?:since|ago)\s+(?:i\s+)?(?:talked?|spoke|contacted|reached\s+out)\s+(?:to|with)?\s*(.+?)[\s?!.]*$/i,
    /when\s+did\s+i\s+(?:last\s+)?(?:speak|talk|chat|message)\s+(?:to|with)\s+(.+?)[\s?!.]*$/i,
  ];

  for (const pattern of lastContactPatterns) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      return { intent: "last_contact", name: match[1].trim() };
    }
  }

  // --- Stale contacts ---
  // "who haven't I contacted in 3 months?"
  // "who haven't I talked to recently?"
  // "stale contacts"
  // "contacts I haven't reached out to in 90 days"
  // "who have I lost touch with?"
  // "neglected contacts"
  const stalePatterns = [
    /(?:who|contacts?)\s+(?:i\s+)?haven'?t\s+(?:i\s+)?(?:contacted|talked?\s+to|spoken?\s+(?:to|with)|reached\s+out\s+to|messaged)\s+in\s+(\d+)\s*(days?|weeks?|months?|years?)[\s?!.]*$/i,
    /(?:who|contacts?)\s+(?:i\s+)?haven'?t\s+(?:i\s+)?(?:contacted|talked?\s+to|spoken?\s+(?:to|with)|reached\s+out\s+to)\s+(?:recently|in\s+a\s+while|lately)[\s?!.]*$/i,
    /(?:stale|neglected|forgotten|dormant|inactive)\s+contacts?/i,
    /(?:who|contacts?)\s+(?:have\s+)?i\s+(?:lost\s+touch\s+with|been\s+neglecting|forgotten\s+about)/i,
    /contacts?\s+(?:i\s+)?haven'?t\s+(?:i\s+)?(?:reached?\s+out|contacted|talked?)\s+(?:to\s+)?in\s+(\d+)\s*(days?|weeks?|months?|years?)/i,
  ];

  for (let i = 0; i < stalePatterns.length; i++) {
    const match = lower.match(stalePatterns[i]);
    if (match) {
      // Patterns with time extraction (indices 0 and 4)
      if (match[1] && match[2]) {
        const num = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        let days = num;
        if (unit.startsWith("week")) days = num * 7;
        else if (unit.startsWith("month")) days = num * 30;
        else if (unit.startsWith("year")) days = num * 365;
        return { intent: "stale_contacts", days };
      }
      // Generic stale query - default to 30 days
      return { intent: "stale_contacts", days: 30 };
    }
  }

  // --- Tag lookup ---
  // "show contacts tagged VIP"
  // "who is tagged as friend?"
  // "contacts with tag investor"
  // "tagged mentor"
  const tagPatterns = [
    /(?:show|find|list|get)\s+(?:me\s+)?contacts?\s+tagged\s+(?:as\s+)?['"]?(.+?)['"]?[\s?!.]*$/i,
    /who\s+(?:is|are)\s+tagged\s+(?:as\s+)?['"]?(.+?)['"]?[\s?!.]*$/i,
    /contacts?\s+(?:with\s+)?tag\s+['"]?(.+?)['"]?[\s?!.]*$/i,
    /(?:show|find|list|get)\s+(?:me\s+)?(?:all\s+)?['"]?(.+?)['"]?\s+contacts?[\s?!.]*$/i,
    /tagged\s+(?:as\s+)?['"]?(.+?)['"]?[\s?!.]*$/i,
  ];

  for (const pattern of tagPatterns) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      // Avoid false positives from the broad pattern (index 3)
      const tag = match[1].trim();
      // Filter out common words that aren't tags
      const nonTagWords = [
        "my", "all", "the", "some", "those", "these",
        "recent", "new", "old", "stale",
      ];
      if (!nonTagWords.includes(tag)) {
        return { intent: "tag_lookup", tag };
      }
    }
  }

  // --- Relationships ---
  // "who is connected to John?"
  // "who knows Sarah?"
  // "connections of Bob"
  // "who is related to Jane?"
  const relationshipPatterns = [
    /who\s+(?:is\s+)?connected\s+to\s+(.+?)[\s?!.]*$/i,
    /who\s+knows?\s+(.+?)[\s?!.]*$/i,
    /connections?\s+(?:of|for)\s+(.+?)[\s?!.]*$/i,
    /who\s+(?:is\s+)?(?:related|linked)\s+to\s+(.+?)[\s?!.]*$/i,
    /(?:show|find|list|get)\s+(?:me\s+)?(?:the\s+)?(?:connections?|relationships?)\s+(?:of|for)\s+(.+?)[\s?!.]*$/i,
    /(.+?)['']?s?\s+(?:connections?|relationships?|network)[\s?!.]*$/i,
  ];

  for (const pattern of relationshipPatterns) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      // Avoid matching overly generic words
      if (name.length > 1 && name !== "me" && name !== "my") {
        return { intent: "relationships", name };
      }
    }
  }

  // --- Stats ---
  // "how many contacts do I have?"
  // "total contacts"
  // "contact count"
  // "stats"
  // "summary"
  const statsPatterns = [
    /how\s+many\s+contacts?/i,
    /total\s+contacts?/i,
    /contacts?\s+count/i,
    /^\s*stats?\s*$/i,
    /^\s*summary\s*$/i,
    /give\s+me\s+(?:a\s+)?(?:summary|overview|stats?)/i,
    /(?:my\s+)?network\s+(?:stats?|summary|size|overview)/i,
  ];

  for (const pattern of statsPatterns) {
    if (statsPatterns.some((p) => p.test(lower))) {
      return { intent: "stats" };
    }
  }

  // --- Fallback: general search ---
  return { intent: "search", query: trimmed };
}

/**
 * Get a human-readable description of what the query is doing,
 * shown while loading results.
 */
export function getQueryDescription(parsed: ParsedQuery): string {
  switch (parsed.intent) {
    case "company_lookup":
      return `Looking up contacts at "${parsed.company}"...`;
    case "last_contact":
      return `Finding last interaction with "${parsed.name}"...`;
    case "stale_contacts":
      return `Finding contacts not reached in ${parsed.days} days...`;
    case "tag_lookup":
      return `Finding contacts tagged "${parsed.tag}"...`;
    case "relationships":
      return `Finding connections for "${parsed.name}"...`;
    case "stats":
      return "Calculating your network stats...";
    case "search":
      return `Searching for "${parsed.query}"...`;
  }
}
