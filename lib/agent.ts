/**
 * Agent: execute parsed query intents against Supabase and return
 * formatted results for the chat interface.
 */

import { supabase } from "@/lib/supabase";
import type { ParsedQuery } from "@/lib/queryParser";
import { formatRelativeTime } from "@/lib/utils";
import { sanitizePostgrestValue } from "@/lib/sanitize";
import type { Tables } from "@/types/database";
import { promotePersonToContact } from "@/lib/entities";
import { callLLM, type LLMConfig } from "@/lib/llm";
import { askWithSQL } from "@/lib/sqlAgent";
import { findContactsByName, formatContactName } from "@/lib/contactLookup";
import { getToolDefinitions } from "@/lib/tools";

export type AgentResultContact = {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  avatar_url: string | null;
};

export type InteractionResult = {
  id: string;
  type: string;
  direction: string | null;
  title: string | null;
  body: string | null;
  occurred_at: string;
  contact_name: string;
};

export type RelationshipResult = {
  related_contact_id: string;
  related_first_name: string;
  related_last_name: string | null;
  related_company: string | null;
  related_avatar_url: string | null;
  relationship_name: string;
};

export type StatsResult = {
  totalContacts: number;
  contactedThisWeek: number;
  staleContacts: number;
  topCompanies: { company: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
};

export type ActionType = "add" | "update" | "link" | "bulk_tag" | "bulk_update" | "archive" | "enrich" | "create_entity" | "add_entity_person" | "promote_person";

/** A serialized action that can be executed after user approval */
export type PendingAction = {
  parsedQuery: ParsedQuery;
  userId: string;
  preview: {
    actionType: ActionType;
    description: string;
    affectedContacts: AgentResultContact[];
    totalCount: number;
    details?: string;
  };
};

export type EntityResult = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  people_count?: number;
};

export type AgentResponse =
  | { type: "contacts"; message: string; contacts: AgentResultContact[] }
  | { type: "interaction"; message: string; interaction: InteractionResult | null }
  | { type: "relationships"; message: string; relationships: RelationshipResult[]; contactName: string }
  | { type: "stats"; message: string; stats: StatsResult }
  | { type: "text"; message: string }
  | { type: "error"; message: string }
  | { type: "action"; message: string; actionType: ActionType; count?: number; contact?: AgentResultContact }
  | { type: "pending_action"; message: string; pendingAction: PendingAction }
  | { type: "entities"; message: string; entities: EntityResult[] }
  | { type: "sql_result"; message: string; sql: string; rows: Record<string, unknown>[]; rowCount: number };

// Row types used for casting Supabase query results
type ContactRow = Tables<"contacts">;
type InteractionRow = Tables<"interactions">;
type TagRow = Tables<"tags">;
type ContactTagRow = Tables<"contact_tags">;

type SearchContactRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  avatar_url: string | null;
  source: string | null;
  last_contacted_at: string | null;
  email: string | null;
  phone: string | null;
  custom_fields: unknown;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  rank: number;
};

type RelationshipRpcRow = {
  relationship_id: string;
  related_contact_id: string;
  related_first_name: string;
  related_last_name: string | null;
  related_company: string | null;
  related_avatar_url: string | null;
  relationship_name: string;
  relationship_category: string;
  notes: string | null;
};

/**
 * Preview an action intent: show what will happen without executing.
 * Used in HITL mode to get user approval before mutations.
 */
export async function previewAction(
  parsed: ParsedQuery,
  userId: string,
): Promise<AgentResponse> {
  try {
    const affected = await getAffectedContacts(parsed, userId);
    // For bulk ops, get the real total count (getAffectedContacts caps at 20 for preview)
    const totalCount = await getAffectedCount(parsed, userId);

    const actionTypeMap: Record<string, ActionType> = {
      add_contact: "add",
      update_contact: "update",
      bulk_tag: "bulk_tag",
      bulk_update: "bulk_update",
      archive_contacts: "archive",
      enrich_contact: "enrich",
      link_contacts: "link",
      create_entity: "create_entity",
      add_entity_person: "add_entity_person",
      promote_person: "promote_person",
    };

    const actionType = actionTypeMap[parsed.intent] ?? "bulk_update";
    const description = describeAction(parsed);

    const countLabel = totalCount === 1 ? "1 contact" : `${totalCount} contacts`;

    return {
      type: "pending_action",
      message: `${description}\n\nThis will affect ${countLabel}. Approve?`,
      pendingAction: {
        parsedQuery: parsed,
        userId,
        preview: {
          actionType,
          description,
          affectedContacts: affected,
          totalCount,
          details: describeActionDetails(parsed),
        },
      },
    };
  } catch (err) {
    return {
      type: "error",
      message: err instanceof Error ? err.message : "Failed to preview action.",
    };
  }
}

/**
 * Execute a confirmed action. Called after user approves in HITL mode,
 * or directly in Auto mode.
 */
export async function confirmAction(
  pendingAction: PendingAction,
): Promise<AgentResponse> {
  const { parsedQuery: parsed, userId } = pendingAction;
  return executeAction(parsed, userId);
}

/**
 * Execute a parsed query. Read intents run directly.
 * Action intents run directly (used in Auto mode or after HITL approval).
 * If llmConfig is provided, fallback queries use the LLM instead of plain search.
 */
