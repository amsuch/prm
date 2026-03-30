import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";
import {
  syncCalendar,
  connectCalendar,
  disconnectCalendar,
  getCalendarSuggestions,
  type SyncResult,
  type Suggestion,
} from "@/lib/calendarSync";

export type CalendarSyncData = {
  isConnected: boolean;
  lastSyncAt: string | null;
  isSyncing: boolean;
  syncResult: SyncResult | null;
  syncError: string | null;
  suggestions: Suggestion[];
  pendingSuggestionsCount: number;
  isLoading: boolean;
  sync: () => Promise<void>;
  connect: (providerToken: string, refreshToken?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refetch: () => Promise<void>;
};

export function useCalendarSync(): CalendarSyncData {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [syncState, setSyncState] = useState<Tables<"calendar_sync_state"> | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchState = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const { data } = await supabase
        .from("calendar_sync_state")
        .select("*")
        .eq("user_id", userId)
        .single();

      setSyncState(data as unknown as Tables<"calendar_sync_state"> | null);

      const sug = await getCalendarSuggestions(userId);
      setSuggestions(sug);
    } catch {
      // No sync state yet – that's fine
      setSyncState(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const sync = useCallback(async () => {
    if (!userId || !syncState?.is_connected) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      const result = await syncCalendar(userId);
      setSyncResult(result);
      await fetchState();
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Sync failed",
      );
    } finally {
      setIsSyncing(false);
    }
  }, [userId, syncState?.is_connected, fetchState]);

  const handleConnect = useCallback(
    async (providerToken: string, refreshToken?: string) => {
      if (!userId) return;
      await connectCalendar(userId, providerToken, refreshToken);
      await fetchState();
    },
    [userId, fetchState],
  );

  const handleDisconnect = useCallback(async () => {
    if (!userId) return;
    await disconnectCalendar(userId);
    setSyncState(null);
    setSyncResult(null);
    setSyncError(null);
  }, [userId]);

  const pendingSuggestionsCount = suggestions.filter(
    (s) => s.status === "pending",
  ).length;

  return {
    isConnected: syncState?.is_connected ?? false,
    lastSyncAt: syncState?.last_sync_at ?? null,
    isSyncing,
    syncResult,
    syncError,
    suggestions,
    pendingSuggestionsCount,
    isLoading,
    sync,
    connect: handleConnect,
    disconnect: handleDisconnect,
    refetch: fetchState,
  };
}
