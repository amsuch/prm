import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";

export function useCustomFieldDefinitions() {
  const { session } = useSession();
  const [definitions, setDefinitions] = useState<Tables<"custom_field_definitions">[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const fetchDefinitions = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("user_id", userId)
        .order("display_order", { ascending: true });

      if (queryError) throw queryError;

      setDefinitions(data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch custom field definitions",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  return { definitions, isLoading, error, refetch: fetchDefinitions };
}