export async function executeQuery(
  parsed: ParsedQuery,
  userId: string,
  llmConfig?: LLMConfig | null,
): Promise<AgentResponse> {
  try {
    switch (parsed.intent) {
      case "company_lookup":
        return await handleCompanyLookup(parsed.company, userId);
      case "last_contact":
        return await handleLastContact(parsed.name, userId);
      case "stale_contacts":
        return await handleStaleContacts(parsed.days, userId);
      case "tag_lookup":
        return await handleTagLookup(parsed.tag, userId);
      case "relationships":
        return await handleRelationships(parsed.name, userId);
      case "stats":
        return await handleStats(userId);
      case "search":
        if (llmConfig) {
          return await handleLLMQuery(parsed.query, userId, llmConfig);
        }
        return await handleSearch(parsed.query, userId);
      case "entity_lookup":
        return await handleEntityLookup(parsed.query, userId);
      default:
        return await executeAction(parsed, userId);
    }
  } catch (err) {
    return {
      type: "error",
      message: err instanceof Error ? err.message : "Something went wrong. Please try again.",
    };
  }
}

async function handleCompanyLookup(
  company: string,
  userId: string,
): Promise<AgentResponse> {
  const tool = getToolDefinitions().find((t) => t.name === "search_contacts");
  const results = (await tool!.execute({ query: company }, userId)) as AgentResultContact[];

  if (results.length === 0) {
    return {
      type: "text",
      message: `I couldn't find any contacts at "${company}". Try checking the spelling or searching for a different company.`,
    };
  }

  const plural = results.length === 1 ? "contact" : "contacts";
  return {
    type: "contacts",
    message: `Found ${results.length} ${plural} at "${company}":`,
    contacts: results,
  };
}

async function handleLastContact(
  name: string,
  userId: string,
): Promise<AgentResponse> {
  // First, find contacts matching the name
  const contacts = await findContactsByName(name, userId, 5);

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `I couldn't find anyone named "${name}" in your contacts.`,
    };
  }

  // Find the most recent interaction for the first matched contact
  const contact = contacts[0];
  const fullName = formatContactName(contact.first_name, contact.last_name);

  const { data: interactionData, error: interactionError } = await supabase
    .from("interactions")
    .select("*")
    .eq("user_id", userId)
    .eq("contact_id", contact.id)
    .order("occurred_at", { ascending: false })
    .limit(1);

  if (interactionError) throw interactionError;

  const interactions = (interactionData as unknown as InteractionRow[]) ?? [];

  if (interactions.length === 0) {
    return {
      type: "interaction",
      message: `No recorded interactions with ${fullName}. You haven't logged any contact with them yet.`,
      interaction: null,
    };
  }

  const interaction = interactions[0];
  const timeAgo = formatRelativeTime(interaction.occurred_at);

  return {
    type: "interaction",
    message: `Your last interaction with ${fullName} was ${timeAgo}:`,
    interaction: {
      id: interaction.id,
      type: interaction.type,
      direction: interaction.direction,
      title: interaction.title,
      body: interaction.body,
      occurred_at: interaction.occurred_at,
      contact_name: fullName,
    },
  };
}

async function handleStaleContacts(
  days: number,
  userId: string,
): Promise<AgentResponse> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url, last_contacted_at")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(
      `last_contacted_at.is.null,last_contacted_at.lt.${cutoff.toISOString()}`,
    )
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .limit(20);

  if (error) throw error;

  const rows = (data as unknown as ContactRow[]) ?? [];

  const contacts: AgentResultContact[] = rows.map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    company: c.company,
    job_title: c.job_title,
    avatar_url: c.avatar_url,
  }));

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `Great news! All your contacts have been reached in the last ${days} days.`,
    };
  }

  const plural = contacts.length === 1 ? "contact" : "contacts";
  return {
    type: "contacts",
    message: `Found ${contacts.length} ${plural} you haven't contacted in ${days}+ days:`,
    contacts,
  };
}

async function handleTagLookup(
  tagName: string,
  userId: string,
): Promise<AgentResponse> {
  // Find the tag by name
  const { data: tagData, error: tagError } = await supabase
    .from("tags")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", `%${sanitizePostgrestValue(tagName)}%`)
    .limit(1);

  if (tagError) throw tagError;

  const tags = (tagData as unknown as TagRow[]) ?? [];

  if (tags.length === 0) {
    return {
      type: "text",
      message: `I couldn't find a tag matching "${tagName}". Check your tags in Settings or try a different name.`,
    };
  }

  const tag = tags[0];

  // Get contacts with this tag
  const { data: ctData, error: ctError } = await supabase
    .from("contact_tags")
    .select("contact_id")
    .eq("tag_id", tag.id);

  if (ctError) throw ctError;

  const contactTags = (ctData as unknown as ContactTagRow[]) ?? [];
  const contactIds = contactTags.map((ct) => ct.contact_id);

  if (contactIds.length === 0) {
    return {
      type: "text",
      message: `No contacts are tagged with "${tag.name}" yet.`,
    };
  }

  const { data: contactData, error: contactError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .in("id", contactIds)
    .eq("is_archived", false)
    .order("first_name")
    .limit(20);

  if (contactError) throw contactError;

  const contacts = (contactData as unknown as AgentResultContact[]) ?? [];

  const plural = contacts.length === 1 ? "contact" : "contacts";
  return {
    type: "contacts",
    message: `Found ${contacts.length} ${plural} tagged "${tag.name}":`,
    contacts,
  };
}

async function handleRelationships(
  name: string,
  userId: string,
): Promise<AgentResponse> {
  // Find contacts matching the name
  const contacts = await findContactsByName(name, userId, 1);

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `I couldn't find anyone named "${name}" in your contacts.`,
    };
  }

  const contact = contacts[0];
  const fullName = formatContactName(contact.first_name, contact.last_name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: relData, error: relError } = await (supabase.rpc as any)(
    "get_contact_relationships",
    { p_contact_id: contact.id },
  );

  if (relError) throw relError;

  const relationships = (relData as unknown as RelationshipRpcRow[]) ?? [];

  if (relationships.length === 0) {
    return {
      type: "relationships",
      message: `${fullName} doesn't have any recorded relationships yet.`,
      relationships: [],
      contactName: fullName,
    };
  }

  const rels: RelationshipResult[] = relationships.map((r) => ({
    related_contact_id: r.related_contact_id,
    related_first_name: r.related_first_name,
    related_last_name: r.related_last_name,
    related_company: r.related_company,
    related_avatar_url: r.related_avatar_url,
    relationship_name: r.relationship_name,
  }));

  const plural = rels.length === 1 ? "connection" : "connections";
  return {
    type: "relationships",
    message: `${fullName} has ${rels.length} ${plural}:`,
    relationships: rels,
    contactName: fullName,
  };
}

