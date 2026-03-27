/**
 * Agent: execute parsed query intents against Supabase and return
 * formatted results for the chat interface.
 */

import { supabase } from "@/lib/supabase";
import type { ParsedQuery } from "@/lib/queryParser";
import { formatRelativeTime } from "@/lib/utils";
import type { Tables } from "@/types/database";
import {
  createEntity,
  addPersonToEntity,
  promotePersonToContact,
} from "@/lib/entities";

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
  | { type: "entities"; message: string; entities: EntityResult[] };

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
 */
export async function executeQuery(
  parsed: ParsedQuery,
  userId: string,
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
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .ilike("company", `%${company}%`)
    .order("first_name")
    .limit(20);

  if (error) throw error;

  const contacts = (data as unknown as AgentResultContact[]) ?? [];

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `I couldn't find any contacts at "${company}". Try checking the spelling or searching for a different company.`,
    };
  }

  const plural = contacts.length === 1 ? "contact" : "contacts";
  return {
    type: "contacts",
    message: `Found ${contacts.length} ${plural} at "${company}":`,
    contacts,
  };
}

async function handleLastContact(
  name: string,
  userId: string,
): Promise<AgentResponse> {
  // First, find contacts matching the name
  const { data: contactData, error: contactError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(
      `first_name.ilike.%${name}%,last_name.ilike.%${name}%`,
    )
    .limit(5);

  if (contactError) throw contactError;

  const contacts = (contactData as unknown as AgentResultContact[]) ?? [];

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `I couldn't find anyone named "${name}" in your contacts.`,
    };
  }

  // Find the most recent interaction for the first matched contact
  const contact = contacts[0];
  const fullName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ");

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
    .ilike("name", `%${tagName}%`)
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
  const { data: contactData, error: contactError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(
      `first_name.ilike.%${name}%,last_name.ilike.%${name}%`,
    )
    .limit(1);

  if (contactError) throw contactError;

  type ContactSlim = { id: string; first_name: string; last_name: string | null };
  const contacts = (contactData as unknown as ContactSlim[]) ?? [];

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `I couldn't find anyone named "${name}" in your contacts.`,
    };
  }

  const contact = contacts[0];
  const fullName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ");

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
  // Total contacts
  const { count: totalContacts, error: countError } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (countError) throw countError;

  // Contacted this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: contactedThisWeek, error: weekError } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false)
    .gte("last_contacted_at", weekAgo.toISOString());

  if (weekError) throw weekError;

  // Stale contacts (not contacted in 30 days)
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const { count: staleContacts, error: staleError } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(
      `last_contacted_at.is.null,last_contacted_at.lt.${thirtyAgo.toISOString()}`,
    );

  if (staleError) throw staleError;

  // Top companies
  const { data: companyRaw, error: companyError } = await supabase
    .from("contacts")
    .select("company")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .not("company", "is", null)
    .not("company", "eq", "");

  if (companyError) throw companyError;

  type CompanyRow = { company: string | null };
  const companyData = (companyRaw as unknown as CompanyRow[]) ?? [];

  const companyCounts = new Map<string, number>();
  for (const row of companyData) {
    if (row.company) {
      const key = row.company;
      companyCounts.set(key, (companyCounts.get(key) ?? 0) + 1);
    }
  }
  const topCompanies = [...companyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([company, count]) => ({ company, count }));

  // Source breakdown
  const { data: sourceRaw, error: sourceError } = await supabase
    .from("contacts")
    .select("source")
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (sourceError) throw sourceError;

  type SourceRow = { source: string | null };
  const sourceData = (sourceRaw as unknown as SourceRow[]) ?? [];

  const sourceCounts = new Map<string, number>();
  for (const row of sourceData) {
    const key = row.source ?? "unknown";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sourceBreakdown = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }));

  const stats: StatsResult = {
    totalContacts: totalContacts ?? 0,
    contactedThisWeek: contactedThisWeek ?? 0,
    staleContacts: staleContacts ?? 0,
    topCompanies,
    sourceBreakdown,
  };

  // Format a text summary
  const lines: string[] = [];
  lines.push(`You have ${stats.totalContacts} contacts in your network.`);
  lines.push(`${stats.contactedThisWeek} contacted this week.`);
  lines.push(`${stats.staleContacts} need follow-up (30+ days).`);

  if (topCompanies.length > 0) {
    lines.push("");
    lines.push("Top companies:");
    for (const c of topCompanies) {
      lines.push(`  ${c.company} (${c.count})`);
    }
  }

  if (sourceBreakdown.length > 0) {
    lines.push("");
    lines.push("Sources:");
    for (const s of sourceBreakdown) {
      lines.push(`  ${s.source}: ${s.count}`);
    }
  }

  return {
    type: "stats",
    message: lines.join("\n"),
    stats,
  };
}

