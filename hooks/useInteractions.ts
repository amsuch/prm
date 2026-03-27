import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type InteractionRow = Tables<"interactions">;

export type DateGroup = {
  title: string;
  data: InteractionRow[];
};

/**
 * Get a human-readable group label for a date.
 */
function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const interactionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (interactionDate.getTime() >= today.getTime()) {
    return "Today";
  }
  if (interactionDate.getTime() >= yesterday.getTime()) {
    return "Yesterday";
  }
  if (interactionDate.getTime() >= weekAgo.getTime()) {
    return "This Week";
  }
  return "Earlier";
}

/**
 * Hook to fetch interactions for a specific contact.
 * Returns interactions sorted by occurred_at desc and grouped by date.
 */
export function useInteractions(contactId: string | undefined) {
  const [interactions, setInteractions] = useState<InteractionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInteractions = useCallback(async () => {
    if (!contactId) {
      setInteractions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("interactions")
        .select("*")
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(50);

      if (queryError) throw queryError;

      setInteractions(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch interactions");
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  // Group interactions by date for SectionList rendering
  const groupedInteractions: DateGroup[] = useMemo(() => {
    if (interactions.length === 0) return [];

    const groups: Record<string, InteractionRow[]> = {};
    const groupOrder: string[] = [];

    for (const interaction of interactions) {
      const label = getDateGroupLabel(interaction.occurred_at);
      if (!groups[label]) {
        groups[label] = [];
        groupOrder.push(label);
      }
      groups[label].push(interaction);
    }

    return groupOrder.map((title) => ({
      title,
      data: groups[title],
    }));
  }, [interactions]);

  const refresh = useCallback(async () => {
    await fetchInteractions();
  }, [fetchInteractions]);

  return {
    interactions,
    groupedInteractions,
    isLoading,
    error,
    refresh,
    refetch: fetchInteractions,
  };
}