async function handleStats(userId: string): Promise<AgentResponse> {
  const tool = getToolDefinitions().find((t) => t.name === "get_network_stats");
  const stats = (await tool!.execute({}, userId)) as StatsResult;

  // Format a text summary
  const lines: string[] = [];
  lines.push(`You have ${stats.totalContacts} contacts in your network.`);
  lines.push(`${stats.contactedThisWeek} contacted this week.`);
  lines.push(`${stats.staleContacts} need follow-up (30+ days).`);

  if (stats.topCompanies.length > 0) {
    lines.push("");
    lines.push("Top companies:");
    for (const c of stats.topCompanies) {
      lines.push(`  ${c.company} (${c.count})`);
    }
  }

  if (stats.sourceBreakdown.length > 0) {
    lines.push("");
    lines.push("Sources:");
    for (const s of stats.sourceBreakdown) {
      lines.push(`  ${s.source}: ${s.count}`);
    }
  }

  return {
    type: "stats",
    message: lines.join("\n"),
    stats,
  };
}

async function handleLLMQuery(
  query: string,
  userId: string,
  llmConfig: LLMConfig,
): Promise<AgentResponse> {
  // Try text-to-SQL first for data questions
  try {
    const result = await askWithSQL(query, userId, llmConfig);
    return {
      type: "sql_result",
      message: result.summary,
      sql: result.sql,
      rows: result.rows,
      rowCount: result.rowCount,
    };
  } catch (sqlErr) {
    const sqlMsg = sqlErr instanceof Error ? sqlErr.message : "";

    // If it's an API key issue, surface it immediately
    if (sqlMsg.includes("401") || sqlMsg.includes("403") || sqlMsg.includes("invalid")) {
      return {
        type: "error",
        message: `AI provider error: ${sqlMsg}\n\nCheck your API key in Settings.`,
      };
    }

    // If SQL generation/execution failed, fall back to conversational LLM
    try {
      const context = await buildContactContext(userId, query);
      const response = await callLLM(
        llmConfig,
        [{ role: "user", content: query }],
        context,
      );
      return { type: "text", message: response.content };
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : "LLM request failed";
      if (msg.includes("API") || msg.includes("401") || msg.includes("403")) {
        return {
          type: "error",
          message: `AI provider error: ${msg}\n\nCheck your API key in Settings.`,
        };
      }
      return await handleSearch(query, userId);
    }
  }
}

async function buildContactContext(userId: string, query: string): Promise<string> {
  const lines: string[] = [];

  // Get relevant contacts via search
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: searchResults } = await (supabase.rpc as any)(
    "search_contacts",
    { search_query: query, p_user_id: userId },
  );
  const results = (searchResults as unknown as SearchContactRow[]) ?? [];

  if (results.length > 0) {
    lines.push("## Matching Contacts");
    for (const c of results.slice(0, 15)) {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      const parts = [name];
      if (c.company) parts.push(`at ${c.company}`);
      if (c.job_title) parts.push(`(${c.job_title})`);
      if (c.email) parts.push(`email: ${c.email}`);
      if (c.last_contacted_at) parts.push(`last contacted: ${formatRelativeTime(c.last_contacted_at)}`);
      lines.push(`- ${parts.join(" ")}`);
    }
  }

  // Get overall stats for context
  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false);

  const { data: recentInteractions } = await supabase
    .from("interactions")
    .select("type, title, occurred_at, contact_id")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(10);

  lines.push("");
  lines.push(`## Network Summary`);
  lines.push(`Total contacts: ${totalContacts ?? 0}`);

  if (recentInteractions && recentInteractions.length > 0) {
    lines.push("");
    lines.push("## Recent Interactions");
    for (const i of recentInteractions as unknown as { type: string; title: string | null; occurred_at: string; contact_id: string }[]) {
      lines.push(`- ${i.type}: ${i.title ?? "(no title)"} (${formatRelativeTime(i.occurred_at)})`);
    }
  }

  // Get tags
  const { data: tags } = await supabase
    .from("tags")
    .select("name")
    .eq("user_id", userId);

  if (tags && tags.length > 0) {
    lines.push("");
    lines.push(`## Tags: ${(tags as unknown as { name: string }[]).map(t => t.name).join(", ")}`);
  }

  // Get entities
  const { data: entities } = await supabase
    .from("entities")
    .select("name, category")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .limit(20);

  if (entities && entities.length > 0) {
    lines.push("");
    lines.push("## Entities (Places)");
    for (const e of entities as unknown as { name: string; category: string | null }[]) {
      lines.push(`- ${e.name}${e.category ? ` (${e.category})` : ""}`);
    }
  }

  return lines.join("\n");
}

