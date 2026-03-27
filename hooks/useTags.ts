import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";

export function useTags() {
  const { session } = useSession();
  const [tags, setTags] = useState<Tables<"tags">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const fetchTags = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      if (queryError) throw queryError;

      setTags(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tags");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(
    async (name: string, color?: string): Promise<Tables<"tags"> | null> => {
      if (!userId) return null;

      try {
        const { data, error: insertError } = await supabase
          .from("tags")
          .insert({ user_id: userId, name, color: color ?? null })
          .select()
          .single();

        if (insertError) throw insertError;

        setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create tag");
        return null;
      }
    },
    [userId],
  );

  return { tags, isLoading, error, refetch: fetchTags, createTag };
}
