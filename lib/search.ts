import { supabase } from "@/lib/supabase";

export type SearchFilters = {
  query: string;
  tagIds: string[];
  company: string;
  lastContactedRange: LastContactedRange;
  source: SourceFilter;
  sortBy: SearchSortOption;
};

export type LastContactedRange =
  | "any"
  | "7d"
  | "30d"
  | "90d"
  | "over_90d";

export type SourceFilter =
  | "all"
  | "linkedin"
  | "device"
  | "manual";

export type SearchSortOption =
  | "relevance"
  | "name_asc"
  | "last_contacted"
  | "recently_added";

export const DEFAULT_FILTERS: SearchFilters = {
  query: "",
  tagIds: [],
  company: "",
  lastContactedRange: "any",
  source: "all",
  sortBy: "relevance",
};

export type SearchResultContact = {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  avatar_url: string | null;
  source: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  email: string | null;
  phone: string | null;
  rank?: number;
};

/**
 * Build a filtered Supabase query for contacts.
 * This applies tag, company, last-contacted, and source filters
 * to a base contacts query.
 */
export function buildFilterQuery(
  userId: string,
  filters: Omit<SearchFilters, "query" | "sortBy">,
) {
  let query = supabase
    .from("contacts")
    .select(
      `
      id, first_name, last_name, company, job_title, avatar_url,
      source, last_contacted_at, created_at, updated_at,
      contact_emails (email),
      contact_phones (phone)
    `,
    )
    .eq("user_id", userId)
    .eq("is_archived", false);

  // Company filter
  if (filters.company.trim()) {
    query = query.ilike("company", `%${filters.company.trim()}%`);
  }

  // Source filter
  if (filters.source !== "all") {
    query = query.eq("source", filters.source);
  }

  // Last contacted range
  if (filters.lastContactedRange !== "any") {
    const now = new Date();
    switch (filters.lastContactedRange) {
      case "7d": {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        query = query.gte("last_contacted_at", d.toISOString());
        break;
      }
      case "30d": {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        query = query.gte("last_contacted_at", d.toISOString());
        break;
      }
      case "90d": {
        const d = new Date(now);
        d.setDate(d.getDate() - 90);
        query = query.gte("last_contacted_at", d.toISOString());
        break;
      }
      case "over_90d": {
        const d = new Date(now);
        d.setDate(d.getDate() - 90);
        query = query.or(
          `last_contacted_at.is.null,last_contacted_at.lt.${d.toISOString()}`,
        );
        break;
      }
    }
  }

  // Tag filter: if tags are selected, we need contacts that have the selected tags
  if (filters.tagIds.length > 0) {
    // Use a subquery cast to get contact IDs with the selected tags
    const subquery = supabase
      .from("contact_tags")
      .select("contact_id")
      .in("tag_id", filters.tagIds) as unknown as readonly string[];
    query = query.in("id", subquery);
  }

  return query;
}

/**
 * Execute a search combining RPC text search with additional filters.
 */