async function handleSearch(
  query: string,
  userId: string,
): Promise<AgentResponse> {
  const tool = getToolDefinitions().find((t) => t.name === "search_contacts");
  const results = (await tool!.execute({ query }, userId)) as AgentResultContact[];

  if (results.length === 0) {
    return {
      type: "text",
      message: `No results found for "${query}". Try rephrasing your question or search for a specific name, company, or tag.`,
    };
  }

  const plural = results.length === 1 ? "result" : "results";
  return {
    type: "contacts",
    message: `Found ${results.length} ${plural} for "${query}":`,
    contacts: results,
  };
}

async function handleAddContact(
  parsed: Extract<ParsedQuery, { intent: "add_contact" }>,
  userId: string,
): Promise<AgentResponse> {
  const { firstName, lastName, company, jobTitle, email, phone } = parsed;

  const tool = getToolDefinitions().find((t) => t.name === "create_contact");
  const result = (await tool!.execute(
    {
      first_name: firstName,
      last_name: lastName,
      company,
      job_title: jobTitle,
      email,
      phone,
    },
    userId,
  )) as { success: boolean; message: string; contact: AgentResultContact };

  const fullName = formatContactName(firstName, lastName);
  const details: string[] = [];
  if (company) details.push(`Company: ${company}`);
  if (jobTitle) details.push(`Title: ${jobTitle}`);
  if (email) details.push(`Email: ${email}`);
  if (phone) details.push(`Phone: ${phone}`);

  const detailStr = details.length > 0 ? "\n" + details.join("\n") : "";

  return {
    type: "action",
    message: `Created contact "${fullName}" successfully.${detailStr}`,
    actionType: "add",
    contact: result.contact,
  };
}

async function handleBulkTag(
  tagName: string,
  filter: { company?: string; source?: string },
  userId: string,
): Promise<AgentResponse> {
  const tool = getToolDefinitions().find((t) => t.name === "bulk_tag_contacts");
  const result = (await tool!.execute(
    { tag: tagName, company: filter.company, source: filter.source },
    userId,
  )) as { success: boolean; message: string; count: number; skipped: number };

  if (!result.success) {
    const filterDesc = filter.company
      ? `at "${filter.company}"`
      : `from "${filter.source}"`;
    return {
      type: "text",
      message: `No contacts found ${filterDesc} to tag.`,
    };
  }

  const filterDesc = filter.company
    ? `at "${filter.company}"`
    : `from "${filter.source}"`;

  let message = `Tagged ${result.count} contact${result.count === 1 ? "" : "s"} ${filterDesc} as "${tagName}".`;
  if (result.skipped > 0) {
    message += ` (${result.skipped} already had this tag)`;
  }

  return {
    type: "action",
    message,
    actionType: "bulk_tag",
    count: result.count,
  };
}

