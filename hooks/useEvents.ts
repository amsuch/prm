import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";

export type EventWithCount = Tables<"events"> & {
  people_count: number;
};

export function useEvents(searchQuery: string = "") {
  const { session } = useSession();
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const fetchEvents = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("events")
        .select("*, event_people(id)")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (searchQuery.trim()) {
        const search = searchQuery.trim();
        query = query.or(
          `name.ilike.%${search}%,category.ilike.%${search}%,location.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      type RawEvent = Tables<"events"> & {
        event_people: { id: string }[];
      };

      const raw = (data ?? []) as unknown as RawEvent[];

      const mapped: EventWithCount[] = raw.map((e) => ({
        id: e.id,
        user_id: e.user_id,
        name: e.name,
        category: e.category,
        event_date: e.event_date,
        location: e.location,
        url: e.url,
        description: e.description,
        notes: e.notes,
        is_archived: e.is_archived,
        created_at: e.created_at,
        updated_at: e.updated_at,
        people_count: e.event_people?.length ?? 0,
      }));

      setEvents(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setIsLoading(false);
    }
  }, [userId, searchQuery]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const refresh = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, error, refresh };
}
