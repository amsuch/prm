import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";

export type EntityCategory = Tables<"entity_categories">;

export function useEntityCategories() {
  const { session } = useSession();
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const fetchCategories = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch system categories (user_id IS NULL) and user's own categories
      const { data, error: queryError } = await supabase
        .from("entity_categories")
        .select("*")
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });

      if (queryError) throw queryError;

      setCategories((data ?? []) as unknown as EntityCategory[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch entity categories",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(
    async (data: { name: string; icon: string; color: string }) => {
      if (!userId) throw new Error("Not authenticated");

      const { error: insertError } = await supabase
        .from("entity_categories")
        .insert({
          user_id: userId,
          name: data.name,
          icon: data.icon,
          color: data.color,
          is_system: false,
        } as never);

      if (insertError) throw insertError;
      await fetchCategories();
    },
    [userId, fetchCategories],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from("entity_categories")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      await fetchCategories();
    },
    [fetchCategories],
  );

  return {
    categories,
    isLoading,
    error,
    createCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}