async function handleBulkUpdate(
  field: string,
  value: string,
  filter: { company?: string; tag?: string; source?: string },
  userId: string,
): Promise<AgentResponse> {
  const normalizedField = field.replace(/[\s-]/g, "_").toLowerCase();
  const isStandardField = STANDARD_CONTACT_FIELDS.includes(normalizedField);

  // For bulk updates, check if it's a custom field
  let isCustomField = false;
  if (!isStandardField) {
    const { data: cfData } = await supabase
      .from("custom_field_definitions")
      .select("field_key")
      .eq("user_id", userId)
      .ilike("field_key", normalizedField)
      .limit(1);
    const defs = (cfData as unknown as { field_key: string }[]) ?? [];
    if (defs.length > 0) {
      isCustomField = true;
    } else {
      return {
        type: "error",
        message: `Unknown field "${field}". Standard: ${STANDARD_CONTACT_FIELDS.join(", ")}. Or use a custom field from Settings.`,
      };
    }
  }

  // Build the contact filter query
  let contactIds: string[] = [];

  if (filter.tag) {
    // Find the tag first
    const { data: tagData, error: tagError } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${sanitizePostgrestValue(filter.tag)}%`)
      .limit(1);

    if (tagError) throw tagError;

    type TagIdRow = { id: string };
    const tags = (tagData as unknown as TagIdRow[]) ?? [];
    if (tags.length === 0) {
      return {
        type: "text",
        message: `No tag found matching "${filter.tag}".`,
      };
    }

    const { data: ctData, error: ctError } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", tags[0].id);

    if (ctError) throw ctError;

    type ContactIdTagRow = { contact_id: string };
    contactIds = ((ctData as unknown as ContactIdTagRow[]) ?? []).map((ct) => ct.contact_id);
  } else {
    let query = supabase
      .from("contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("is_archived", false);

    if (filter.company) {
      query = query.ilike("company", `%${sanitizePostgrestValue(filter.company)}%`);
    }
    if (filter.source) {
      query = query.ilike("source", sanitizePostgrestValue(filter.source));
    }

    const { data, error } = await query;
    if (error) throw error;

    type ContactIdRow = { id: string };
    contactIds = ((data as unknown as ContactIdRow[]) ?? []).map((c) => c.id);
  }

  if (contactIds.length === 0) {
    return {
      type: "text",
      message: "No contacts matched the filter criteria.",
    };
  }

  // Batch update in chunks of 200 to avoid URL length limits
  const BATCH_SIZE = 200;
  for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
    const batch = contactIds.slice(i, i + BATCH_SIZE);

    if (isCustomField) {
      // Custom fields require per-contact JSONB merge — fetch, merge, update
      const { data: batchContacts } = await supabase
        .from("contacts")
        .select("id, custom_fields")
        .in("id", batch);
      type CfRow = { id: string; custom_fields: Record<string, unknown> | null };
      const rows = (batchContacts as unknown as CfRow[]) ?? [];
      for (const row of rows) {
        const merged = { ...(row.custom_fields ?? {}), [normalizedField]: value };
        await supabase.from("contacts").update({ custom_fields: merged } as never).eq("id", row.id);
      }
    } else {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ [normalizedField]: value } as never)
        .in("id", batch);
      if (updateError) throw updateError;
    }
  }

  const filterDesc = filter.company
    ? `at "${filter.company}"`
    : filter.tag
      ? `tagged "${filter.tag}"`
      : `from "${filter.source}"`;

  return {
    type: "action",
    message: `Updated ${normalizedField} to "${value}" for ${contactIds.length} contact${contactIds.length === 1 ? "" : "s"} ${filterDesc}.`,
    actionType: "bulk_update",
    count: contactIds.length,

  };
}

async function handleArchiveContacts(
  filter: { days?: number; tag?: string; company?: string },
  userId: string,
): Promise<AgentResponse> {
  const tool = getToolDefinitions().find((t) => t.name === "archive_contacts");
  const result = (await tool!.execute(
    {
      days_inactive: filter.days,
      tag: filter.tag,
      company: filter.company,
    },
    userId,
  )) as { success: boolean; message: string; count: number };

  if (!result.success) {
    return {
      type: "text",
      message: result.message,
    };
  }

  let filterDesc: string;
  if (filter.days) filterDesc = `not contacted in ${filter.days}+ days`;
  else if (filter.tag) filterDesc = `tagged "${filter.tag}"`;
  else if (filter.company) filterDesc = `at "${filter.company}"`;
  else filterDesc = "matching the criteria";

  return {
    type: "action",
    message: `Archived ${result.count} contact${result.count === 1 ? "" : "s"} ${filterDesc}.`,
    actionType: "archive",
    count: result.count,
  };
}

async function handleEnrichContact(
  name: string,
  userId: string,
): Promise<AgentResponse> {
  // Find the contact by name
  const contacts = await findContactsByName(name, userId, 1);

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `I couldn't find anyone named "${name}" in your contacts.`,
    };
  }

  const contact = contacts[0];
  const fullName = formatContactName(contact.first_name, contact.last_name);

  // Fetch email and phone for current info display
  const { data: emailData } = await supabase
    .from("contact_emails")
    .select("email")
    .eq("contact_id", contact.id)
    .eq("is_primary", true)
    .limit(1);

  const { data: phoneData } = await supabase
    .from("contact_phones")
    .select("phone")
    .eq("contact_id", contact.id)
    .eq("is_primary", true)
    .limit(1);

  type EmailRow = { email: string };
  type PhoneRow = { phone: string };
  const emails = (emailData as unknown as EmailRow[]) ?? [];
  const phones = (phoneData as unknown as PhoneRow[]) ?? [];

  const infoLines: string[] = [`Current info for ${fullName}:`];
  if (contact.company) infoLines.push(`Company: ${contact.company}`);
  if (contact.job_title) infoLines.push(`Title: ${contact.job_title}`);
  if (emails.length > 0) infoLines.push(`Email: ${emails[0].email}`);
  if (phones.length > 0) infoLines.push(`Phone: ${phones[0].phone}`);
  if (infoLines.length === 1) infoLines.push("No details on file yet.");

  infoLines.push("");
  // TODO: Future enhancement - use the user's API key + web search to fetch
  // LinkedIn/company data and auto-populate missing fields on the contact.
  infoLines.push(
    "Web research requires an API key. Configure your AI provider in Settings to enable contact enrichment.",
  );

  return {
    type: "action",
    message: infoLines.join("\n"),
    actionType: "enrich",
    contact,
  };
}

// ============================================================
// Action execution router (used by both Auto mode and after HITL approval)
// ============================================================

async function executeAction(
  parsed: ParsedQuery,
  userId: string,
): Promise<AgentResponse> {
  switch (parsed.intent) {
    case "add_contact":
      return await handleAddContact(parsed, userId);
    case "update_contact":
      return await handleUpdateContact(parsed.name, parsed.field, parsed.value, userId);
    case "bulk_tag":
      return await handleBulkTag(parsed.tag, parsed.filter, userId);
    case "bulk_update":
      return await handleBulkUpdate(parsed.field, parsed.value, parsed.filter, userId);
    case "archive_contacts":
      return await handleArchiveContacts(parsed.filter, userId);
    case "enrich_contact":
      return await handleEnrichContact(parsed.name, userId);
    case "link_contacts":
      return await handleLinkContacts(parsed.nameA, parsed.nameB, parsed.relationship, userId);
    case "create_entity":
      return await handleCreateEntity(parsed.name, parsed.category, parsed.address, userId);
    case "add_entity_person":
      return await handleAddEntityPerson(parsed.entityName, parsed.personName, parsed.role, userId);
    case "promote_person":
      return await handlePromotePerson(parsed.personName, parsed.entityName, userId);
    default:
      return { type: "error", message: "Unknown action type." };
  }
}

// ============================================================
// Update single contact
// ============================================================

const STANDARD_CONTACT_FIELDS = [
  "company", "job_title", "department", "notes", "email", "phone",
  "first_name", "last_name", "source", "birthday",
];

