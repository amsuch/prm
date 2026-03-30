import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import { sanitizePostgrestValue } from "@/lib/sanitize";
import type { Tables } from "@/types/database";
import type { SearchFilters } from "@/lib/search";
import { DEFAULT_FILTERS } from "@/lib/search";

export type ContactWithDetails = Tables<"contacts"> & {
  contact_emails: Tables<"contact_emails">[];
  contact_phones: Tables<"contact_phones">[];
  contact_tags: { tag_id: string; tags: Tables<"tags"> }[];
};

export type SortOption = "name_asc" | "name_desc" | "recent" | "last_contacted";
export type FilterOption = "all" | "stale_30d" | "recent_7d" | string; // string for tag IDs

const PAGE_SIZE = 20;

export function useContacts(filters: SearchFilters = DEFAULT_FILTERS) {
  const { session } = useSession();
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [tags, setTags] = useState<Tables<"tags">[]>([]);

  const userId = session?.user?.id;

  // Fetch tags for filter chips
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .order("name")
      .then(({ data }) => {
        if (data) setTags(data);
      });
  }, [userId]);

  const fetchContacts = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!userId) return;

      try {
        if (pageNum === 0 && !append) {
          setIsLoading(true);
        }

        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // If there's a search query, use the RPC
        if (filters.query.trim()) {
          const { data, error: rpcError } = await supabase.rpc("search_contacts", {
            search_query: filters.query.trim(),
            p_user_id: userId,
          });

          if (rpcError) throw rpcError;

          // Map RPC results to ContactWithDetails shape (no related tables in RPC)
          let mappedContacts: ContactWithDetails[] = (data ?? []).map((row) => ({
            id: row.id,
            user_id: userId,
            first_name: row.first_name,
            last_name: row.last_name,
            company: row.company,
            job_title: row.job_title,
            department: null,
            birthday: null,
            notes: null,
            avatar_url: row.avatar_url,
            source: row.source,
            source_id: null,
            custom_fields: row.custom_fields,
            is_archived: row.is_archived,
            last_contacted_at: row.last_contacted_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
            contact_emails: row.email
              ? [
                  {
                    id: "",
                    contact_id: row.id,
                    label: "primary",
                    email: row.email,
                    is_primary: true,
                    created_at: "",
                  },
                ]
              : [],
            contact_phones: row.phone
              ? [
                  {
                    id: "",
                    contact_id: row.id,
                    label: "primary",
                    phone: row.phone,
                    is_primary: true,
                    created_at: "",
                  },
                ]
              : [],
            contact_tags: [],
          }));

          // Apply client-side filters for fields the RPC doesn't handle
          if (filters.company.trim()) {
            const companyLower = filters.company.trim().toLowerCase();
            mappedContacts = mappedContacts.filter(
              (c) => c.company?.toLowerCase().includes(companyLower),
            );
          }
          if (filters.jobTitle.trim()) {
            const titleLower = filters.jobTitle.trim().toLowerCase();
            mappedContacts = mappedContacts.filter(
              (c) => c.job_title?.toLowerCase().includes(titleLower),
            );
          }
          if (filters.source !== "all") {
            mappedContacts = mappedContacts.filter((c) => c.source === filters.source);
          }
          if (filters.hasEmail === true) {
            mappedContacts = mappedContacts.filter((c) => c.contact_emails.length > 0);
          } else if (filters.hasEmail === false) {
            mappedContacts = mappedContacts.filter((c) => c.contact_emails.length === 0);
          }
          if (filters.hasPhone === true) {
            mappedContacts = mappedContacts.filter((c) => c.contact_phones.length > 0);
          } else if (filters.hasPhone === false) {
            mappedContacts = mappedContacts.filter((c) => c.contact_phones.length === 0);
          }
          // hasNotes: RPC results don't include notes field, skip
          if (filters.lastContactedRange !== "any") {
            const now = new Date();
            mappedContacts = mappedContacts.filter((c) => {
              const lc = c.last_contacted_at ? new Date(c.last_contacted_at) : null;
              switch (filters.lastContactedRange) {
                case "7d": {
                  if (!lc) return false;
                  const d = new Date(now);
                  d.setDate(d.getDate() - 7);
                  return lc >= d;
                }
                case "30d": {
                  if (!lc) return false;
                  const d = new Date(now);
                  d.setDate(d.getDate() - 30);
                  return lc >= d;
                }
                case "90d": {
                  if (!lc) return false;
                  const d = new Date(now);
                  d.setDate(d.getDate() - 90);
                  return lc >= d;
                }
                case "over_90d": {
                  if (!lc) return true;
                  const d = new Date(now);
                  d.setDate(d.getDate() - 90);
                  return lc < d;
                }
                default:
                  return true;
              }
            });
          }

          // Apply sort
          if (filters.sortBy === "name_asc" || filters.sortBy === "relevance") {
            // RPC already sorts by relevance; name_asc needs explicit sort
            if (filters.sortBy === "name_asc") {
              mappedContacts.sort((a, b) => {
                const nameA = `${a.first_name} ${a.last_name ?? ""}`.toLowerCase();
                const nameB = `${b.first_name} ${b.last_name ?? ""}`.toLowerCase();
                return nameA.localeCompare(nameB);
              });
            }
          } else if (filters.sortBy === "last_contacted") {
            mappedContacts.sort((a, b) => {
              if (!a.last_contacted_at && !b.last_contacted_at) return 0;
              if (!a.last_contacted_at) return 1;
              if (!b.last_contacted_at) return -1;
              return new Date(b.last_contacted_at).getTime() - new Date(a.last_contacted_at).getTime();
            });
          } else if (filters.sortBy === "recently_added") {
            mappedContacts.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            );
          }

          setContacts(mappedContacts);
          setHasMore(false);
          setError(null);
          setIsLoading(false);
          return;
        }

        // Standard query with related data
        let query = supabase
          .from("contacts")
          .select(
            `
            *,
            contact_emails (*),
            contact_phones (*),
            contact_tags (tag_id, tags (*))
          `,
          )
          .eq("user_id", userId)
          .eq("is_archived", false);

        // Apply company filter
        if (filters.company.trim()) {
          query = query.ilike("company", `%${sanitizePostgrestValue(filters.company.trim())}%`);
        }

        // Apply job title filter
        if (filters.jobTitle.trim()) {
          query = query.ilike("job_title", `%${sanitizePostgrestValue(filters.jobTitle.trim())}%`);
        }

        // Apply source filter
        if (filters.source !== "all") {
          query = query.eq("source", filters.source);
        }

        // Apply has email filter
        if (filters.hasEmail === true) {
          query = query.not("contact_emails", "is", null);
        } else if (filters.hasEmail === false) {
          query = query.is("contact_emails", null);
        }

        // Apply has phone filter
        if (filters.hasPhone === true) {
          query = query.not("contact_phones", "is", null);
        } else if (filters.hasPhone === false) {
          query = query.is("contact_phones", null);
        }

        // Apply has notes filter
        if (filters.hasNotes === true) {
          query = query.not("notes", "is", null).neq("notes", "");
        } else if (filters.hasNotes === false) {
          // PostgREST syntax: "notes.eq." matches empty string (value after final dot is empty)
          query = query.or("notes.is.null,notes.eq.");
        }

        // Apply last contacted range
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

        // Apply tag filter
        if (filters.tagIds.length > 0) {
          const { data: taggedContacts } = await supabase
            .from("contact_tags")
            .select("contact_id")
            .in("tag_id", filters.tagIds);
          const taggedIds = (taggedContacts ?? []).map((tc) => tc.contact_id);
          if (taggedIds.length === 0) {
            setContacts([]);
            setHasMore(false);
            setError(null);
            setIsLoading(false);
            return;
          }
          query = query.in("id", taggedIds);
        }

        // Apply sort
        switch (filters.sortBy) {
          case "name_asc":
          case "relevance":
            query = query.order("first_name", { ascending: true });
            break;
          case "last_contacted":
            query = query.order("last_contacted_at", {
              ascending: false,
              nullsFirst: false,
            });
            break;
          case "recently_added":
            query = query.order("created_at", { ascending: false });
            break;
        }

        query = query.range(from, to);

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        const typedData = (data ?? []) as unknown as ContactWithDetails[];

        if (append) {
          setContacts((prev) => [...prev, ...typedData]);
        } else {
          setContacts(typedData);
        }

        setHasMore(typedData.length === PAGE_SIZE);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch contacts");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [userId, filters],
  );

  // Initial fetch and refetch on param changes
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchContacts(0, false);
  }, [fetchContacts]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setPage(0);
    setHasMore(true);
    await fetchContacts(0, false);
  }, [fetchContacts]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchContacts(nextPage, true);
  }, [hasMore, isLoadingMore, isLoading, page, fetchContacts]);

  return {
    contacts,
    tags,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