export async function searchContacts(
  userId: string,
  filters: SearchFilters,
): Promise<{ data: SearchResultContact[]; error: string | null }> {
  try {
    // If we have a text query, use the RPC for ranked results
    if (filters.query.trim()) {
      type RpcResultRow = {
        id: string;
        first_name: string;
        last_name: string | null;
        company: string | null;
        job_title: string | null;
        avatar_url: string | null;
        source: string | null;
        last_contacted_at: string | null;
        created_at: string;
        updated_at: string;
        email: string | null;
        phone: string | null;
        rank: number;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
        "search_contacts",
        {
          search_query: filters.query.trim(),
          p_user_id: userId,
        },
      );

      if (rpcError) {
        return { data: [], error: rpcError.message };
      }

      const rpcRows = (rpcData as unknown as RpcResultRow[]) ?? [];

      let results: SearchResultContact[] = rpcRows.map((row) => ({
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        company: row.company,
        job_title: row.job_title,
        avatar_url: row.avatar_url,
        source: row.source,
        last_contacted_at: row.last_contacted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        email: row.email,
        phone: row.phone,
        rank: row.rank,
      }));

      // Apply client-side filters to RPC results
      results = applyClientSideFilters(results, filters);

      // Sort if not by relevance (RPC already sorts by relevance)
      if (filters.sortBy !== "relevance") {
        results = sortResults(results, filters.sortBy);
      }

      return { data: results, error: null };
    }

    // No text query: use standard filtered query
    const query = buildFilterQuery(userId, {
      tagIds: filters.tagIds,
      company: filters.company,
      lastContactedRange: filters.lastContactedRange,
      source: filters.source,
    });

    // Apply sort
    let sortedQuery = query;
    switch (filters.sortBy) {
      case "name_asc":
      case "relevance": // default to name when no search query
        sortedQuery = query.order("first_name", { ascending: true });
        break;
      case "last_contacted":
        sortedQuery = query.order("last_contacted_at", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "recently_added":
        sortedQuery = query.order("created_at", { ascending: false });
        break;
    }

    const { data, error: queryError } = await sortedQuery.limit(50);

    if (queryError) {
      return { data: [], error: queryError.message };
    }

    type RawRow = {
      id: string;
      first_name: string;
      last_name: string | null;
      company: string | null;
      job_title: string | null;
      avatar_url: string | null;
      source: string | null;
      last_contacted_at: string | null;
      created_at: string;
      updated_at: string;
      contact_emails: { email: string }[];
      contact_phones: { phone: string }[];
    };

    const rows = (data ?? []) as unknown as RawRow[];

    const results: SearchResultContact[] = rows.map((row) => ({
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      company: row.company,
      job_title: row.job_title,
      avatar_url: row.avatar_url,
      source: row.source,
      last_contacted_at: row.last_contacted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      email: row.contact_emails?.[0]?.email ?? null,
      phone: row.contact_phones?.[0]?.phone ?? null,
    }));

    return { data: results, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : "Search failed",
    };
  }
}

function applyClientSideFilters(
  results: SearchResultContact[],
  filters: SearchFilters,
): SearchResultContact[] {
  let filtered = results;

  // Company filter
  if (filters.company.trim()) {
    const companyLower = filters.company.trim().toLowerCase();
    filtered = filtered.filter(
      (c) => c.company?.toLowerCase().includes(companyLower),
    );
  }

  // Source filter
  if (filters.source !== "all") {
    filtered = filtered.filter((c) => c.source === filters.source);
  }

  // Last contacted range
  if (filters.lastContactedRange !== "any") {
    const now = new Date();
    filtered = filtered.filter((c) => {
      const lastContacted = c.last_contacted_at
        ? new Date(c.last_contacted_at)
        : null;

      switch (filters.lastContactedRange) {
        case "7d": {
          if (!lastContacted) return false;
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          return lastContacted >= d;
        }
        case "30d": {
          if (!lastContacted) return false;
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          return lastContacted >= d;
        }
        case "90d": {
          if (!lastContacted) return false;
          const d = new Date(now);
          d.setDate(d.getDate() - 90);
          return lastContacted >= d;
        }
        case "over_90d": {
          if (!lastContacted) return true;
          const d = new Date(now);
          d.setDate(d.getDate() - 90);
          return lastContacted < d;
        }
        default:
          return true;
      }
    });
  }

  return filtered;
}

function sortResults(
  results: SearchResultContact[],
  sortBy: SearchSortOption,
): SearchResultContact[] {
  const sorted = [...results];

  switch (sortBy) {
    case "name_asc":
      sorted.sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name ?? ""}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name ?? ""}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      break;
    case "last_contacted":
      sorted.sort((a, b) => {
        if (!a.last_contacted_at && !b.last_contacted_at) return 0;
        if (!a.last_contacted_at) return 1;
        if (!b.last_contacted_at) return -1;
        return (
          new Date(b.last_contacted_at).getTime() -
          new Date(a.last_contacted_at).getTime()
        );
      });
      break;
    case "recently_added":
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      break;
  }

  return sorted;
}