async function handleUpdateContact(
  name: string,
  field: string,
  value: string,
  userId: string,
): Promise<AgentResponse> {
  const normalizedField = field.replace(/[\s-]/g, "_").toLowerCase();
  const isStandardField = STANDARD_CONTACT_FIELDS.includes(normalizedField);

  // If not a standard field, check if it's a custom field
  let isCustomField = false;
  if (!isStandardField) {
    const { data: cfData } = await supabase
      .from("custom_field_definitions")
      .select("field_key")
      .eq("user_id", userId)
      .ilike("field_key", normalizedField)
      .limit(1);
    const defs = (cfData as unknown as { field_key: string }[]) ?? [];
    if (defs.length > 0) {
      isCustomField = true;
    } else {
      // Also try matching by display name
      const { data: cfByName } = await supabase
        .from("custom_field_definitions")
        .select("field_key")
        .eq("user_id", userId)
        .ilike("name", `%${sanitizePostgrestValue(field)}%`)
        .limit(1);
      const defsByName = (cfByName as unknown as { field_key: string }[]) ?? [];
      if (defsByName.length > 0) {
        isCustomField = true;
      } else {
        return { type: "error", message: `Unknown field "${field}". Standard fields: ${STANDARD_CONTACT_FIELDS.join(", ")}. You can also update any custom field you've defined in Settings.` };
      }
    }
  }

  const { data: contactData, error: findError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url, custom_fields")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(`first_name.ilike.%${sanitizePostgrestValue(name)}%,last_name.ilike.%${sanitizePostgrestValue(name)}%`)
    .limit(1);

  if (findError) throw findError;
  type ContactWithCustom = AgentResultContact & { custom_fields: Record<string, unknown> };
  const contacts = (contactData as unknown as ContactWithCustom[]) ?? [];
  if (contacts.length === 0) {
    return { type: "text", message: `Couldn't find a contact matching "${name}".` };
  }

  const contact = contacts[0];
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  if (normalizedField === "email") {
    await supabase.from("contact_emails").upsert(
      { contact_id: contact.id, email: value, label: "work", is_primary: true } as never,
      { onConflict: "contact_id,email" as never }
    );
  } else if (normalizedField === "phone") {
    await supabase.from("contact_phones").upsert(
      { contact_id: contact.id, phone: value, label: "mobile", is_primary: true } as never,
      { onConflict: "contact_id,phone" as never }
    );
  } else if (isCustomField) {
    const existingCustom = (contact.custom_fields as Record<string, unknown>) ?? {};
    const updated = { ...existingCustom, [normalizedField]: value };
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ custom_fields: updated } as never)
      .eq("id", contact.id);
    if (updateError) throw updateError;
  } else {
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ [normalizedField]: value } as never)
      .eq("id", contact.id);
    if (updateError) throw updateError;
  }

  return {
    type: "action",
    message: `Updated ${field} to "${value}" for ${fullName}.`,
    actionType: "update",
    contact,
  };
}

// ============================================================
// Link two contacts with a relationship
// ============================================================

async function handleLinkContacts(
  nameA: string,
  nameB: string,
  relationshipName: string | undefined,
  userId: string,
): Promise<AgentResponse> {
  // Find contact A and B by name
  const contactsA = await findContactsByName(nameA, userId, 1);
  if (contactsA.length === 0) {
    return { type: "text", message: `Couldn't find a contact matching "${nameA}".` };
  }

  const contactsB = await findContactsByName(nameB, userId, 1);
  if (contactsB.length === 0) {
    return { type: "text", message: `Couldn't find a contact matching "${nameB}".` };
  }

  const a = contactsA[0];
  const b = contactsB[0];

  if (a.id === b.id) {
    return { type: "text", message: "Can't link a contact to themselves." };
  }

  // Delegate to the link_contacts tool for relationship type resolution and insert
  const tool = getToolDefinitions().find((t) => t.name === "link_contacts");
  const result = (await tool!.execute(
    {
      contact_a_id: a.id,
      contact_b_id: b.id,
      relationship: relationshipName,
    },
    userId,
  )) as { success: boolean; message: string };

  if (!result.success) {
    return { type: "text", message: result.message };
  }

  const nameAFull = formatContactName(a.first_name, a.last_name);
  const nameBFull = formatContactName(b.first_name, b.last_name);

  return {
    type: "action",
    message: `Linked ${nameAFull} and ${nameBFull}${relationshipName ? ` as ${relationshipName}` : ""}.`,
    actionType: "link",
    count: 2,
  };
}

// ============================================================
// Entity handlers
// ============================================================

type EntityRow = Tables<"entities">;
type EntityPersonRow = Tables<"entity_people">;

async function handleEntityLookup(
  query: string,
  userId: string,
): Promise<AgentResponse> {
  // Map common plural/singular words to category search
  const categoryMap: Record<string, string> = {
    restaurants: "restaurant",
    restaurant: "restaurant",
    gyms: "gym",
    gym: "gym",
    companies: "company",
    company: "company",
    clubs: "club",
    club: "club",
    schools: "school",
    school: "school",
    churches: "church",
    church: "church",
    stores: "store",
    store: "store",
    places: "",
    place: "",
    entities: "",
    entity: "",
    organizations: "",
    organization: "",
  };

  let category: string | undefined;
  let searchQuery: string | undefined;

  if (query) {
    const categorySearch = categoryMap[query.toLowerCase()];
    if (categorySearch !== undefined && categorySearch !== "") {
      category = categorySearch;
    } else if (categorySearch === undefined) {
      searchQuery = query;
    }
    // If categorySearch === "", show all entities (no filter)
  }

  const tool = getToolDefinitions().find((t) => t.name === "list_entities");
  const entities = (await tool!.execute(
    { category, query: searchQuery },
    userId,
  )) as EntityResult[];

  if (entities.length === 0) {
    const suffix = query ? ` matching "${query}"` : "";
    return {
      type: "text",
      message: `No entities found${suffix}. You can add one with "add a restaurant called ..."`,
    };
  }

  const plural = entities.length === 1 ? "entity" : "entities";
  const suffix = query ? ` matching "${query}"` : "";
  return {
    type: "entities",
    message: `Found ${entities.length} ${plural}${suffix}:`,
    entities,
  };
}

