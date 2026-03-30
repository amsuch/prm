import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import { sanitizePostgrestValue } from "@/lib/sanitize";

export type RelationshipType = {
  id: string;
  name: string;
  reverse_name: string;
  category: string;
  is_symmetric: boolean;
  is_system: boolean;
  user_id: string | null;
  created_at: string;
};

export function useRelationshipTypes() {
  const { session } = useSession();
  const [types, setTypes] = useState<RelationshipType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user?.id;

  const fetchTypes = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const { data, error: queryError } = await supabase
        .from("relationship_types")
        .select("*")
        .or(`is_system.eq.true,user_id.eq.${sanitizePostgrestValue(userId)}`)
        .order("category")
        .order("name");

      if (queryError) throw queryError;

      setTypes((data as RelationshipType[]) ?? []);
    } catch {
      setTypes([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const createType = useCallback(
    async (input: {
      name: string;
      reverse_name: string;
      category: string;
      is_symmetric: boolean;
    }): Promise<RelationshipType | null> => {
      if (!userId) return null;

      try {
        const { data, error: insertError } = await supabase
          .from("relationship_types")
          .insert({
            user_id: userId,
            name: input.name.trim(),
            reverse_name: input.reverse_name.trim(),
            category: input.category,
            is_symmetric: input.is_symmetric,
            is_system: false,
          } as never)
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchTypes();
        return data as RelationshipType;
      } catch (err) {
        throw err;
      }
    },
    [userId, fetchTypes],
  );

  const deleteType = useCallback(
    async (typeId: string): Promise<void> => {
      try {
        const { error: deleteError } = await supabase
          .from("relationship_types")
          .delete()
          .eq("id", typeId);

        if (deleteError) throw deleteError;

        await fetchTypes();
      } catch (err) {
        throw err;
      }
    },
    [fetchTypes],
  );

  return { types, isLoading, refetch: fetchTypes, createType, deleteType };
}
