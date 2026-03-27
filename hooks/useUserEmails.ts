import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";

export type UserEmailsData = {
  emails: Tables<"user_emails">[];
  isLoading: boolean;
  error: string | null;
  addEmail: (email: string, label: string) => Promise<void>;
  removeEmail: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
};

export function useUserEmails(): UserEmailsData {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [emails, setEmails] = useState<Tables<"user_emails">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("user_emails")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (queryError) throw queryError;

      setEmails((data ?? []) as unknown as Tables<"user_emails">[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch emails");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const addEmail = useCallback(
    async (email: string, label: string) => {
      if (!userId) return;

      const { error: insertError } = await supabase
        .from("user_emails")
        .insert({ user_id: userId, email, label } as never);

      if (insertError) throw insertError;

      await fetchEmails();
    },
    [userId, fetchEmails],
  );

  const removeEmail = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from("user_emails")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      await fetchEmails();
    },
    [fetchEmails],
  );

  return {
    emails,
    isLoading,
    error,
    addEmail,
    removeEmail,
    refetch: fetchEmails,
  };
}