async function handleCreateEntity(
  name: string,
  category: string | undefined,
  address: string | undefined,
  userId: string,
): Promise<AgentResponse> {
  const tool = getToolDefinitions().find((t) => t.name === "create_entity");
  await tool!.execute({ name, category, address }, userId);

  const details: string[] = [];
  if (category) details.push(`Category: ${category}`);
  if (address) details.push(`Address: ${address}`);
  const detailStr = details.length > 0 ? "\n" + details.join("\n") : "";

  return {
    type: "action",
    message: `Created entity "${name}" successfully.${detailStr}`,
    actionType: "create_entity",
  };
}

async function handleAddEntityPerson(
  entityName: string,
  personName: string,
  role: string | undefined,
  userId: string,
): Promise<AgentResponse> {
  // Find the entity by name to get its ID
  const { data: entityData, error: entityError } = await supabase
    .from("entities")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .ilike("name", `%${sanitizePostgrestValue(entityName)}%`)
    .limit(1);

  if (entityError) throw entityError;

  type EntitySlim = { id: string; name: string };
  const entities = (entityData as unknown as EntitySlim[]) ?? [];

  if (entities.length === 0) {
    return {
      type: "text",
      message: `Couldn't find an entity matching "${entityName}". Create it first with "add a place called ${entityName}".`,
    };
  }

  const entity = entities[0];

  // Parse person name into first/last
  const nameParts = personName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  const tool = getToolDefinitions().find((t) => t.name === "add_entity_person");
  await tool!.execute(
    { entity_id: entity.id, first_name: firstName, last_name: lastName, role },
    userId,
  );

  return {
    type: "action",
    message: `Added ${personName} to "${entity.name}"${role ? ` as ${role}` : ""}.`,
    actionType: "add_entity_person",
  };
}

async function handlePromotePerson(
  personName: string,
  entityName: string,
  userId: string,
): Promise<AgentResponse> {
  // Find the entity
  const { data: entityData, error: entityError } = await supabase
    .from("entities")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .ilike("name", `%${sanitizePostgrestValue(entityName)}%`)
    .limit(1);

  if (entityError) throw entityError;

  const entities = (entityData as unknown as EntityRow[]) ?? [];
  if (entities.length === 0) {
    return {
      type: "text",
      message: `Couldn't find an entity matching "${entityName}".`,
    };
  }

  const entity = entities[0];

  // Find the person within the entity
  const { data: peopleData, error: peopleError } = await supabase
    .from("entity_people")
    .select("*")
    .eq("entity_id", entity.id)
    .or(
      `first_name.ilike.%${sanitizePostgrestValue(personName)}%,last_name.ilike.%${sanitizePostgrestValue(personName)}%`,
    )
    .limit(1);

  if (peopleError) throw peopleError;

  const people = (peopleData as unknown as EntityPersonRow[]) ?? [];
  if (people.length === 0) {
    return {
      type: "text",
      message: `Couldn't find anyone named "${personName}" at "${entity.name}".`,
    };
  }

  const person = people[0];

  if (person.promoted_contact_id) {
    return {
      type: "text",
      message: `${personName} has already been promoted to a contact.`,
    };
  }

  const contact = await promotePersonToContact(person, entity, userId);
  const fullName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ");

  return {
    type: "action",
    message: `Promoted ${fullName} from "${entity.name}" to a full contact.`,
    actionType: "promote_person",
    contact: {
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      company: contact.company,
      job_title: contact.job_title,
      avatar_url: contact.avatar_url,
    },
  };
}

// ============================================================
// HITL helpers: preview what an action will do without executing
// ============================================================

async function getAffectedCount(
  parsed: ParsedQuery,
  userId: string,
): Promise<number> {
  // For add/enrich/link/entity intents, the count is trivial
  if (parsed.intent === "add_contact") return 1;
  if (parsed.intent === "enrich_contact") return 1;
  if (parsed.intent === "update_contact") return 1;
  if (parsed.intent === "link_contacts") return 2;
  if (parsed.intent === "create_entity") return 1;
  if (parsed.intent === "add_entity_person") return 1;
  if (parsed.intent === "promote_person") return 1;

  // For bulk ops, do a count query
  if (parsed.intent === "bulk_tag" || parsed.intent === "bulk_update") {
    const filter = parsed.filter;
    let query = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_archived", false);
    if (filter.company) query = query.ilike("company", `%${sanitizePostgrestValue(filter.company)}%`);
    if (filter.source) query = query.eq("source", sanitizePostgrestValue(filter.source));
    if ("tag" in filter && filter.tag) {
      const { data: tagData } = await supabase
        .from("tags").select("id").eq("user_id", userId).ilike("name", `%${sanitizePostgrestValue(filter.tag)}%`).limit(1);
      const tags = (tagData as unknown as { id: string }[]) ?? [];
      if (tags[0]) {
        const { count } = await supabase
          .from("contact_tags").select("contact_id", { count: "exact", head: true }).eq("tag_id", tags[0].id);
        return count ?? 0;
      }
      return 0;
    }
    const { count } = await query;
    return count ?? 0;
  }

  if (parsed.intent === "archive_contacts") {
    let query = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_archived", false);
    if (parsed.filter.days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parsed.filter.days);
      query = query.or(`last_contacted_at.is.null,last_contacted_at.lt.${cutoff.toISOString()}`);
    }
    if (parsed.filter.company) query = query.ilike("company", `%${sanitizePostgrestValue(parsed.filter.company)}%`);
    const { count } = await query;
    return count ?? 0;
  }

  return 0;
}

