import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables, InsertTables, UpdateTables, Json } from "@/types/database";

export type ChatMessageRow = Tables<"chat_messages">;

export function useChatMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }) as unknown as {
        data: ChatMessageRow[] | null;
        error: { message: string } | null;
      };

      if (error) throw new Error(error.message);
      setMessages(data ?? []);
    } catch {
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const addMessage = useCallback(
    async (
      role: string,
      content: string,
      responseJson?: unknown,
      toolProgressJson?: unknown,
    ): Promise<ChatMessageRow | null> => {
      if (!sessionId) return null;

      const insertRow: InsertTables<"chat_messages"> = {
        session_id: sessionId,
        role,
        content,
        response_json: (responseJson ?? null) as Json,
        tool_progress_json: (toolProgressJson ?? null) as Json,
      };

      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .insert(insertRow)
          .select()
          .single() as unknown as {
          data: ChatMessageRow | null;
          error: { message: string } | null;
        };

        if (error) throw new Error(error.message);
        if (!data) return null;

        setMessages((prev) => [...prev, data]);
        return data;
      } catch {
        return null;
      }
    },
    [sessionId],
  );

  const updateMessage = useCallback(
    async (
      id: string,
      content: string,
      responseJson?: unknown,
      toolProgressJson?: unknown,
    ) => {
      const updateRow: UpdateTables<"chat_messages"> = {
        content,
        response_json: (responseJson ?? null) as Json,
        tool_progress_json: (toolProgressJson ?? null) as Json,
      };

      try {
        await (supabase
          .from("chat_messages")
          .update(updateRow)
          .eq("id", id) as unknown as Promise<{
          error: { message: string } | null;
        }>);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  content,
                  response_json: (responseJson ?? null) as Json,
                  tool_progress_json: (toolProgressJson ?? null) as Json,
                }
              : m,
          ),
        );
      } catch {
        // Silently fail
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    addMessage,
    updateMessage,
    clearMessages,
    refetch: fetchMessages,
  };
}