async function handleSearch(
  query: string,
  userId: string,
): Promise<AgentResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "search_contacts",
    {
      search_query: query,
      p_user_id: userId,
    },
  );

  if (error) throw error;

  const rows = (data as unknown as SearchContactRow[]) ?? [];

  const contacts: AgentResultContact[] = rows.map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    company: row.company,
    job_title: row.job_title,
    avatar_url: row.avatar_url,
  }));

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `No results found for "${query}". Try rephrasing your question or search for a specific name, company, or tag.`,
    };
  }

  const plural = contacts.length === 1 ? "result" : "results";
  return {
    type: "contacts",
    message: `Found ${contacts.length} ${plural} for "${query}":`,
    contacts,
  };
}

async function handleAddContact(
  parsed: Extract<ParsedQuery, { intent: "add_contact" }>,
  userId: string,
): Promise<AgentResponse> {
  const { firstName, lastName, company, jobTitle, email, phone } = parsed;

  // Insert the contact
  const { data: contactData, error: contactError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName ?? null,
      company: company ?? null,
      job_title: jobTitle ?? null,
      source: "agent",
    })
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .single();

  if (contactError) throw contactError;

  const contact = contactData as unknown as AgentResultContact;

  // Insert email if provided
  if (email) {
    const { error: emailError } = await supabase
      .from("contact_emails")
      .insert({
        contact_id: contact.id,
        email,
        label: "work",
        is_primary: true,
      });
    if (emailError) throw emailError;
  }

  // Insert phone if provided
  if (phone) {
    const { error: phoneError } = await supabase
      .from("contact_phones")
      .insert({
        contact_id: contact.id,
        phone,
        label: "work",
        is_primary: true,
      });
    if (phoneError) throw phoneError;
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
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
    contact,
  };
}

async function handleBulkTag(
  tagName: string,
  filter: { company?: string; source?: string },
  userId: string,
): Promise<AgentResponse> {
  // Find or create the tag
  let tagId: string;
  const { data: existingTag, error: tagLookupError } = await supabase
    .from("tags")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", tagName)
    .limit(1);

  if (tagLookupError) throw tagLookupError;

  type TagIdRow = { id: string };
  const existingTags = (existingTag as unknown as TagIdRow[]) ?? [];

  if (existingTags.length > 0) {
    tagId = existingTags[0].id;
  } else {
    // Create the tag
    const { data: newTag, error: tagCreateError } = await supabase
      .from("tags")
      .insert({ user_id: userId, name: tagName })
      .select("id")
      .single();

    if (tagCreateError) throw tagCreateError;
    tagId = (newTag as unknown as TagIdRow).id;
  }

  // Find contacts matching the filter
  let query = supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (filter.company) {
    query = query.ilike("company", `%${filter.company}%`);
  }
  if (filter.source) {
    query = query.ilike("source", filter.source);
  }

  const { data: contactData, error: contactError } = await query;
  if (contactError) throw contactError;

  type ContactIdRow = { id: string };
  const contacts = (contactData as unknown as ContactIdRow[]) ?? [];

  if (contacts.length === 0) {
    const filterDesc = filter.company
      ? `at "${filter.company}"`
      : `from "${filter.source}"`;
    return {
      type: "text",
      message: `No contacts found ${filterDesc} to tag.`,
    };
  }

  // Get existing contact_tags for this tag to avoid duplicates
  const { data: existingCtData, error: existingCtError } = await supabase
    .from("contact_tags")
    .select("contact_id")
    .eq("tag_id", tagId)
    .in("contact_id", contacts.map((c) => c.id));

  if (existingCtError) throw existingCtError;

  type ContactIdTagRow = { contact_id: string };
  const existingContactIds = new Set(
    ((existingCtData as unknown as ContactIdTagRow[]) ?? []).map((ct) => ct.contact_id),
  );

  // Insert contact_tags for contacts that don't already have the tag
  const newContactTags = contacts
    .filter((c) => !existingContactIds.has(c.id))
    .map((c) => ({ contact_id: c.id, tag_id: tagId }));

  if (newContactTags.length > 0) {
    const { error: insertError } = await supabase
      .from("contact_tags")
      .insert(newContactTags);
    if (insertError) throw insertError;
  }

  const taggedCount = newContactTags.length;
  const skippedCount = existingContactIds.size;
  const filterDesc = filter.company
    ? `at "${filter.company}"`
    : `from "${filter.source}"`;

  let message = `Tagged ${taggedCount} contact${taggedCount === 1 ? "" : "s"} ${filterDesc} as "${tagName}".`;
  if (skippedCount > 0) {
    message += ` (${skippedCount} already had this tag)`;
  }

  return {
    type: "action",
    message,
    actionType: "bulk_tag",
    count: taggedCount,
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
      .ilike("name", `%${filter.tag}%`)
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
      query = query.ilike("company", `%${filter.company}%`);
    }
    if (filter.source) {
      query = query.ilike("source", filter.source);
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
    needsConfirmation: true,
  };
}

