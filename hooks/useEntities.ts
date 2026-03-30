import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import { sanitizePostgrestValue } from "@/lib/sanitize";
import type { Tables } from "@/types/database";

export type EntityWithCount = Tables<"entities"> & {
  people_count: number;
};

export function useEntities(searchQuery: string = "") {
  const { session } = useSession();
  const [entities, setEntities] = useState<EntityWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const fetchEntities = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("entities")
        .select("*, entity_people(id)")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("name", { ascending: true });

      if (searchQuery.trim()) {
        const search = sanitizePostgrestValue(searchQuery.trim());
        query = query.or(
          `name.ilike.%${search}%,category.ilike.%${search}%,address.ilike.%${search}%`,
        );
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      type RawEntity = Tables<"entities"> & {
        entity_people: { id: string }[];
      };

      const raw = (data ?? []) as unknown as RawEntity[];

      const mapped: EntityWithCount[] = raw.map((e) => ({
        id: e.id,
        user_id: e.user_id,
        name: e.name,
        category: e.category,
        address: e.address,
        phone: e.phone,
        website: e.website,
        notes: e.notes,
        avatar_url: e.avatar_url,
        is_archived: e.is_archived,
        created_at: e.created_at,
        updated_at: e.updated_at,
        people_count: e.entity_people?.length ?? 0,
      }));

      setEntities(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch entities");
    } finally {
      setIsLoading(false);
    }
  }, [userId, searchQuery]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const refresh = useCallback(async () => {
    await fetchEntities();
  }, [fetchEntities]);

  return { entities, isLoading, error, refresh };
}
