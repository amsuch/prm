import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables, InsertTables, UpdateTables } from "@/types/database";

export type ChatSession = Tables<"chat_sessions">;

export function useChatSessions() {
  const { session } = useSession();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user?.id;

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }) as unknown as {
        data: ChatSession[] | null;
        error: { message: string } | null;
      };

      if (error) throw new Error(error.message);
      setSessions(data ?? []);
    } catch {
      // Silently fail -- sessions list just stays empty
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (title?: string): Promise<string | null> => {
      if (!userId) return null;

      const insertRow: InsertTables<"chat_sessions"> = {
        user_id: userId,
        title: title ?? "New Chat",
      };

      try {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert(insertRow)
          .select()
          .single() as unknown as {
          data: ChatSession | null;
          error: { message: string } | null;
        };

        if (error) throw new Error(error.message);
        if (!data) return null;

        setSessions((prev) => [data, ...prev]);
        setActiveSessionId(data.id);
        return data.id;
      } catch {
        return null;
      }
    },
    [userId],
  );

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      if (!userId) return;

      try {
        // Delete messages first (cascade may handle this, but be explicit)
        await (supabase
          .from("chat_messages")
          .delete()
          .eq("session_id", id) as unknown as Promise<{
          error: { message: string } | null;
        }>);

        const { error } = await (supabase
          .from("chat_sessions")
          .delete()
          .eq("id", id) as unknown as Promise<{
          error: { message: string } | null;
        }>);

        if (error) throw new Error(error.message);

        setSessions((prev) => prev.filter((s) => s.id !== id));

        // If we deleted the active session, clear it
        if (activeSessionId === id) {
          setActiveSessionId(null);
        }
      } catch {
        // Silently fail
      }
    },
    [userId, activeSessionId],
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      if (!userId) return;

      const updateRow: UpdateTables<"chat_sessions"> = { title };

      try {
        const { error } = await (supabase
          .from("chat_sessions")
          .update(updateRow)
          .eq("id", id) as unknown as Promise<{
          error: { message: string } | null;
        }>);

        if (error) throw new Error(error.message);

        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title } : s)),
        );
      } catch {
        // Silently fail
      }
    },
    [userId],
  );

  const touchSession = useCallback(
    async (id: string) => {
      if (!userId) return;

      const now = new Date().toISOString();
      const updateRow: UpdateTables<"chat_sessions"> = { updated_at: now };

      try {
        await (supabase
          .from("chat_sessions")
          .update(updateRow)
          .eq("id", id) as unknown as Promise<{
          error: { message: string } | null;
        }>);

        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, updated_at: now } : s)),
        );
      } catch {
        // Silently fail
      }
    },
    [userId],
  );

  return {
    sessions,
    activeSessionId,
    isLoading,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    touchSession,
    refetch: fetchSessions,
  };
}
