import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";

export type ContactWithDetails = Tables<"contacts"> & {
  contact_emails: Tables<"contact_emails">[];
  contact_phones: Tables<"contact_phones">[];
  contact_tags: { tag_id: string; tags: Tables<"tags"> }[];
};

export type SortOption = "name_asc" | "name_desc" | "recent" | "last_contacted";
export type FilterOption = "all" | "stale_30d" | "recent_7d" | string; // string for tag IDs

const PAGE_SIZE = 20;

export function useContacts(
  searchQuery: string = "",
  sortBy: SortOption = "name_asc",
  filterBy: FilterOption = "all",
) {
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
        if (searchQuery.trim()) {
          const { data, error: rpcError } = await supabase.rpc("search_contacts", {
            search_query: searchQuery.trim(),
            p_user_id: userId,
          });

          if (rpcError) throw rpcError;

          // Map RPC results to ContactWithDetails shape (no related tables in RPC)
          const mappedContacts: ContactWithDetails[] = (data ?? []).map((row) => ({
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

        // Apply filters
        if (filterBy === "stale_30d") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query = query.or(
            `last_contacted_at.is.null,last_contacted_at.lt.${thirtyDaysAgo.toISOString()}`,
          );
        } else if (filterBy === "recent_7d") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          query = query.gte("created_at", sevenDaysAgo.toISOString());
        } else if (filterBy !== "all") {
          // Tag filter - filterBy is the tag ID
          // Fetch contact IDs with this tag first
          const { data: taggedContacts } = await supabase
            .from("contact_tags")
            .select("contact_id")
            .eq("tag_id", filterBy);
          const taggedIds = (taggedContacts ?? []).map((tc) => tc.contact_id);
          if (taggedIds.length === 0) {
            // No contacts with this tag
            setContacts([]);
            setHasMore(false);
            setError(null);
            setIsLoading(false);
            return;
          }
          query = query.in("id", taggedIds);
        }

        // Apply sort
        switch (sortBy) {
          case "name_asc":
            query = query.order("first_name", { ascending: true });
            break;
          case "name_desc":
            query = query.order("first_name", { ascending: false });
            break;
          case "recent":
            query = query.order("created_at", { ascending: false });
            break;
          case "last_contacted":
            query = query.order("last_contacted_at", {
              ascending: false,
              nullsFirst: false,
            });
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
    [userId, searchQuery, sortBy, filterBy],
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