async function getAffectedContacts(
  parsed: ParsedQuery,
  userId: string,
): Promise<AgentResultContact[]> {
  switch (parsed.intent) {
    case "add_contact":
      return [{
        id: "new",
        first_name: parsed.firstName,
        last_name: parsed.lastName ?? null,
        company: parsed.company ?? null,
        job_title: parsed.jobTitle ?? null,
        avatar_url: null,
      }];

    case "update_contact": {
      return await findContactsByName(parsed.name, userId, 5);
    }

    case "bulk_tag":
    case "bulk_update": {
      const filter = parsed.intent === "bulk_tag" ? parsed.filter : parsed.filter;
      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, company, job_title, avatar_url")
        .eq("user_id", userId)
        .eq("is_archived", false);
      if (filter.company) query = query.ilike("company", `%${sanitizePostgrestValue(filter.company)}%`);
      if (filter.source) query = query.eq("source", sanitizePostgrestValue(filter.source));
      if ("tag" in filter && filter.tag) {
        const { data: tagData } = await supabase
          .from("tags").select("id").eq("user_id", userId).ilike("name", `%${sanitizePostgrestValue(filter.tag as string)}%`).limit(1);
        const tags = (tagData as unknown as { id: string }[]) ?? [];
        if (tags[0]) {
          const { data: ctData } = await supabase
            .from("contact_tags").select("contact_id").eq("tag_id", tags[0].id);
          const ids = ((ctData as unknown as { contact_id: string }[]) ?? []).map(c => c.contact_id);
          if (ids.length > 0) query = query.in("id", ids);
          else return [];
        }
      }
      const { data } = await query.order("first_name").limit(20);
      return (data as unknown as AgentResultContact[]) ?? [];
    }

    case "archive_contacts": {
      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, company, job_title, avatar_url")
        .eq("user_id", userId)
        .eq("is_archived", false);
      if (parsed.filter.days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parsed.filter.days);
        query = query.or(`last_contacted_at.is.null,last_contacted_at.lt.${cutoff.toISOString()}`);
      }
      if (parsed.filter.company) query = query.ilike("company", `%${sanitizePostgrestValue(parsed.filter.company)}%`);
      const { data } = await query.order("first_name").limit(20);
      return (data as unknown as AgentResultContact[]) ?? [];
    }

    case "enrich_contact": {
      return await findContactsByName(parsed.name, userId, 1);
    }

    case "link_contacts": {
      const a = await findContactsByName(parsed.nameA, userId, 1);
      const b = await findContactsByName(parsed.nameB, userId, 1);
      return [...a, ...b];
    }

    case "create_entity":
      return [{
        id: "new",
        first_name: parsed.name,
        last_name: null,
        company: parsed.category ?? null,
        job_title: null,
        avatar_url: null,
      }];

    case "add_entity_person":
      return [{
        id: "new",
        first_name: parsed.personName,
        last_name: null,
        company: parsed.entityName,
        job_title: parsed.role ?? null,
        avatar_url: null,
      }];

    case "promote_person":
      return [{
        id: "new",
        first_name: parsed.personName,
        last_name: null,
        company: parsed.entityName,
        job_title: null,
        avatar_url: null,
      }];

    default:
      return [];
  }
}

function describeAction(parsed: ParsedQuery): string {
  switch (parsed.intent) {
    case "add_contact":
      return `Add new contact: ${parsed.firstName}${parsed.lastName ? " " + parsed.lastName : ""}${parsed.company ? " at " + parsed.company : ""}`;
    case "update_contact":
      return `Update ${parsed.field} to "${parsed.value}" for ${parsed.name}`;
    case "bulk_tag": {
      const target = parsed.filter.company ? `contacts at ${parsed.filter.company}` : `${parsed.filter.source} contacts`;
      return `Tag ${target} as "${parsed.tag}"`;
    }
    case "bulk_update": {
      const target = parsed.filter.company ? `contacts at ${parsed.filter.company}` : parsed.filter.tag ? `contacts tagged ${parsed.filter.tag}` : `${parsed.filter.source} contacts`;
      return `Update ${parsed.field} to "${parsed.value}" for ${target}`;
    }
    case "archive_contacts": {
      if (parsed.filter.days) return `Archive contacts not reached in ${parsed.filter.days}+ days`;
      if (parsed.filter.tag) return `Archive contacts tagged "${parsed.filter.tag}"`;
      if (parsed.filter.company) return `Archive contacts at "${parsed.filter.company}"`;
      return "Archive contacts";
    }
    case "enrich_contact":
      return `Research and enrich ${parsed.name}'s profile`;
    case "link_contacts":
      return `Link ${parsed.nameA} and ${parsed.nameB}${parsed.relationship ? ` as ${parsed.relationship}` : ""}`;
    case "create_entity":
      return `Create entity: ${parsed.name}${parsed.category ? ` (${parsed.category})` : ""}`;
    case "add_entity_person":
      return `Add ${parsed.personName} to ${parsed.entityName}${parsed.role ? ` as ${parsed.role}` : ""}`;
    case "promote_person":
      return `Promote ${parsed.personName} from ${parsed.entityName} to a contact`;
    default:
      return "Unknown action";
  }
}

function describeActionDetails(parsed: ParsedQuery): string | undefined {
  switch (parsed.intent) {
    case "update_contact":
      return `${parsed.field} → "${parsed.value}"`;
    case "bulk_tag":
      return `Tag: "${parsed.tag}"`;
    case "bulk_update":
      return `${parsed.field} → "${parsed.value}"`;
    case "link_contacts":
      return parsed.relationship ? `Relationship: ${parsed.relationship}` : undefined;
    case "create_entity":
      return parsed.category ? `Category: ${parsed.category}` : undefined;
    case "add_entity_person":
      return parsed.role ? `Role: ${parsed.role}` : undefined;
    default:
      return undefined;
  }
}
