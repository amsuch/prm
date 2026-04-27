import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";
import {
  syncCalendar,
  connectCalendar,
  disconnectCalendar,
  getCalendarSuggestions,
  CalendarTokenExpiredError,
  type SyncResult,
  type Suggestion,
} from "@/lib/calendarSync";

// Refresh the Google access token if it expires within this window.
const TOKEN_REFRESH_BUFFER_MS = 60_000;
// Auto-sync on app focus if the last sync was longer ago than this.
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

export type CalendarSyncData = {
  isConnected: boolean;
  lastSyncAt: string | null;
  providerToken: string | null;
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

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke<{
      access_token?: string;
      expires_at?: string;
      error?: string;
    }>("refresh-google-token", { body: {} });

    if (error || !data?.access_token) {
      throw new Error(
        data?.error ?? error?.message ?? "Failed to refresh Google token",
      );
    }
    return data.access_token;
  }, []);

  const sync = useCallback(async () => {
    if (!userId || !syncState?.provider_token) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      let accessToken = syncState.provider_token;

      // Pre-flight refresh if the token is missing an expiry or near/past expiry.
      const expiresAt = syncState.provider_token_expires_at
        ? new Date(syncState.provider_token_expires_at).getTime()
        : null;
      const needsRefresh =
        expiresAt !== null && expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS;

      if (needsRefresh) {
        const refreshed = await refreshAccessToken();
        if (refreshed) accessToken = refreshed;
      }

      let result: SyncResult;
      try {
        result = await syncCalendar(userId, accessToken);
      } catch (err) {
        // Server-side rejection — refresh once and retry.
        if (err instanceof CalendarTokenExpiredError) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) throw err;
          result = await syncCalendar(userId, refreshed);
        } else {
          throw err;
        }
      }

      setSyncResult(result);
      await fetchState();
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Sync failed",
      );
    } finally {
      setIsSyncing(false);
    }
  }, [
    userId,
    syncState?.provider_token,
    syncState?.provider_token_expires_at,
    fetchState,
    refreshAccessToken,
  ]);

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

  // Auto-sync on app focus when the last sync is older than AUTO_SYNC_INTERVAL_MS.
  // Stash the latest values in a ref so the AppState listener doesn't churn.
  const autoSyncRef = useRef({
    isConnected: false,
    lastSyncAt: null as string | null,
    isSyncing: false,
    sync,
  });
  autoSyncRef.current = {
    isConnected: syncState?.is_connected ?? false,
    lastSyncAt: syncState?.last_sync_at ?? null,
    isSyncing,
    sync,
  };

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== "active") return;
      const { isConnected, lastSyncAt, isSyncing: currentlySyncing, sync: doSync } =
        autoSyncRef.current;
      if (!isConnected || currentlySyncing) return;
      const lastMs = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
      if (Date.now() - lastMs >= AUTO_SYNC_INTERVAL_MS) {
        doSync().catch(() => {
          // sync() already records errors into syncError state.
        });
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const pendingSuggestionsCount = suggestions.filter(
    (s) => s.status === "pending",
  ).length;

  return {
    isConnected: syncState?.is_connected ?? false,
    lastSyncAt: syncState?.last_sync_at ?? null,
    providerToken: syncState?.provider_token ?? null,
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
