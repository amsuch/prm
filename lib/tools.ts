/**
 * Tool definitions for the LLM-based agent.
 *
 * Each tool has a name, description, JSON Schema parameters,
 * an execute function, and an optional `requiresApproval` flag
 * for mutations that need user confirmation in HITL mode.
 */

import { supabase } from "@/lib/supabase";
import { executeSQLQuery } from "@/lib/sqlAgent";
import {
  createEntity as createEntityCrud,
  addPersonToEntity,
  promotePersonToContact,
} from "@/lib/entities";
import { validateSQL, sanitizePostgrestValue } from "@/lib/sanitize";
import type { Tables } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresApproval?: boolean;
  execute: (
    input: Record<string, unknown>,
    userId: string,
  ) => Promise<unknown>;
};

type AgentResultContact = {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  avatar_url: string | null;
};

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

type ContactRow = Tables<"contacts">;
type InteractionRow = Tables<"interactions">;
type TagRow = Tables<"tags">;
type EntityRow = Tables<"entities">;
type EntityPersonRow = Tables<"entity_people">;

const STANDARD_CONTACT_FIELDS = [
  "company",
  "job_title",
  "department",
  "notes",
  "email",
  "phone",
  "first_name",
  "last_name",
  "source",
  "birthday",
];

// ---------------------------------------------------------------------------
// Schema prompt for the run_sql_query tool description
// ---------------------------------------------------------------------------

