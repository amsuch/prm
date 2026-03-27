/**
 * Agent: execute parsed query intents against Supabase and return
 * formatted results for the chat interface.
 */

import { supabase } from "@/lib/supabase";
import type { ParsedQuery } from "@/lib/queryParser";
import { formatRelativeTime } from "@/lib/utils";
import type { Tables } from "@/types/database";

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

export type AgentResponse =
  | { type: "contacts"; message: string; contacts: AgentResultContact[] }
  | { type: "interaction"; message: string; interaction: InteractionResult | null }
  | { type: "relationships"; message: string; relationships: RelationshipResult[]; contactName: string }
  | { type: "stats"; message: string; stats: StatsResult }
  | { type: "text"; message: string }
  | { type: "error"; message: string };

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
 * Execute a parsed query and return formatted results.
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
