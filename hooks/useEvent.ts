import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type EventFull = Tables<"events">;
export type EventPerson = Tables<"event_people">;

export function useEvent(eventId: string | undefined) {
  const [event, setEvent] = useState<EventFull | null>(null);
  const [people, setPeople] = useState<EventPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (queryError) throw queryError;

      setEvent(data as unknown as EventFull);

      const { data: peopleData, error: peopleError } = await supabase
        .from("event_people")
        .select("*")
        .eq("event_id", eventId)
        .order("first_name", { ascending: true });

      if (peopleError) throw peopleError;

      setPeople((peopleData ?? []) as unknown as EventPerson[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch event");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, people, isLoading, error, refresh: fetchEvent };
}