const SQL_SCHEMA_DESCRIPTION = `Execute a read-only SQL query against the user's PostgreSQL contact database. Use this for complex queries that other tools cannot handle, such as aggregate queries, joins across multiple tables, or filtering by multiple criteria simultaneously.

## Database Schema

Tables: contacts (id, user_id, first_name, last_name, company, job_title, department, birthday, notes, source, custom_fields JSONB, is_archived, last_contacted_at, created_at, updated_at), contact_emails (id, contact_id, label, email, is_primary), contact_phones (id, contact_id, label, phone, is_primary), tags (id, user_id, name, color), contact_tags (contact_id, tag_id), interactions (id, user_id, contact_id, type, direction, title, body, occurred_at, created_at), relationship_types (id, name, reverse_name, category, is_symmetric), contact_relationships (contact_a_id, contact_b_id, relationship_type_id, notes), entities (id, user_id, name, category, address, phone, website, notes, is_archived), entity_people (id, entity_id, user_id, first_name, last_name, role, notes, promoted_contact_id), reminders (id, user_id, contact_id, title, remind_at, recurrence, is_completed), custom_field_definitions (id, user_id, name, field_key, field_type, options, display_order).

Rules: ALWAYS include WHERE user_id = $1. ALWAYS filter is_archived = false unless asked about archived. Use ILIKE for text matching. LIMIT results (max 100). Use $1 for user_id. Only SELECT queries allowed.`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export function getToolDefinitions(): ToolDefinition[] {
  return [
    // ======================================================================
    // READ TOOLS (no approval needed)
    // ======================================================================

    {
      name: "search_contacts",
      description:
        "Search contacts by name, company, tag, or free text. Uses full-text search across the user's contact database. Returns matching contacts with their name, company, job title, and last contacted date. Use this when the user asks about specific people or wants to find contacts matching certain criteria.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query — a name, company, tag, or any text to match against contacts.",
          },
        },
        required: ["query"],
      },
      async execute(input, userId) {
        const query = input.query as string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)(
          "search_contacts",
          { search_query: query, p_user_id: userId },
        );

        if (error) throw new Error(error.message);

        const rows = (data as unknown as SearchContactRow[]) ?? [];
        return rows.map((r) => ({
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          company: r.company,
          job_title: r.job_title,
          email: r.email,
          phone: r.phone,
          source: r.source,
          last_contacted_at: r.last_contacted_at,
        }));
      },
    },

    {
      name: "get_contact_details",
      description:
        "Get full details for a single contact by their ID. Returns emails, phones, tags, relationships, and recent interactions. Use this after search_contacts when you need deeper information about a specific person, or when the user asks for details about a contact you already identified.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description: "UUID of the contact to look up.",
          },
        },
        required: ["contact_id"],
      },
      async execute(input, userId) {
        const contactId = input.contact_id as string;

        // Fetch contact
        const { data: contactData, error: contactError } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", contactId)
          .eq("user_id", userId)
          .single();

        if (contactError) throw new Error(contactError.message);
        const contact = contactData as unknown as ContactRow;

        // Fetch emails, phones, tags, interactions in parallel
        const [emailsRes, phonesRes, tagsRes, interactionsRes, relsRes] =
          await Promise.all([
            supabase
              .from("contact_emails")
              .select("email, label, is_primary")
              .eq("contact_id", contactId),
            supabase
              .from("contact_phones")
              .select("phone, label, is_primary")
              .eq("contact_id", contactId),
            supabase
              .from("contact_tags")
              .select("tag_id, tags(name, color)")
              .eq("contact_id", contactId),
            supabase
              .from("interactions")
              .select("type, title, occurred_at, direction")
              .eq("contact_id", contactId)
              .eq("user_id", userId)
              .order("occurred_at", { ascending: false })
              .limit(5),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase.rpc as any)("get_contact_relationships", {
              p_contact_id: contactId,
            }),
          ]);

        return {
          contact: {
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            company: contact.company,
            job_title: contact.job_title,
            department: contact.department,
            birthday: contact.birthday,
            notes: contact.notes,
            source: contact.source,
            custom_fields: contact.custom_fields,
            last_contacted_at: contact.last_contacted_at,
            created_at: contact.created_at,
          },
          emails: (emailsRes.data ?? []) as unknown as {
            email: string;
            label: string;
            is_primary: boolean;
          }[],
          phones: (phonesRes.data ?? []) as unknown as {
            phone: string;
            label: string;
            is_primary: boolean;
          }[],
          tags: (
            (tagsRes.data ?? []) as unknown as {
              tags: { name: string; color: string | null };
            }[]
          ).map((t) => t.tags),
          recent_interactions: (interactionsRes.data ?? []) as unknown as {
            type: string;
            title: string | null;
            occurred_at: string;
            direction: string | null;
          }[],
          relationships: (
            (relsRes.data ?? []) as unknown as RelationshipRpcRow[]
          ).map((r) => ({
            related_contact_id: r.related_contact_id,
            name: [r.related_first_name, r.related_last_name]
              .filter(Boolean)
              .join(" "),
            company: r.related_company,
            relationship: r.relationship_name,
          })),
        };
      },
    },

    {
      name: "get_interactions",
      description:
        "Get interactions (calls, emails, meetings, notes) for a specific contact or across all contacts. Returns the interaction type, title, date, and direction. Use this when the user asks about communication history, recent activity, or when they last talked to someone.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description:
              "Optional UUID of a specific contact. Omit to get recent interactions across all contacts.",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of interactions to return. Defaults to 10.",
          },
        },
        required: [],
      },
      async execute(input, userId) {
        const contactId = input.contact_id as string | undefined;
        const limit = (input.limit as number) || 10;

        let query = supabase
          .from("interactions")
          .select(
            "id, type, direction, title, body, occurred_at, contact_id, contacts(first_name, last_name, company)",
          )
          .eq("user_id", userId)
          .order("occurred_at", { ascending: false })
          .limit(limit);

        if (contactId) {
          query = query.eq("contact_id", contactId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        type InteractionWithContact = InteractionRow & {
          contacts: {
            first_name: string;
            last_name: string | null;
            company: string | null;
          } | null;
        };

        return ((data ?? []) as unknown as InteractionWithContact[]).map(
          (i) => ({
            id: i.id,
            type: i.type,
            direction: i.direction,
            title: i.title,
            body: i.body,
            occurred_at: i.occurred_at,
            contact_name: i.contacts
              ? [i.contacts.first_name, i.contacts.last_name]
                  .filter(Boolean)
                  .join(" ")
              : "Unknown",
            contact_company: i.contacts?.company ?? null,
          }),
        );
      },
    },

    {
      name: "get_network_stats",
      description:
        "Get summary statistics about the user's contact network. Returns total contact count, how many were contacted this week, how many are stale (30+ days without contact), top companies by contact count, and source breakdown. Use this when the user asks for an overview, stats, summary, or 'how many contacts do I have'.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      async execute(_input, userId) {
        // Total contacts
        const { count: totalContacts, error: countError } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_archived", false);
        if (countError) throw new Error(countError.message);

        // Contacted this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: contactedThisWeek, error: weekError } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_archived", false)
          .gte("last_contacted_at", weekAgo.toISOString());
        if (weekError) throw new Error(weekError.message);

        // Stale contacts (30+ days)
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
        if (staleError) throw new Error(staleError.message);

        // Top companies
        const { data: companyRaw, error: companyError } = await supabase
          .from("contacts")
          .select("company")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .not("company", "is", null)
          .not("company", "eq", "");
        if (companyError) throw new Error(companyError.message);

        type CompanyRow = { company: string | null };
        const companyData = (companyRaw as unknown as CompanyRow[]) ?? [];
        const companyCounts = new Map<string, number>();
        for (const row of companyData) {
          if (row.company) {
            companyCounts.set(
              row.company,
              (companyCounts.get(row.company) ?? 0) + 1,
            );
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
        if (sourceError) throw new Error(sourceError.message);

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

        return {
          totalContacts: totalContacts ?? 0,
          contactedThisWeek: contactedThisWeek ?? 0,
          staleContacts: staleContacts ?? 0,
          topCompanies,
          sourceBreakdown,
        };
      },
    },

    {
      name: "get_relationships",
      description:
        "Get relationships for a contact using their contact ID. Returns all people connected to this contact and the nature of their relationship (friend, colleague, family, etc.). Use this when the user asks who is connected to someone, or what relationships a contact has.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description:
              "UUID of the contact whose relationships to look up.",
          },
        },
        required: ["contact_id"],
      },
      async execute(input) {
        const contactId = input.contact_id as string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)(
          "get_contact_relationships",
          { p_contact_id: contactId },
        );

        if (error) throw new Error(error.message);

        return (
          (data as unknown as RelationshipRpcRow[]) ?? []
        ).map((r) => ({
          related_contact_id: r.related_contact_id,
          name: [r.related_first_name, r.related_last_name]
            .filter(Boolean)
            .join(" "),
          company: r.related_company,
          relationship: r.relationship_name,
          category: r.relationship_category,
          notes: r.notes,
        }));
      },
    },

    {
      name: "list_tags",
      description:
        "List all tags the user has created. Returns tag names and colors. Use this when the user wants to see their available tags, or when you need to verify a tag name before filtering by it.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      async execute(_input, userId) {
        const { data, error } = await supabase
          .from("tags")
          .select("id, name, color")
          .eq("user_id", userId)
          .order("name");

        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as TagRow[];
      },
    },

    {
      name: "list_entities",
      description:
        "List entities (places and organizations like restaurants, gyms, companies, clubs) that the user tracks. Optionally filter by category or search query. Use this when the user asks about their places, organizations, or entities.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Optional category filter (e.g., 'restaurant', 'gym', 'company').",
          },
          query: {
            type: "string",
            description:
              "Optional text query to search entity names.",
          },
        },
        required: [],
      },
      async execute(input, userId) {
        let query = supabase
          .from("entities")
          .select("*, entity_people(id)")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("name");

        const category = input.category as string | undefined;
        const searchQuery = input.query as string | undefined;

        if (category) {
          query = query.ilike("category", `%${sanitizePostgrestValue(category)}%`);
        }
        if (searchQuery) {
          const q = sanitizePostgrestValue(searchQuery);
          query = query.or(
            `name.ilike.%${q}%,category.ilike.%${q}%`,
          );
        }

        const { data, error } = await query.limit(20);
        if (error) throw new Error(error.message);

        type RawEntity = EntityRow & { entity_people: { id: string }[] };
        return ((data ?? []) as unknown as RawEntity[]).map((e) => ({
          id: e.id,
          name: e.name,
          category: e.category,
          address: e.address,
          phone: e.phone,
          website: e.website,
          people_count: e.entity_people?.length ?? 0,
        }));
      },
    },

    {
      name: "run_sql_query",
      description: SQL_SCHEMA_DESCRIPTION,
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description:
              "A PostgreSQL SELECT query. Use $1 as placeholder for the user's ID. Must be a SELECT or WITH...SELECT query only.",
          },
        },
        required: ["sql"],
      },
      async execute(input, userId) {
        const sql = input.sql as string;

        // Validate SQL is safe (read-only, no DML/DDL, no stacked queries)
        validateSQL(sql);

        const rows = await executeSQLQuery(sql, userId);
        return {
          rows: rows.slice(0, 100),
          rowCount: rows.length,
        };
      },
    },

    {
      name: "enrich_contact",
      description:
        "Look up a person's professional details using their LinkedIn profile URL, email address, or full name. Returns enrichment data including name, company, job title, location, bio, education, and skills. Also checks if the person already exists in the user's contacts by matching email or phone. Use this when the user provides a LinkedIn URL or asks you to research someone before creating a contact. This is a read-only lookup — it does NOT create or modify any contacts. After getting results, present them to the user. If existing_matches is non-empty, tell the user this person may already exist and offer to update that contact instead. Otherwise ask if they want to create a new contact.",
      parameters: {
        type: "object",
        properties: {
          identifier: {
            type: "string",
            description:
              "The LinkedIn profile URL (e.g., 'linkedin.com/in/johndoe'), email address, or full name to look up.",
          },
          type: {
            type: "string",
            description:
              "Type of identifier: 'linkedin' for a LinkedIn URL, 'email' for an email address, 'name' for a person's name.",
            enum: ["linkedin", "email", "name"],
          },
        },
        required: ["identifier", "type"],
      },
      async execute(input, userId) {
        const identifier = input.identifier as string;
        const type = input.type as string;

        // Normalize LinkedIn URLs
        let value = identifier;
        if (type === "linkedin") {
          // Accept various formats: full URL, linkedin.com/in/..., /in/...
          if (!value.startsWith("http")) {
            value = value.startsWith("linkedin.com")
              ? `https://www.${value}`
              : value.startsWith("/in/")
                ? `https://www.linkedin.com${value}`
                : `https://www.linkedin.com/in/${value}`;
          }
        }

        const { data, error } = await supabase.functions.invoke(
          "enrich-contact",
          {
            body: { type, value },
          },
        );

        if (error) {
          throw new Error(
            `Enrichment failed: ${error.message ?? "Unknown error"}`,
          );
        }

        if (!data?.success) {
          throw new Error(data?.error ?? "Enrichment returned no data");
        }

        const enrichment = data.enrichment as Record<string, unknown>;

        // Filter out empty/null fields
        const cleaned: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(enrichment)) {
          if (
            val !== null &&
            val !== undefined &&
            val !== "" &&
            !(Array.isArray(val) && val.length === 0)
          ) {
            cleaned[key] = val;
          }
        }

        // Check for existing contacts matching enriched email or phone
        type MatchedContact = {
          contact_id: string;
          first_name: string;
          last_name: string | null;
          company: string | null;
        };
        const existingMatches: MatchedContact[] = [];

        if (cleaned.email) {
          const { data: emailMatches } = await supabase
            .from("contact_emails")
            .select("contact_id, contacts!inner(first_name, last_name, company, user_id)")
            .ilike("email", cleaned.email as string);

          type EmailMatchRow = {
            contact_id: string;
            contacts: { first_name: string; last_name: string | null; company: string | null; user_id: string };
          };
          for (const row of (emailMatches as unknown as EmailMatchRow[]) ?? []) {
            if (row.contacts.user_id === userId) {
              existingMatches.push({
                contact_id: row.contact_id,
                first_name: row.contacts.first_name,
                last_name: row.contacts.last_name,
                company: row.contacts.company,
              });
            }
          }
        }

        if (cleaned.phone && existingMatches.length === 0) {
          const { data: phoneMatches } = await supabase
            .from("contact_phones")
            .select("contact_id, contacts!inner(first_name, last_name, company, user_id)")
            .eq("phone", cleaned.phone as string);

          type PhoneMatchRow = {
            contact_id: string;
            contacts: { first_name: string; last_name: string | null; company: string | null; user_id: string };
          };
          for (const row of (phoneMatches as unknown as PhoneMatchRow[]) ?? []) {
            if (row.contacts.user_id === userId) {
              existingMatches.push({
                contact_id: row.contact_id,
                first_name: row.contacts.first_name,
                last_name: row.contacts.last_name,
                company: row.contacts.company,
              });
            }
          }
        }

        return {
          success: true,
          message: existingMatches.length > 0
            ? `Found enrichment data for ${cleaned.first_name ?? ""} ${cleaned.last_name ?? ""}. This person may already be in your contacts.`.trim()
            : `Found enrichment data for ${cleaned.first_name ?? ""} ${cleaned.last_name ?? ""}`.trim(),
          enrichment: cleaned,
          existing_matches: existingMatches,
          source: "parallel",
        };
      },
    },

    // ======================================================================
    // WRITE TOOLS (require approval in HITL mode)
    // ======================================================================

    {
      name: "create_contact_from_enrichment",
      description:
        "Create a new contact using data from a previous enrich_contact lookup. Takes all enrichment fields and creates a full contact record. Core fields (name, company, title) go to contact columns. Email and phone go to their respective tables. Extra fields (education, skills, previous companies, etc.) are stored in custom_fields JSONB. Use this AFTER enrich_contact when the user confirms they want to create a NEW contact. If the person already exists (existing_matches from enrich_contact), use update_contact instead to avoid duplicates.",
      parameters: {
        type: "object",
        properties: {
          first_name: {
            type: "string",
            description: "First name from enrichment.",
          },
          last_name: {
            type: "string",
            description: "Last name from enrichment.",
          },
          company: {
            type: "string",
            description: "Company from enrichment.",
          },
          job_title: {
            type: "string",
            description: "Job title from enrichment.",
          },
          department: {
            type: "string",
            description: "Department from enrichment.",
          },
          email: {
            type: "string",
            description: "Email from enrichment.",
          },
          phone: {
            type: "string",
            description: "Phone from enrichment.",
          },
          linkedin_url: {
            type: "string",
            description: "LinkedIn profile URL.",
          },
          bio: {
            type: "string",
            description: "Professional bio/summary to store in notes.",
          },
          location: {
            type: "string",
            description: "Location to store in notes.",
          },
          profile_photo_url: {
            type: "string",
            description: "URL of their profile photo.",
          },
          education: {
            type: "string",
            description: "Most recent education (school and degree).",
          },
          previous_companies: {
            type: "array",
            items: { type: "string" },
            description: "List of previous employers.",
          },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Professional skills or areas of expertise.",
          },
        },
        required: ["first_name"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const firstName = input.first_name as string;
        const lastName = (input.last_name as string) || null;
        const company = (input.company as string) || null;
        const jobTitle = (input.job_title as string) || null;
        const department = (input.department as string) || null;
        const email = input.email as string | undefined;
        const phone = input.phone as string | undefined;
        const linkedinUrl = input.linkedin_url as string | undefined;
        const bio = input.bio as string | undefined;
        const location = input.location as string | undefined;
        const profilePhotoUrl = input.profile_photo_url as string | undefined;
        const education = input.education as string | undefined;
        const previousCompanies = input.previous_companies as string[] | undefined;
        const skills = input.skills as string[] | undefined;

        // Build notes from enrichment data
        const notesParts: string[] = [];
        if (bio) notesParts.push(bio);
        if (location) notesParts.push(`Location: ${location}`);
        const notes = notesParts.length > 0 ? notesParts.join("\n") : null;

        // Build custom_fields for extra enrichment data
        const customFields: Record<string, unknown> = {};
        if (education) customFields.education = education;
        if (previousCompanies && previousCompanies.length > 0) {
          customFields.previous_companies = previousCompanies;
        }
        if (skills && skills.length > 0) {
          customFields.skills = skills;
        }
        if (location) customFields.location = location;

        const { data: contactData, error: contactError } = await supabase
          .from("contacts")
          .insert({
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            company,
            job_title: jobTitle,
            department,
            notes,
            avatar_url: profilePhotoUrl ?? null,
            custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
            source: "enrichment",
          } as never)
          .select(
            "id, first_name, last_name, company, job_title, avatar_url",
          )
          .single();

        if (contactError) throw new Error(contactError.message);
        const contact = contactData as unknown as AgentResultContact;

        // Add email
        if (email) {
          await supabase.from("contact_emails").insert({
            contact_id: contact.id,
            email,
            label: "work",
            is_primary: true,
          });
        }

        // Add phone
        if (phone) {
          await supabase.from("contact_phones").insert({
            contact_id: contact.id,
            phone,
            label: "work",
            is_primary: true,
          });
        }

        // Add LinkedIn URL
        if (linkedinUrl) {
          await supabase.from("contact_urls").insert({
            contact_id: contact.id,
            url: linkedinUrl,
            label: "linkedin",
          });
        }

        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        const extraCount = Object.keys(customFields).length;
        return {
          success: true,
          message: `Created contact "${fullName}" from enrichment data.${extraCount > 0 ? ` Stored ${extraCount} extra field(s) (${Object.keys(customFields).join(", ")}).` : ""}`,
          contact,
        };
      },
    },

    {
      name: "create_contact",
      description:
        "Create a new contact in the user's contact database. Provide at minimum a first name. Optionally include last name, company, job title, email, and phone. Use this when the user explicitly asks to add or create a new contact.",
      parameters: {
        type: "object",
        properties: {
          first_name: {
            type: "string",
            description: "First name of the contact (required).",
          },
          last_name: {
            type: "string",
            description: "Last name of the contact.",
          },
          company: {
            type: "string",
            description: "Company or organization the contact belongs to.",
          },
          job_title: {
            type: "string",
            description: "Job title of the contact.",
          },
          email: {
            type: "string",
            description: "Email address of the contact.",
          },
          phone: {
            type: "string",
            description: "Phone number of the contact.",
          },
        },
        required: ["first_name"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const firstName = input.first_name as string;
        const lastName = (input.last_name as string) || null;
        const company = (input.company as string) || null;
        const jobTitle = (input.job_title as string) || null;
        const email = input.email as string | undefined;
        const phone = input.phone as string | undefined;

        const { data: contactData, error: contactError } = await supabase
          .from("contacts")
          .insert({
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            company,
            job_title: jobTitle,
            source: "agent",
          })
          .select("id, first_name, last_name, company, job_title, avatar_url")
          .single();

        if (contactError) throw new Error(contactError.message);
        const contact = contactData as unknown as AgentResultContact;

        if (email) {
          await supabase.from("contact_emails").insert({
            contact_id: contact.id,
            email,
            label: "work",
            is_primary: true,
          });
        }

        if (phone) {
          await supabase.from("contact_phones").insert({
            contact_id: contact.id,
            phone,
            label: "work",
            is_primary: true,
          });
        }

        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        return {
          success: true,
          message: `Created contact "${fullName}".`,
          contact,
        };
      },
    },

    {
      name: "update_contact",
      description:
        "Update a field on an existing contact. Supports standard fields (company, job_title, department, notes, email, phone, first_name, last_name, source, birthday) and custom fields defined by the user. Use this when the user asks to change, update, or set a specific piece of information on a contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description: "UUID of the contact to update.",
          },
          field: {
            type: "string",
            description:
              "The field to update (e.g., 'company', 'job_title', 'email', 'phone', 'notes', or a custom field key).",
          },
          value: {
            type: "string",
            description: "The new value for the field.",
          },
        },
        required: ["contact_id", "field", "value"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const contactId = input.contact_id as string;
        const field = input.field as string;
        const value = input.value as string;
        const normalizedField = field.replace(/[\s-]/g, "_").toLowerCase();
        const isStandardField =
          STANDARD_CONTACT_FIELDS.includes(normalizedField);

        // Verify the contact exists and belongs to the user
        const { data: contactData, error: findError } = await supabase
          .from("contacts")
          .select(
            "id, first_name, last_name, company, job_title, avatar_url, custom_fields",
          )
          .eq("id", contactId)
          .eq("user_id", userId)
          .single();

        if (findError) throw new Error(findError.message);

        type ContactWithCustom = AgentResultContact & {
          custom_fields: Record<string, unknown>;
        };
        const contact = contactData as unknown as ContactWithCustom;
        const fullName = [contact.first_name, contact.last_name]
          .filter(Boolean)
          .join(" ");

        if (normalizedField === "email") {
          await supabase.from("contact_emails").upsert(
            {
              contact_id: contact.id,
              email: value,
              label: "work",
              is_primary: true,
            } as never,
            { onConflict: "contact_id,email" as never },
          );
        } else if (normalizedField === "phone") {
          await supabase.from("contact_phones").upsert(
            {
              contact_id: contact.id,
              phone: value,
              label: "mobile",
              is_primary: true,
            } as never,
            { onConflict: "contact_id,phone" as never },
          );
        } else if (isStandardField) {
          const { error: updateError } = await supabase
            .from("contacts")
            .update({ [normalizedField]: value } as never)
            .eq("id", contact.id);
          if (updateError) throw new Error(updateError.message);
        } else {
          // Custom field
          const existingCustom =
            (contact.custom_fields as Record<string, unknown>) ?? {};
          const updated = { ...existingCustom, [normalizedField]: value };
          const { error: updateError } = await supabase
            .from("contacts")
            .update({ custom_fields: updated } as never)
            .eq("id", contact.id);
          if (updateError) throw new Error(updateError.message);
        }

        return {
          success: true,
          message: `Updated ${field} to "${value}" for ${fullName}.`,
        };
      },
    },

    {
      name: "bulk_tag_contacts",
      description:
        "Add a tag to multiple contacts matching a filter. Can filter by company or source. If the tag does not exist, it will be created automatically. Use this when the user wants to tag a group of contacts at once.",
      parameters: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description: "The tag name to apply.",
          },
          company: {
            type: "string",
            description:
              "Filter contacts by company name (uses partial matching).",
          },
          source: {
            type: "string",
            description:
              "Filter contacts by source (e.g., 'linkedin', 'manual', 'csv').",
          },
        },
        required: ["tag"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const tagName = input.tag as string;
        const company = input.company as string | undefined;
        const source = input.source as string | undefined;

        // Find or create the tag
        let tagId: string;
        const { data: existingTag } = await supabase
          .from("tags")
          .select("id")
          .eq("user_id", userId)
          .ilike("name", tagName)
          .limit(1);

        type TagIdRow = { id: string };
        const existingTags = (existingTag as unknown as TagIdRow[]) ?? [];

        if (existingTags.length > 0) {
          tagId = existingTags[0].id;
        } else {
          const { data: newTag, error: tagCreateError } = await supabase
            .from("tags")
            .insert({ user_id: userId, name: tagName })
            .select("id")
            .single();
          if (tagCreateError) throw new Error(tagCreateError.message);
          tagId = (newTag as unknown as TagIdRow).id;
        }

        // Find contacts matching the filter
        let contactQuery = supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("is_archived", false);

        if (company) {
          contactQuery = contactQuery.ilike("company", `%${sanitizePostgrestValue(company)}%`);
        }
        if (source) {
          contactQuery = contactQuery.ilike("source", source);
        }

        const { data: contactData, error: contactError } =
          await contactQuery;
        if (contactError) throw new Error(contactError.message);

        type ContactIdRow = { id: string };
        const contacts = (contactData as unknown as ContactIdRow[]) ?? [];

        if (contacts.length === 0) {
          return {
            success: false,
            message: "No contacts matched the filter.",
            count: 0,
          };
        }

        // Get existing tags to avoid duplicates
        const { data: existingCtData } = await supabase
          .from("contact_tags")
          .select("contact_id")
          .eq("tag_id", tagId)
          .in(
            "contact_id",
            contacts.map((c) => c.id),
          );

        type ContactIdTagRow = { contact_id: string };
        const existingContactIds = new Set(
          ((existingCtData as unknown as ContactIdTagRow[]) ?? []).map(
            (ct) => ct.contact_id,
          ),
        );

        const newContactTags = contacts
          .filter((c) => !existingContactIds.has(c.id))
          .map((c) => ({ contact_id: c.id, tag_id: tagId }));

        if (newContactTags.length > 0) {
          const { error: insertError } = await supabase
            .from("contact_tags")
            .insert(newContactTags);
          if (insertError) throw new Error(insertError.message);
        }

        return {
          success: true,
          message: `Tagged ${newContactTags.length} contact(s) as "${tagName}". ${existingContactIds.size} already had this tag.`,
          count: newContactTags.length,
          skipped: existingContactIds.size,
        };
      },
    },

    {
      name: "archive_contacts",
      description:
        "Archive contacts matching a filter so they no longer appear in the active contact list. Can filter by number of days since last contact, by tag, or by company. Use this when the user wants to clean up their contact list by archiving stale or unwanted contacts.",
      parameters: {
        type: "object",
        properties: {
          days_inactive: {
            type: "number",
            description:
              "Archive contacts not contacted in this many days.",
          },
          tag: {
            type: "string",
            description: "Archive contacts with this tag.",
          },
          company: {
            type: "string",
            description: "Archive contacts at this company.",
          },
        },
        required: [],
      },
      requiresApproval: true,
      async execute(input, userId) {
        let contactIds: string[] = [];

        const daysInactive = input.days_inactive as number | undefined;
        const tag = input.tag as string | undefined;
        const company = input.company as string | undefined;

        if (daysInactive) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - daysInactive);

          const { data, error } = await supabase
            .from("contacts")
            .select("id")
            .eq("user_id", userId)
            .eq("is_archived", false)
            .or(
              `last_contacted_at.is.null,last_contacted_at.lt.${cutoff.toISOString()}`,
            );
          if (error) throw new Error(error.message);
          type ContactIdRow = { id: string };
          contactIds = ((data as unknown as ContactIdRow[]) ?? []).map(
            (c) => c.id,
          );
        } else if (tag) {
          const { data: tagData } = await supabase
            .from("tags")
            .select("id")
            .eq("user_id", userId)
            .ilike("name", `%${tag}%`)
            .limit(1);
          const tags = (tagData as unknown as { id: string }[]) ?? [];
          if (tags.length === 0) {
            return {
              success: false,
              message: `No tag matching "${tag}" found.`,
              count: 0,
            };
          }
          const { data: ctData } = await supabase
            .from("contact_tags")
            .select("contact_id")
            .eq("tag_id", tags[0].id);
          const taggedIds = (
            (ctData as unknown as { contact_id: string }[]) ?? []
          ).map((ct) => ct.contact_id);

          if (taggedIds.length > 0) {
            const { data: activeData } = await supabase
              .from("contacts")
              .select("id")
              .in("id", taggedIds)
              .eq("user_id", userId)
              .eq("is_archived", false);
            contactIds = (
              (activeData as unknown as { id: string }[]) ?? []
            ).map((c) => c.id);
          }
        } else if (company) {
          const { data, error } = await supabase
            .from("contacts")
            .select("id")
            .eq("user_id", userId)
            .eq("is_archived", false)
            .ilike("company", `%${company}%`);
          if (error) throw new Error(error.message);
          contactIds = ((data as unknown as { id: string }[]) ?? []).map(
            (c) => c.id,
          );
        }

        if (contactIds.length === 0) {
          return {
            success: false,
            message: "No contacts matched the archive criteria.",
            count: 0,
          };
        }

        const { error: updateError } = await supabase
          .from("contacts")
          .update({ is_archived: true })
          .in("id", contactIds);
        if (updateError) throw new Error(updateError.message);

        return {
          success: true,
          message: `Archived ${contactIds.length} contact(s).`,
          count: contactIds.length,
        };
      },
    },

    {
      name: "link_contacts",
      description:
        "Create a relationship between two contacts. Specify both contact IDs and an optional relationship type name (e.g., 'friend', 'colleague', 'parent', 'mentor'). If the relationship type is not found, defaults to 'Friend'. Use this when the user says two contacts are related, know each other, or should be linked.",
      parameters: {
        type: "object",
        properties: {
          contact_a_id: {
            type: "string",
            description: "UUID of the first contact.",
          },
          contact_b_id: {
            type: "string",
            description: "UUID of the second contact.",
          },
          relationship: {
            type: "string",
            description:
              "Name of the relationship type (e.g., 'friend', 'colleague', 'parent').",
          },
        },
        required: ["contact_a_id", "contact_b_id"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const aId = input.contact_a_id as string;
        const bId = input.contact_b_id as string;
        const relationshipName = input.relationship as string | undefined;

        if (aId === bId) {
          throw new Error("Cannot link a contact to themselves.");
        }

        // Verify both contacts belong to this user
        const { data: dataA } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("id", aId)
          .eq("user_id", userId)
          .single();
        const { data: dataB } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("id", bId)
          .eq("user_id", userId)
          .single();

        if (!dataA || !dataB) {
          throw new Error("One or both contacts not found.");
        }

        type ContactSlim = {
          id: string;
          first_name: string;
          last_name: string | null;
        };
        const a = dataA as unknown as ContactSlim;
        const b = dataB as unknown as ContactSlim;

        // Find relationship type
        type RelType = {
          id: string;
          name: string;
          reverse_name: string | null;
          is_symmetric: boolean;
        };
        let relTypeId: string | null = null;
        let swapDirection = false;

        if (relationshipName) {
          const rn = relationshipName.toLowerCase();
          const { data: allTypes } = await supabase
            .from("relationship_types")
            .select("id, name, reverse_name, is_symmetric")
            .or(`user_id.eq.${userId},is_system.eq.true`);
          const types = (allTypes as unknown as RelType[]) ?? [];

          const nameMatch = types.find(
            (t) => t.name.toLowerCase() === rn,
          );
          if (nameMatch) {
            relTypeId = nameMatch.id;
          } else {
            const reverseMatch = types.find(
              (t) =>
                t.reverse_name && t.reverse_name.toLowerCase() === rn,
            );
            if (reverseMatch) {
              relTypeId = reverseMatch.id;
              if (!reverseMatch.is_symmetric) swapDirection = true;
            } else {
              const fuzzy = types.find(
                (t) =>
                  t.name.toLowerCase().includes(rn) ||
                  rn.includes(t.name.toLowerCase()),
              );
              if (fuzzy) relTypeId = fuzzy.id;
            }
          }
        }

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
            throw new Error("No relationship types available.");
          }
        }

        const contactA = swapDirection ? b : a;
        const contactB = swapDirection ? a : b;

        const { error: insertErr } = await supabase
          .from("contact_relationships")
          .insert({
            contact_a_id: contactA.id,
            contact_b_id: contactB.id,
            relationship_type_id: relTypeId,
          } as never);

        if (insertErr) {
          if (
            insertErr.message?.includes("duplicate") ||
            insertErr.message?.includes("unique")
          ) {
            return {
              success: false,
              message: "These contacts are already linked.",
            };
          }
          throw new Error(insertErr.message);
        }

        const nameAFull = [a.first_name, a.last_name]
          .filter(Boolean)
          .join(" ");
        const nameBFull = [b.first_name, b.last_name]
          .filter(Boolean)
          .join(" ");

        return {
          success: true,
          message: `Linked ${nameAFull} and ${nameBFull}${relationshipName ? ` as ${relationshipName}` : ""}.`,
        };
      },
    },

    {
      name: "create_entity",
      description:
        "Create a new entity (place or organization) like a restaurant, gym, club, or company that the user wants to track. Entities can have people associated with them. Use this when the user asks to add a new place or organization.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the entity (e.g., \"Joe's Diner\").",
          },
          category: {
            type: "string",
            description:
              "Category of the entity (e.g., 'restaurant', 'gym', 'company', 'club').",
          },
          address: {
            type: "string",
            description: "Physical address of the entity.",
          },
        },
        required: ["name"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const name = input.name as string;
        const category = (input.category as string) || null;
        const address = (input.address as string) || null;

        const entity = await createEntityCrud(userId, {
          name,
          category,
          address,
        });

        return {
          success: true,
          message: `Created entity "${name}"${category ? ` (${category})` : ""}.`,
          entity: {
            id: entity.id,
            name: entity.name,
            category: entity.category,
          },
        };
      },
    },

    {
      name: "add_entity_person",
      description:
        "Add a person (casual acquaintance) to an entity. These are people the user knows at a specific place but does not want as a full contact. Use this when the user says to add someone at a specific entity/place.",
      parameters: {
        type: "object",
        properties: {
          entity_id: {
            type: "string",
            description: "UUID of the entity to add the person to.",
          },
          first_name: {
            type: "string",
            description: "First name of the person.",
          },
          last_name: {
            type: "string",
            description: "Last name of the person.",
          },
          role: {
            type: "string",
            description:
              "Role or title at the entity (e.g., 'waitress', 'trainer').",
          },
        },
        required: ["entity_id", "first_name"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const entityId = input.entity_id as string;
        const firstName = input.first_name as string;
        const lastName = (input.last_name as string) || null;
        const role = (input.role as string) || null;

        const person = await addPersonToEntity(entityId, userId, {
          first_name: firstName,
          last_name: lastName,
          role,
        });

        return {
          success: true,
          message: `Added ${firstName}${lastName ? " " + lastName : ""} to entity${role ? ` as ${role}` : ""}.`,
          person: {
            id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            role: person.role,
          },
        };
      },
    },

    {
      name: "log_interaction",
      description:
        "Log an interaction (call, email, meeting, note, text, social, gift) with a contact. Records when the interaction happened and updates the contact's last_contacted_at timestamp. Use this when the user says they talked to, met with, emailed, or otherwise interacted with a contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description: "UUID of the contact the interaction is with.",
          },
          type: {
            type: "string",
            description:
              "Type of interaction: 'note', 'call', 'email', 'meeting', 'text', 'social', 'gift'.",
            enum: [
              "note",
              "call",
              "email",
              "meeting",
              "text",
              "social",
              "gift",
            ],
          },
          title: {
            type: "string",
            description: "Brief title or subject of the interaction.",
          },
          body: {
            type: "string",
            description: "Detailed notes about the interaction.",
          },
          direction: {
            type: "string",
            description: "Direction: 'inbound' or 'outbound'.",
            enum: ["inbound", "outbound"],
          },
          occurred_at: {
            type: "string",
            description:
              "ISO 8601 timestamp of when the interaction occurred. Defaults to now.",
          },
        },
        required: ["contact_id", "type"],
      },
      requiresApproval: true,
      async execute(input, userId) {
        const contactId = input.contact_id as string;
        const type = input.type as string;
        const title = (input.title as string) || null;
        const body = (input.body as string) || null;
        const direction = (input.direction as string) || null;
        const occurredAt =
          (input.occurred_at as string) || new Date().toISOString();

        // Verify contact belongs to user
        const { data: contactData, error: contactError } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("id", contactId)
          .eq("user_id", userId)
          .single();

        if (contactError || !contactData) {
          throw new Error("Contact not found.");
        }

        type ContactSlim = {
          id: string;
          first_name: string;
          last_name: string | null;
        };
        const contact = contactData as unknown as ContactSlim;

        const { error: insertError } = await supabase
          .from("interactions")
          .insert({
            user_id: userId,
            contact_id: contactId,
            type,
            title,
            body,
            direction,
            occurred_at: occurredAt,
          } as never);

        if (insertError) throw new Error(insertError.message);

        // Update last_contacted_at
        await supabase
          .from("contacts")
          .update({ last_contacted_at: occurredAt } as never)
          .eq("id", contactId);

        const fullName = [contact.first_name, contact.last_name]
          .filter(Boolean)
          .join(" ");

        return {
          success: true,
          message: `Logged ${type} interaction with ${fullName}.`,
        };
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Helper: convert tool definitions to LLM provider format
// ---------------------------------------------------------------------------

export function toolsToOpenAIFormat(
  tools: ToolDefinition[],
): {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function toolsToAnthropicFormat(
  tools: ToolDefinition[],
): { name: string; description: string; input_schema: Record<string, unknown> }[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}
