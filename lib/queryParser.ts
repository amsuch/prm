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
  | { intent: "search"; query: string }
  | { intent: "add_contact"; firstName: string; lastName?: string; company?: string; jobTitle?: string; email?: string; phone?: string }
  | { intent: "update_contact"; name: string; field: string; value: string }
  | { intent: "bulk_tag"; tag: string; filter: { company?: string; source?: string } }
  | { intent: "bulk_update"; field: string; value: string; filter: { company?: string; tag?: string; source?: string } }
  | { intent: "archive_contacts"; filter: { days?: number; tag?: string; company?: string } }
  | { intent: "enrich_contact"; name: string }
  | { intent: "link_contacts"; nameA: string; nameB: string; relationship?: string }
  | { intent: "create_entity"; name: string; category?: string; address?: string }
  | { intent: "add_entity_person"; entityName: string; personName: string; role?: string }
  | { intent: "promote_person"; personName: string; entityName: string }
  | { intent: "entity_lookup"; query: string };

/** Returns true if the intent mutates data and should go through HITL approval */
export function isActionIntent(parsed: ParsedQuery): boolean {
  return [
    "add_contact",
    "update_contact",
    "bulk_tag",
    "bulk_update",
    "archive_contacts",
    "link_contacts",
    "create_entity",
    "add_entity_person",
    "promote_person",
  ].includes(parsed.intent);
}

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

  // --- Link contacts (create relationship) ---
  // "link John and Jane as colleagues"
  // "connect John Smith to Jane Doe as friends"
  // "John is Jane's manager" — nameA=John (the manager), nameB=Jane
  // "John is Jane's child" — nameA=John (the child), nameB=Jane
  // "make John and Jane siblings"
  // "link John to Jane"
  // "John and Jane are friends"
  // "make John Jane's mentor"
  const linkPatterns = [
    /^(?:link|connect)\s+(.+?)\s+(?:and|to|with)\s+(.+?)\s+as\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^(?:make|set)\s+(.+?)\s+(?:and)\s+(.+?)\s+(?:as\s+)?['"]?(.+?)['"]?[\s.!]*$/i,
    /^(?:make|set)\s+(.+?)\s+(.+?)['']s\s+(\w+)[\s.!]*$/i,
    /^(.+?)\s+(?:and)\s+(.+?)\s+are\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^(.+?)\s+is\s+(.+?)['']s\s+(\w+)[\s.!]*$/i,
    /^(?:link|connect)\s+(.+?)\s+(?:and|to|with)\s+(.+?)[\s.!]*$/i,
  ];

  for (const pattern of linkPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1] && match[2]) {
      return {
        intent: "link_contacts",
        nameA: match[1].trim(),
        nameB: match[2].trim(),
        relationship: match[3]?.trim(),
      };
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

  // --- Entity lookup ---
  // "who works at Joe's Diner?"
  // "show me my restaurants"
  // "list my entities"
  // "show my gyms"
  // "what entities do I have?"
  const entityLookupPatterns = [
    /(?:show|list|find|get)\s+(?:me\s+)?(?:my\s+)?(?:all\s+)?(restaurants?|gyms?|companies|clubs?|schools?|churches|stores?|entities|places?|organizations?)[\s?!.]*$/i,
    /(?:what|which)\s+(?:entities|places?|organizations?)\s+(?:do\s+)?i\s+have[\s?!.]*$/i,
    /(?:my\s+)(restaurants?|gyms?|companies|clubs?|schools?|churches|stores?|entities|places?|organizations?)[\s?!.]*$/i,
  ];

  for (const pattern of entityLookupPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const query = match[1]?.trim() ?? "";
      return { intent: "entity_lookup", query };
    }
  }

  // --- Promote person from entity to contact ---
  // "promote Sarah from Joe's Diner to a contact"
  // "promote Sarah from Joe's Diner"
  // "make Sarah from Joe's Diner a contact"
  const promotePersonPatterns = [
    /^(?:promote|upgrade)\s+(.+?)\s+from\s+(.+?)(?:\s+to\s+(?:a\s+)?contact)?[\s.!]*$/i,
    /^(?:make)\s+(.+?)\s+from\s+(.+?)\s+(?:a\s+)?contact[\s.!]*$/i,
  ];

  for (const pattern of promotePersonPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1] && match[2]) {
      return {
        intent: "promote_person",
        personName: match[1].trim(),
        entityName: match[2].trim(),
      };
    }
  }

  // --- Add entity person ---
  // "add Sarah as waitress at Joe's Diner"
  // "add Bob as trainer at Planet Fitness"
  // "add Jane to Joe's Diner as hostess"
  const addEntityPersonPatterns = [
    /^add\s+(.+?)\s+as\s+(.+?)\s+(?:at|to)\s+(.+?)[\s.!]*$/i,
    /^add\s+(.+?)\s+(?:at|to)\s+(.+?)\s+as\s+(.+?)[\s.!]*$/i,
    /^add\s+(.+?)\s+(?:at|to)\s+(.+?)[\s.!]*$/i,
  ];

  for (const pattern of addEntityPersonPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      if (pattern === addEntityPersonPatterns[0] && match[1] && match[2] && match[3]) {
        return {
          intent: "add_entity_person",
          personName: match[1].trim(),
          role: match[2].trim(),
          entityName: match[3].trim(),
        };
      }
      if (pattern === addEntityPersonPatterns[1] && match[1] && match[2] && match[3]) {
        return {
          intent: "add_entity_person",
          personName: match[1].trim(),
          entityName: match[2].trim(),
          role: match[3].trim(),
        };
      }
      if (pattern === addEntityPersonPatterns[2] && match[1] && match[2]) {
        return {
          intent: "add_entity_person",
          personName: match[1].trim(),
          entityName: match[2].trim(),
        };
      }
    }
  }

  // --- Create entity ---
  // "add a restaurant called Joe's Diner"
  // "create an entity called Planet Fitness"
  // "new restaurant Joe's Diner"
  // "add a gym called Planet Fitness at 123 Main St"
  const createEntityPatterns = [
    /^(?:add|create|new)\s+(?:a\s+|an\s+)?(?:entity|place|organization)\s+(?:called|named)\s+(.+?)[\s.!]*$/i,
    /^(?:add|create|new)\s+(?:a\s+|an\s+)?(restaurant|gym|company|club|school|church|store|bar|cafe|salon|shop)\s+(?:called|named)\s+(.+?)(?:\s+at\s+(.+?))?[\s.!]*$/i,
    /^(?:add|create|new)\s+(?:a\s+|an\s+)?(restaurant|gym|company|club|school|church|store|bar|cafe|salon|shop)\s+(.+?)(?:\s+at\s+(.+?))?[\s.!]*$/i,
  ];

  for (const pattern of createEntityPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      if (pattern === createEntityPatterns[0] && match[1]) {
        return { intent: "create_entity", name: match[1].trim() };
      }
      if ((pattern === createEntityPatterns[1] || pattern === createEntityPatterns[2]) && match[1] && match[2]) {
        return {
          intent: "create_entity",
          name: match[2].trim(),
          category: match[1].trim(),
          address: match[3]?.trim(),
        };
      }
    }
  }

  // --- Add contact ---
  // "add John Smith from Google as VP Engineering, john@google.com"
  // "add Jane Doe"
  // "create contact Bob Wilson from Apple"
  // "new contact Alice at Meta as Engineer, alice@meta.com, 555-1234"
  const addContactPatterns = [
    /^(?:add|create|new)\s+(?:contact\s+)?(.+?)$/i,
  ];

  for (const pattern of addContactPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const parsed = parseAddContactString(match[1]);
      if (parsed) {
        return parsed;
      }
    }
  }

  // --- Update single contact ---
  // "update John Smith's company to Google"
  // "change John's title to VP Engineering"
  // "set John Smith's email to john@google.com"
  // "update company for John to Google"
  const updateContactPatterns = [
    /^(?:update|change|set)\s+(.+?)['']?s?\s+(company|title|job_title|email|phone|department|notes)\s+to\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^(?:update|change|set)\s+(company|title|job_title|email|phone|department|notes)\s+(?:for|of)\s+(.+?)\s+to\s+['"]?(.+?)['"]?[\s.!]*$/i,
  ];

  for (const pattern of updateContactPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      if (pattern === updateContactPatterns[0] && match[1] && match[2] && match[3]) {
        const field = match[2].toLowerCase() === "title" ? "job_title" : match[2].toLowerCase();
        return { intent: "update_contact", name: match[1].trim(), field, value: match[3].trim() };
      }
      if (pattern === updateContactPatterns[1] && match[1] && match[2] && match[3]) {
        const field = match[1].toLowerCase() === "title" ? "job_title" : match[1].toLowerCase();
        return { intent: "update_contact", name: match[2].trim(), field, value: match[3].trim() };
      }
    }
  }

  // --- Bulk tag ---
  // "tag everyone at Google as tech"
  // "tag all contacts at Apple as partner"
  // "tag all linkedin contacts as imported"
  const bulkTagPatterns = [
    /^tag\s+(?:everyone|all\s+(?:contacts?)?)\s+(?:at|from)\s+(.+?)\s+(?:as|with)\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^tag\s+all\s+(\w+)\s+contacts?\s+(?:as|with)\s+['"]?(.+?)['"]?[\s.!]*$/i,
  ];

  for (const pattern of bulkTagPatterns) {
    const match = lower.match(pattern);
    if (match) {
      // Pattern 1: "tag everyone at Google as tech"
      if (pattern === bulkTagPatterns[0] && match[1] && match[2]) {
        return {
          intent: "bulk_tag",
          tag: match[2].trim(),
          filter: { company: match[1].trim() },
        };
      }
      // Pattern 2: "tag all linkedin contacts as imported"
      if (pattern === bulkTagPatterns[1] && match[1] && match[2]) {
        return {
          intent: "bulk_tag",
          tag: match[2].trim(),
          filter: { source: match[1].trim() },
        };
      }
    }
  }

  // --- Bulk update ---
  // "update company to Alphabet for all contacts at Google"
  // "update job_title to Engineer for all contacts tagged tech"
  // "set company to Meta for everyone at Facebook"
  const bulkUpdatePatterns = [
    /^(?:update|set|change)\s+(\w+)\s+to\s+['"]?(.+?)['"]?\s+for\s+(?:all\s+)?contacts?\s+(?:at|from)\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^(?:update|set|change)\s+(\w+)\s+to\s+['"]?(.+?)['"]?\s+for\s+(?:all\s+)?(?:contacts?\s+)?(?:tagged|with\s+tag)\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^(?:update|set|change)\s+(\w+)\s+to\s+['"]?(.+?)['"]?\s+for\s+(?:all\s+)?(?:everyone|contacts?)\s+(?:at|from)\s+['"]?(.+?)['"]?[\s.!]*$/i,
  ];

  for (const pattern of bulkUpdatePatterns) {
    const match = lower.match(pattern);
    if (match?.[1] && match[2] && match[3]) {
      const field = match[1].trim();
      const value = match[2].trim();
      const filterValue = match[3].trim();

      if (pattern === bulkUpdatePatterns[1]) {
        return {
          intent: "bulk_update",
          field,
          value,
          filter: { tag: filterValue },
        };
      }
      return {
        intent: "bulk_update",
        field,
        value,
        filter: { company: filterValue },
      };
    }
  }

  // --- Archive contacts ---
  // "archive contacts I haven't talked to in a year"
  // "archive contacts I haven't contacted in 90 days"
  // "archive all contacts tagged old"
  // "archive everyone at Defunct Corp"
  const archivePatterns = [
    /^archive\s+(?:contacts?\s+)?(?:i\s+)?haven'?t\s+(?:talked?\s+to|contacted|spoken?\s+to|reached\s+out\s+to)\s+in\s+(?:a\s+)?(\d+)?\s*(days?|weeks?|months?|years?)[\s.!]*$/i,
    /^archive\s+(?:all\s+)?contacts?\s+(?:tagged|with\s+tag)\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^archive\s+(?:all\s+)?(?:contacts?\s+|everyone\s+)?(?:at|from)\s+['"]?(.+?)['"]?[\s.!]*$/i,
    /^archive\s+(?:stale|old|inactive|dormant)\s+contacts?[\s.!]*$/i,
  ];

  for (const pattern of archivePatterns) {
    const match = lower.match(pattern);
    if (match) {
      // Pattern 0: time-based archive
      if (pattern === archivePatterns[0]) {
        let days: number;
        const num = match[1] ? parseInt(match[1], 10) : 1;
        const unit = match[2]?.toLowerCase() ?? "year";
        if (unit.startsWith("day")) days = num;
        else if (unit.startsWith("week")) days = num * 7;
        else if (unit.startsWith("month")) days = num * 30;
        else days = num * 365;
        return { intent: "archive_contacts", filter: { days } };
      }
      // Pattern 1: tag-based archive
      if (pattern === archivePatterns[1] && match[1]) {
        return { intent: "archive_contacts", filter: { tag: match[1].trim() } };
      }
      // Pattern 2: company-based archive
      if (pattern === archivePatterns[2] && match[1]) {
        return { intent: "archive_contacts", filter: { company: match[1].trim() } };
      }
      // Pattern 3: generic stale archive
      if (pattern === archivePatterns[3]) {
        return { intent: "archive_contacts", filter: { days: 365 } };
      }
    }
  }

  // --- Enrich contact ---
  // "enrich John Smith"
  // "research John Smith"
  // "look up John Smith"
  const enrichPatterns = [
    /^(?:enrich|research|look\s+up|lookup)\s+(.+?)(?:'s\s+(?:profile|info|details?))?[\s?!.]*$/i,
  ];

  for (const pattern of enrichPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return { intent: "enrich_contact", name: match[1].trim() };
    }
  }

  // --- Fallback: general search ---
  return { intent: "search", query: trimmed };
}

/**
 * Parse an "add contact" string like "John Smith from Google as VP Engineering, john@google.com, 555-1234"
 */
function parseAddContactString(raw: string): ParsedQuery | null {
  // Try to extract structured fields from the raw string
  const emailMatch = raw.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const phoneMatch = raw.match(/(?:^|[\s,])(\+?[\d\s()-]{7,})/);

  // Remove email and phone from the string to parse name/company/title
  let remaining = raw;
  if (emailMatch) remaining = remaining.replace(emailMatch[0], "");
  if (phoneMatch) remaining = remaining.replace(phoneMatch[0], "");

  // Clean up commas and extra whitespace
  remaining = remaining.replace(/,\s*/g, " ").replace(/\s+/g, " ").trim();

  // Extract company: "from Google" or "at Google"
  let company: string | undefined;
  const companyMatch = remaining.match(/\s+(?:from|at)\s+(.+?)(?:\s+as\s+|$)/i);
  if (companyMatch?.[1]) {
    company = companyMatch[1].trim();
    remaining = remaining.replace(companyMatch[0], " ");
  }

  // Extract job title: "as VP Engineering"
  let jobTitle: string | undefined;
  const titleMatch = remaining.match(/\s+as\s+(.+?)$/i);
  if (titleMatch?.[1]) {
    jobTitle = titleMatch[1].trim();
    remaining = remaining.replace(titleMatch[0], "");
  }

  remaining = remaining.trim();

  if (!remaining) return null;

  // Split remaining into first name and last name
  const nameParts = remaining.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  if (!firstName) return null;

  return {
    intent: "add_contact",
    firstName,
    lastName,
    company,
    jobTitle,
    email: emailMatch?.[0],
    phone: phoneMatch?.[1]?.trim(),
  };
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
    case "add_contact":
      return `Adding contact "${parsed.firstName}${parsed.lastName ? " " + parsed.lastName : ""}"...`;
    case "update_contact":
      return `Updating ${parsed.field} for "${parsed.name}"...`;
    case "bulk_tag": {
      const target = parsed.filter.company
        ? `contacts at "${parsed.filter.company}"`
        : `${parsed.filter.source} contacts`;
      return `Tagging ${target} as "${parsed.tag}"...`;
    }
    case "bulk_update": {
      const target = parsed.filter.company
        ? `contacts at "${parsed.filter.company}"`
        : parsed.filter.tag
          ? `contacts tagged "${parsed.filter.tag}"`
          : `${parsed.filter.source} contacts`;
      return `Updating ${parsed.field} to "${parsed.value}" for ${target}...`;
    }
    case "archive_contacts": {
      if (parsed.filter.days) return `Archiving contacts not reached in ${parsed.filter.days}+ days...`;
      if (parsed.filter.tag) return `Archiving contacts tagged "${parsed.filter.tag}"...`;
      if (parsed.filter.company) return `Archiving contacts at "${parsed.filter.company}"...`;
      return "Archiving contacts...";
    }
    case "enrich_contact":
      return `Looking up information for "${parsed.name}"...`;
    case "link_contacts":
      return `Linking ${parsed.nameA} and ${parsed.nameB}${parsed.relationship ? ` as ${parsed.relationship}` : ""}...`;
    case "create_entity":
      return `Creating entity "${parsed.name}"${parsed.category ? ` (${parsed.category})` : ""}...`;
    case "add_entity_person":
      return `Adding ${parsed.personName} to "${parsed.entityName}"${parsed.role ? ` as ${parsed.role}` : ""}...`;
    case "promote_person":
      return `Promoting ${parsed.personName} from "${parsed.entityName}" to a contact...`;
    case "entity_lookup":
      return `Looking up entities${parsed.query ? ` matching "${parsed.query}"` : ""}...`;
  }
}
