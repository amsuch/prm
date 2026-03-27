import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type RelationshipItem = {
  relationship_id: string;
  related_contact_id: string;
  related_first_name: string;
  related_last_name: string | null;
  related_company: string | null;
  related_avatar_url: string | null;
  relationship_name: string;
  relationship_category: string;
  notes: string | null;
};

export type GroupedRelationships = Record<string, RelationshipItem[]>;

/**
 * Hook to fetch and manage relationships for a specific contact.
 * Uses the get_contact_relationships RPC function which handles
 * both sides of the relationship and resolves correct labels
 * for symmetric and asymmetric types.
 */
export function useRelationships(contactId: string | undefined) {
  const [relationships, setRelationships] = useState<RelationshipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRelationships = useCallback(async () => {
    if (!contactId) {
      setRelationships([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_contact_relationships",
        { p_contact_id: contactId },
      );

      if (rpcError) throw rpcError;

      setRelationships((data ?? []) as RelationshipItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch relationships");
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // Group relationships by category (Family, Professional, Social, Other)
  const groupedRelationships: GroupedRelationships = relationships.reduce<GroupedRelationships>(
    (acc, rel) => {
      const category = rel.relationship_category || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(rel);
      return acc;
    },
    {},
  );

  const refresh = useCallback(async () => {
    await fetchRelationships();
  }, [fetchRelationships]);

  return {
    relationships,
    groupedRelationships,
    isLoading,
    error,
    refresh,
    refetch: fetchRelationships,
  };
}
