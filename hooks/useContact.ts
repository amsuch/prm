import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type ContactFull = Tables<"contacts"> & {
  contact_emails: Tables<"contact_emails">[];
  contact_phones: Tables<"contact_phones">[];
  contact_urls: Tables<"contact_urls">[];
  contact_tags: { tag_id: string; tags: Tables<"tags"> }[];
};

export function useContact(contactId: string | undefined) {
  const [contact, setContact] = useState<ContactFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("contacts")
        .select(
          `
          *,
          contact_emails (*),
          contact_phones (*),
          contact_urls (*),
          contact_tags (tag_id, tags (*))
        `,
        )
        .eq("id", contactId)
        .single();

      if (queryError) throw queryError;

      setContact(data as unknown as ContactFull);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch contact");
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  return { contact, isLoading, error, refetch: fetchContact };
}
