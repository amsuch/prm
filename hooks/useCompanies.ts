import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";

export function useCompanies() {
  const { session } = useSession();
  const [companies, setCompanies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user?.id;

  const fetchCompanies = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const { data, error: queryError } = await supabase
        .from("contacts")
        .select("company")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .not("company", "is", null)
        .not("company", "eq", "");

      if (queryError) throw queryError;

      const unique = [
        ...new Set(
          (data ?? [])
            .map((row) => row.company)
            .filter((c): c is string => c !== null && c !== ""),
        ),
      ].sort((a, b) => a.localeCompare(b));

      setCompanies(unique);
    } catch {
      // Silently fail — autocomplete is non-critical
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return { companies, isLoading, refetch: fetchCompanies };
}
