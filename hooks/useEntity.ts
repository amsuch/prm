import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type EntityFull = Tables<"entities">;
export type EntityPerson = Tables<"entity_people">;

export function useEntity(entityId: string | undefined) {
  const [entity, setEntity] = useState<EntityFull | null>(null);
  const [people, setPeople] = useState<EntityPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntity = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("entities")
        .select("*")
        .eq("id", entityId)
        .single();

      if (queryError) throw queryError;

      setEntity(data as unknown as EntityFull);

      const { data: peopleData, error: peopleError } = await supabase
        .from("entity_people")
        .select("*")
        .eq("entity_id", entityId)
        .order("first_name", { ascending: true });

      if (peopleError) throw peopleError;

      setPeople((peopleData ?? []) as unknown as EntityPerson[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch entity");
    } finally {
      setIsLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchEntity();
  }, [fetchEntity]);

  return { entity, people, isLoading, error, refresh: fetchEntity };
}