async function handleArchiveContacts(
  filter: { days?: number; tag?: string; company?: string },
  userId: string,
): Promise<AgentResponse> {
  let contactIds: string[] = [];

  if (filter.days) {
    // Find contacts not contacted in N days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filter.days);

    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .or(
        `last_contacted_at.is.null,last_contacted_at.lt.${cutoff.toISOString()}`,
      );

    if (error) throw error;

    type ContactIdRow = { id: string };
    contactIds = ((data as unknown as ContactIdRow[]) ?? []).map((c) => c.id);
  } else if (filter.tag) {
    // Find contacts by tag
    const { data: tagData, error: tagError } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${filter.tag}%`)
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
    const taggedContactIds = ((ctData as unknown as ContactIdTagRow[]) ?? []).map(
      (ct) => ct.contact_id,
    );

    if (taggedContactIds.length === 0) {
      return {
        type: "text",
        message: `No contacts are tagged "${filter.tag}".`,
      };
    }

    // Only archive non-archived contacts
    const { data: activeData, error: activeError } = await supabase
      .from("contacts")
      .select("id")
      .in("id", taggedContactIds)
      .eq("user_id", userId)
      .eq("is_archived", false);

    if (activeError) throw activeError;

    type ContactIdRow = { id: string };
    contactIds = ((activeData as unknown as ContactIdRow[]) ?? []).map((c) => c.id);
  } else if (filter.company) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .ilike("company", `%${filter.company}%`);

    if (error) throw error;

    type ContactIdRow = { id: string };
    contactIds = ((data as unknown as ContactIdRow[]) ?? []).map((c) => c.id);
  }

  if (contactIds.length === 0) {
    return {
      type: "text",
      message: "No contacts matched the archive criteria.",
    };
  }

  // Set is_archived = true on all matched contacts
  const { error: updateError } = await supabase
    .from("contacts")
    .update({ is_archived: true })
    .in("id", contactIds);

  if (updateError) throw updateError;

  let filterDesc: string;
  if (filter.days) filterDesc = `not contacted in ${filter.days}+ days`;
  else if (filter.tag) filterDesc = `tagged "${filter.tag}"`;
  else if (filter.company) filterDesc = `at "${filter.company}"`;
  else filterDesc = "matching the criteria";

  return {
    type: "action",
    message: `Archived ${contactIds.length} contact${contactIds.length === 1 ? "" : "s"} ${filterDesc}.`,
    actionType: "archive",
    count: contactIds.length,
    needsConfirmation: true,
  };
}

async function handleEnrichContact(
  name: string,
  userId: string,
): Promise<AgentResponse> {
  // Find the contact by name
  const { data: contactData, error: contactError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(
      `first_name.ilike.%${name}%,last_name.ilike.%${name}%`,
    )
    .limit(1);

  if (contactError) throw contactError;

  const contacts = (contactData as unknown as AgentResultContact[]) ?? [];

  if (contacts.length === 0) {
    return {
      type: "text",
      message: `I couldn't find anyone named "${name}" in your contacts.`,
    };
  }

  const contact = contacts[0];
  const fullName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ");

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
        .ilike("name", `%${field}%`)
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
    .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
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
  // Find contact A
  const { data: dataA, error: errA } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .eq("user_id", userId).eq("is_archived", false)
    .or(`first_name.ilike.%${nameA}%,last_name.ilike.%${nameA}%`)
    .limit(1);
  if (errA) throw errA;
  const contactsA = (dataA as unknown as AgentResultContact[]) ?? [];
  if (contactsA.length === 0) {
    return { type: "text", message: `Couldn't find a contact matching "${nameA}".` };
  }

  // Find contact B
  const { data: dataB, error: errB } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .eq("user_id", userId).eq("is_archived", false)
    .or(`first_name.ilike.%${nameB}%,last_name.ilike.%${nameB}%`)
    .limit(1);
  if (errB) throw errB;
  const contactsB = (dataB as unknown as AgentResultContact[]) ?? [];
  if (contactsB.length === 0) {
    return { type: "text", message: `Couldn't find a contact matching "${nameB}".` };
  }

  const a = contactsA[0];
  const b = contactsB[0];

  if (a.id === b.id) {
    return { type: "text", message: "Can't link a contact to themselves." };
  }

  // Find the relationship type — check both name and reverse_name for direction
  type RelType = { id: string; name: string; reverse_name: string | null; is_symmetric: boolean };
  let relTypeId: string | null = null;
  let swapDirection = false;

  if (relationshipName) {
    const rn = relationshipName.toLowerCase();

    // Fetch all visible types to find the best match
    const { data: allTypes } = await supabase
      .from("relationship_types")
      .select("id, name, reverse_name, is_symmetric")
      .or(`user_id.eq.${userId},is_system.eq.true`);
    const types = (allTypes as unknown as RelType[]) ?? [];

    // Try exact match on name first
    const nameMatch = types.find((t) => t.name.toLowerCase() === rn);
    if (nameMatch) {
      relTypeId = nameMatch.id;
    } else {
      // Try match on reverse_name — if matched, swap A and B
      const reverseMatch = types.find(
        (t) => t.reverse_name && t.reverse_name.toLowerCase() === rn,
      );
      if (reverseMatch) {
        relTypeId = reverseMatch.id;
        if (!reverseMatch.is_symmetric) {
          swapDirection = true;
        }
      } else {
        // Fuzzy match on name
        const fuzzy = types.find((t) => t.name.toLowerCase().includes(rn) || rn.includes(t.name.toLowerCase()));
        if (fuzzy) {
          relTypeId = fuzzy.id;
        }
      }
    }
  }

  // Default to "Friend" if no type specified or not found
  if (!relTypeId) {
    const { data: defaultType } = await supabase
      .from("relationship_types")
      .select("id")
      .eq("is_system", true)
      .eq("name", "Friend")
      .limit(1);
    const defaults = (defaultType as unknown as { id: string }[]) ?? [];
    if (defaults.length > 0) {
      relTypeId = defaults[0].id;
    } else {
      return { type: "error", message: "No relationship types available." };
    }
  }

  // For asymmetric relationships: A is the "name" side, B is the "reverse_name" side
  // e.g., "John is Jane's parent" → John=A(Parent), Jane=B(Child)
  // If the user said the reverse_name, swap so the direction is correct
  const contactA = swapDirection ? b : a;
  const contactB = swapDirection ? a : b;

  // Create the relationship
  const { error: insertErr } = await supabase
    .from("contact_relationships")
    .insert({
      contact_a_id: contactA.id,
      contact_b_id: contactB.id,
      relationship_type_id: relTypeId,
    } as never);

  if (insertErr) {
    if (insertErr.message?.includes("duplicate") || insertErr.message?.includes("unique")) {
      return { type: "text", message: `${[a.first_name, a.last_name].filter(Boolean).join(" ")} and ${[b.first_name, b.last_name].filter(Boolean).join(" ")} are already linked.` };
    }
    throw insertErr;
  }

  const nameAFull = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const nameBFull = [b.first_name, b.last_name].filter(Boolean).join(" ");

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
  let dbQuery = supabase
    .from("entities")
    .select("*, entity_people(id)")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("name");

  if (query) {
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

    const categorySearch = categoryMap[query.toLowerCase()];
    if (categorySearch !== undefined && categorySearch !== "") {
      dbQuery = dbQuery.ilike("category", `%${categorySearch}%`);
    } else if (categorySearch === undefined) {
      // Freeform search
      dbQuery = dbQuery.or(
        `name.ilike.%${query}%,category.ilike.%${query}%`,
      );
    }
    // If categorySearch === "", show all entities
  }

  const { data, error } = await dbQuery.limit(20);
  if (error) throw error;

  type RawEntity = EntityRow & { entity_people: { id: string }[] };
  const rawEntities = (data ?? []) as unknown as RawEntity[];

  const entities: EntityResult[] = rawEntities.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    address: e.address,
    phone: e.phone,
    people_count: e.entity_people?.length ?? 0,
  }));

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
  const entity = await createEntity(userId, {
    name,
    category: category ?? null,
    address: address ?? null,
  });

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
  // Find the entity by name
  const { data: entityData, error: entityError } = await supabase
    .from("entities")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .ilike("name", `%${entityName}%`)
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

  await addPersonToEntity(entity.id, userId, {
    first_name: firstName,
    last_name: lastName,
    role: role ?? null,
  });

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
    .ilike("name", `%${entityName}%`)
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
      `first_name.ilike.%${personName}%,last_name.ilike.%${personName}%`,
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
    if (filter.company) query = query.ilike("company", `%${filter.company}%`);
    if (filter.source) query = query.eq("source", filter.source);
    if ("tag" in filter && filter.tag) {
      const { data: tagData } = await supabase
        .from("tags").select("id").eq("user_id", userId).ilike("name", `%${filter.tag}%`).limit(1);
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
    if (parsed.filter.company) query = query.ilike("company", `%${parsed.filter.company}%`);
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
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company, job_title, avatar_url")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .or(`first_name.ilike.%${parsed.name}%,last_name.ilike.%${parsed.name}%`)
        .limit(5);
      return (data as unknown as AgentResultContact[]) ?? [];
    }

    case "bulk_tag":
    case "bulk_update": {
      const filter = parsed.intent === "bulk_tag" ? parsed.filter : parsed.filter;
      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, company, job_title, avatar_url")
        .eq("user_id", userId)
        .eq("is_archived", false);
      if (filter.company) query = query.ilike("company", `%${filter.company}%`);
      if (filter.source) query = query.eq("source", filter.source);
      if ("tag" in filter && filter.tag) {
        const { data: tagData } = await supabase
          .from("tags").select("id").eq("user_id", userId).ilike("name", `%${filter.tag}%`).limit(1);
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
      if (parsed.filter.company) query = query.ilike("company", `%${parsed.filter.company}%`);
      const { data } = await query.order("first_name").limit(20);
      return (data as unknown as AgentResultContact[]) ?? [];
    }

    case "enrich_contact": {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company, job_title, avatar_url")
        .eq("user_id", userId)
        .or(`first_name.ilike.%${parsed.name}%,last_name.ilike.%${parsed.name}%`)
        .limit(1);
      return (data as unknown as AgentResultContact[]) ?? [];
    }

    case "link_contacts": {
      const { data: dataA } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company, job_title, avatar_url")
        .eq("user_id", userId).eq("is_archived", false)
        .or(`first_name.ilike.%${parsed.nameA}%,last_name.ilike.%${parsed.nameA}%`)
        .limit(1);
      const { data: dataB } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company, job_title, avatar_url")
        .eq("user_id", userId).eq("is_archived", false)
        .or(`first_name.ilike.%${parsed.nameB}%,last_name.ilike.%${parsed.nameB}%`)
        .limit(1);
      const a = (dataA as unknown as AgentResultContact[]) ?? [];
      const b = (dataB as unknown as AgentResultContact[]) ?? [];
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
