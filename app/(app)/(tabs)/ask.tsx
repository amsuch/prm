import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useSession } from "@/lib/auth/ctx";
import { getLLMConfigFromSession } from "@/lib/llm";
import {
  runAgentLoop,
  resumeAfterApproval,
  type AgentEvent,
  type ToolCall,
  type ToolMessage,
} from "@/lib/agentLoop";
import { parseQuery, getQueryDescription, isActionIntent } from "@/lib/queryParser";
import {
  executeQuery,
  previewAction,
  confirmAction,
  type AgentResponse,
  type PendingAction,
} from "@/lib/agent";
import { ChatBubble } from "@/components/ChatBubble";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import {
  useSearch,
  type SearchFilters,
} from "@/hooks/useSearch";
import { useChatSessions, type ChatSession } from "@/hooks/useChatSessions";
import { useChatMessages } from "@/hooks/useChatMessages";

type AgentMode = "hitl" | "auto";

type ToolProgress = {
  name: string;
  status: "running" | "done" | "error";
  arguments?: Record<string, unknown>;
  result?: unknown;
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  response?: AgentResponse;
  isLoading?: boolean;
  toolProgress?: ToolProgress[];
  pendingApproval?: {
    toolCall: ToolCall;
    toolName: string;
    description: string;
    preview: unknown;
  };
  dbId?: string; // database row id for updating after agent finishes
};

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}-${Date.now()}`;
}

const DRAWER_WIDTH = Math.min(320, Dimensions.get("window").width * 0.85);

export default function AskScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>("hitl");
  const [showHistory, setShowHistory] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isFirstMessage, setIsFirstMessage] = useState(false);

  // Chat sessions & messages hooks
  const {
    sessions,
    activeSessionId,
    isLoading: sessionsLoading,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    touchSession,
  } = useChatSessions();

  const {
    messages: dbMessages,
    isLoading: messagesLoading,
    addMessage: addDbMessage,
    updateMessage: updateDbMessage,
    clearMessages: clearDbMessages,
  } = useChatMessages(activeSessionId);

  // Conversation history for the LLM agent (persisted across turns)
  const conversationHistory = useRef<ToolMessage[]>([]);
  // Pending approval state for resuming after HITL
  const pendingApprovalRef = useRef<{
    toolCall: ToolCall;
    messages: ToolMessage[];
  } | null>(null);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const { filters, search, clearFilters, activeFilterCount } = useSearch();

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // -------------------------------------------------------------------
  // On mount: load most recent session or create one
  // -------------------------------------------------------------------
  useEffect(() => {
    if (sessionsLoading || !userId) return;
    if (activeSessionId) return; // already have one

    if (sessions.length > 0) {
      // Switch to most recent
      switchSession(sessions[0].id);
    } else {
      // Create first session
      createSession("New Chat");
    }
  }, [sessionsLoading, userId, activeSessionId, sessions, switchSession, createSession]);

  // -------------------------------------------------------------------
  // When session switches, load messages from DB
  // -------------------------------------------------------------------
  useEffect(() => {
    if (messagesLoading || !activeSessionId) return;

    // Rebuild in-memory messages from DB rows
    const loaded: ChatMessage[] = dbMessages.map((m) => {
      const toolProg = m.tool_progress_json
        ? (m.tool_progress_json as unknown as ToolProgress[])
        : undefined;
      const resp = m.response_json
        ? (m.response_json as unknown as AgentResponse)
        : undefined;

      return {
        id: m.id,
        role: m.role === "user" ? "user" : "agent",
        text: m.content,
        response: resp,
        toolProgress: toolProg,
        dbId: m.id,
      };
    });

    setMessages(loaded);

    // Rebuild conversation history for the LLM from DB messages.
    // Only include user messages and FINAL agent responses (skip intermediate
    // placeholders like "Thinking...", "Searching contacts...", etc.)
    const history: ToolMessage[] = [];
    for (const m of dbMessages) {
      if (m.role === "user") {
        history.push({ role: "user", content: m.content });
      } else if (m.role === "agent") {
        // Skip placeholder / intermediate messages that aren't real LLM responses
        if (
          m.content === "Thinking..." ||
          m.content === "Executing..." ||
          m.content === "Something went wrong. Please try again." ||
          !m.content.trim()
        ) {
          continue;
        }
        history.push({ role: "assistant", content: m.content });
      }
    }
    // Ensure alternating user/assistant turns — LLMs expect this
    // If there are consecutive same-role messages, only keep the last one
    const cleanHistory: ToolMessage[] = [];
    for (const msg of history) {
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === msg.role) {
        cleanHistory[cleanHistory.length - 1] = msg; // replace with latest
      } else {
        cleanHistory.push(msg);
      }
    }
    conversationHistory.current = cleanHistory;
    console.log("[Chat] Rebuilt history:", cleanHistory.length, "messages for session", activeSessionId);

    // Check if this is a fresh session (no messages)
    setIsFirstMessage(dbMessages.length === 0);
  }, [dbMessages, messagesLoading, activeSessionId]);

  // -------------------------------------------------------------------
  // Drawer animation
  // -------------------------------------------------------------------
  const openDrawer = useCallback(() => {
    setShowHistory(true);
    Animated.spring(drawerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowHistory(false));
  }, [drawerAnim]);

  // -------------------------------------------------------------------
  // Auto-title after first agent response
  // -------------------------------------------------------------------
  const autoTitleSession = useCallback(
    async (userText: string) => {
      if (!activeSessionId) return;
      const truncated =
        userText.length > 40 ? userText.slice(0, 37) + "..." : userText;
      await renameSession(activeSessionId, truncated);
    },
    [activeSessionId, renameSession],
  );

  // -------------------------------------------------------------------
  // Tool-calling agent flow (when LLM is configured)
  // -------------------------------------------------------------------
  const handleAgentSend = useCallback(
    async (messageText: string, agentMsgId: string, agentDbId: string) => {
      const llmConfig = getLLMConfigFromSession(session);
      if (!llmConfig || !userId) return;

      const autoApprove = agentMode === "auto";

      const generator = runAgentLoop(
        messageText,
        llmConfig,
        userId,
        conversationHistory.current,
        autoApprove,
      );

      const toolProgress: ToolProgress[] = [];
      let finalText = "";

      for await (const event of generator) {
        switch (event.type) {
          case "thinking":
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? { ...msg, text: event.text, isLoading: true }
                  : msg,
              ),
            );
            break;

          case "tool_call":
            toolProgress.push({
              name: event.name,
              status: "running",
              arguments: event.arguments,
            });
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? {
                      ...msg,
                      text: getToolLabel(event.name, event.arguments),
                      isLoading: true,
                      toolProgress: [...toolProgress],
                    }
                  : msg,
              ),
            );
            break;

          case "tool_result": {
            const idx = toolProgress.findIndex(
              (tp) => tp.name === event.name && tp.status === "running",
            );
            if (idx >= 0) {
              toolProgress[idx] = {
                ...toolProgress[idx],
                status: "done",
                result: event.result,
              };
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? {
                      ...msg,
                      toolProgress: [...toolProgress],
                    }
                  : msg,
              ),
            );
            break;
          }

          case "approval_needed":
            pendingApprovalRef.current = {
              toolCall: event.toolCall,
              messages: [
                ...conversationHistory.current,
                { role: "user" as const, content: messageText },
                { role: "assistant" as const, content: null, toolCalls: [event.toolCall] },
              ],
            };
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? {
                      ...msg,
                      text: event.description,
                      isLoading: false,
                      toolProgress: [...toolProgress],
                      pendingApproval: {
                        toolCall: event.toolCall,
                        toolName: event.toolName,
                        description: event.description,
                        preview: event.preview,
                      },
                    }
                  : msg,
              ),
            );
            // Save to DB with approval state
            await updateDbMessage(
              agentDbId,
              event.description,
              undefined,
              [...toolProgress],
            );
            break;

          case "text":
            finalText = event.text;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? { ...msg, text: event.text, isLoading: false }
                  : msg,
              ),
            );
            break;

          case "done":
            finalText = event.finalText;
            // Add user message and assistant response to conversation history
            conversationHistory.current.push({
              role: "user",
              content: messageText,
            });
            conversationHistory.current.push({
              role: "assistant",
              content: event.finalText,
            });
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? {
                      ...msg,
                      text: event.finalText,
                      isLoading: false,
                      toolProgress: [...toolProgress],
                    }
                  : msg,
              ),
            );
            // Persist final agent response to DB
            await updateDbMessage(
              agentDbId,
              event.finalText,
              undefined,
              toolProgress.length > 0 ? [...toolProgress] : undefined,
            );
            // Touch session timestamp
            if (activeSessionId) await touchSession(activeSessionId);
            // Auto-title on first message
            if (isFirstMessage) {
              await autoTitleSession(messageText);
              setIsFirstMessage(false);
            }
            break;

          case "error":
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? {
                      ...msg,
                      text: event.text,
                      isLoading: false,
                      response: {
                        type: "error" as const,
                        message: event.text,
                      },
                    }
                  : msg,
              ),
            );
            await updateDbMessage(
              agentDbId,
              event.text,
              { type: "error", message: event.text },
            );
            break;
        }
      }
    },
    [session, userId, agentMode, activeSessionId, touchSession, isFirstMessage, autoTitleSession, updateDbMessage],
  );

  // -------------------------------------------------------------------
  // Fallback flow (no LLM configured -- regex parser + Supabase)
  // -------------------------------------------------------------------
  const handleFallbackSend = useCallback(
    async (messageText: string, agentMsgId: string, agentDbId: string) => {
      if (!userId) return;

      const parsed = parseQuery(messageText);

      try {
        let response: AgentResponse;
        const llmConfig = getLLMConfigFromSession(session);

        if (agentMode === "hitl" && isActionIntent(parsed)) {
          response = await previewAction(parsed, userId);
        } else {
          response = await executeQuery(parsed, userId, llmConfig);
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMsgId
              ? {
                  ...msg,
                  text: response.message,
                  response,
                  isLoading: false,
                }
              : msg,
          ),
        );

        // Persist to DB
        await updateDbMessage(agentDbId, response.message, response);
        if (activeSessionId) await touchSession(activeSessionId);

        // Auto-title on first message
        if (isFirstMessage) {
          await autoTitleSession(messageText);
          setIsFirstMessage(false);
        }
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMsgId
              ? {
                  ...msg,
                  text: "Something went wrong. Please try again.",
                  isLoading: false,
                  response: {
                    type: "error" as const,
                    message: "Something went wrong.",
                  },
                }
              : msg,
          ),
        );
        await updateDbMessage(
          agentDbId,
          "Something went wrong. Please try again.",
          { type: "error", message: "Something went wrong." },
        );
      }
    },
    [userId, session, agentMode, activeSessionId, touchSession, isFirstMessage, autoTitleSession, updateDbMessage],
  );

  // -------------------------------------------------------------------
  // Send handler -- routes to agent or fallback
  // -------------------------------------------------------------------
  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text ?? inputText).trim();
      if (!messageText || !userId || isProcessing) return;

      // Ensure we have an active session
      let currentSessionId = activeSessionId;
      if (!currentSessionId) {
        currentSessionId = await createSession("New Chat");
        if (!currentSessionId) return;
      }

      setInputText("");
      setIsProcessing(true);

      const userMsgId = nextId();
      const agentMsgId = nextId();

      const llmConfig = getLLMConfigFromSession(session);

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        text: messageText,
      };

      const loadingMsg: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        text: llmConfig ? "Thinking..." : getQueryDescription(parseQuery(messageText)),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);

      // Persist user message to DB
      await addDbMessage("user", messageText);

      // Persist placeholder agent message to DB (will be updated when done)
      const agentRow = await addDbMessage("agent", "Thinking...");
      const agentDbId = agentRow?.id ?? agentMsgId;

      try {
        if (llmConfig) {
          await handleAgentSend(messageText, agentMsgId, agentDbId);
        } else {
          await handleFallbackSend(messageText, agentMsgId, agentDbId);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [inputText, userId, isProcessing, session, activeSessionId, createSession, addDbMessage, handleAgentSend, handleFallbackSend],
  );

  // -------------------------------------------------------------------
  // Approval handlers
  // -------------------------------------------------------------------
  const handleApprove = useCallback(
    async (pendingAction?: PendingAction) => {
      if (!userId) return;
      setIsProcessing(true);
      const agentMsgId = nextId();

      const loadingMsg: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        text: "Executing...",
        isLoading: true,
      };
      setMessages((prev) => [...prev, loadingMsg]);

      const agentRow = await addDbMessage("agent", "Executing...");
      const agentDbId = agentRow?.id ?? agentMsgId;

      const llmConfig = getLLMConfigFromSession(session);

      // If we have a pending tool call from the agent loop, resume it
      if (pendingApprovalRef.current && llmConfig) {
        const { toolCall, messages: savedMessages } =
          pendingApprovalRef.current;
        pendingApprovalRef.current = null;

        const generator = resumeAfterApproval(
          true,
          toolCall,
          llmConfig,
          userId,
          savedMessages,
        );

        for await (const event of generator) {
          switch (event.type) {
            case "tool_call":
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentMsgId
                    ? { ...msg, text: getToolLabel(event.name, event.arguments) }
                    : msg,
                ),
              );
              break;
            case "text":
            case "done":
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentMsgId
                    ? {
                        ...msg,
                        text:
                          event.type === "done"
                            ? event.finalText
                            : event.text,
                        isLoading: false,
                      }
                    : msg,
                ),
              );
              if (event.type === "done") {
                // Restore full history: savedMessages includes previous turns +
                // the user message + assistant tool-call from before approval.
                // Add the final assistant response on top.
                conversationHistory.current = [
                  ...savedMessages,
                  { role: "assistant" as const, content: event.finalText },
                ];
                await updateDbMessage(agentDbId, event.finalText);
                if (activeSessionId) await touchSession(activeSessionId);
              }
              break;
            case "error":
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentMsgId
                    ? {
                        ...msg,
                        text: event.text,
                        isLoading: false,
                        response: {
                          type: "error" as const,
                          message: event.text,
                        },
                      }
                    : msg,
                ),
              );
              await updateDbMessage(
                agentDbId,
                event.text,
                { type: "error", message: event.text },
              );
              break;
          }
        }
      } else if (pendingAction) {
        // Fallback: old-style HITL approval for regex parser
        try {
          const response = await confirmAction(pendingAction);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? {
                    ...msg,
                    text: response.message,
                    response,
                    isLoading: false,
                  }
                : msg,
            ),
          );
          await updateDbMessage(agentDbId, response.message, response);
        } catch {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? {
                    ...msg,
                    text: "Action failed. Please try again.",
                    isLoading: false,
                    response: {
                      type: "error" as const,
                      message: "Action failed.",
                    },
                  }
                : msg,
            ),
          );
          await updateDbMessage(
            agentDbId,
            "Action failed. Please try again.",
            { type: "error", message: "Action failed." },
          );
        }
      }

      setIsProcessing(false);
    },
    [userId, session, activeSessionId, touchSession, addDbMessage, updateDbMessage],
  );

  const handleReject = useCallback(async () => {
    // If we have a pending tool call, reject it
    if (pendingApprovalRef.current) {
      pendingApprovalRef.current = null;
    }

    const cancelMsgId = nextId();
    setMessages((prev) => [
      ...prev,
      {
        id: cancelMsgId,
        role: "agent",
        text: "Action cancelled.",
        response: { type: "text" as const, message: "Action cancelled." },
      },
    ]);

    await addDbMessage(
      "agent",
      "Action cancelled.",
      { type: "text", message: "Action cancelled." },
    );
  }, [addDbMessage]);

  const handleSuggestionSelect = useCallback(
    (question: string) => {
      handleSend(question);
    },
    [handleSend],
  );

  const handleApplyFilters = useCallback(
    (newFilters: SearchFilters) => {
      search(newFilters);
    },
    [search],
  );

  const handleClearFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  // -------------------------------------------------------------------
  // New chat handler
  // -------------------------------------------------------------------
  const handleNewChat = useCallback(async () => {
    conversationHistory.current = [];
    pendingApprovalRef.current = null;
    setMessages([]);
    clearDbMessages();
    setIsFirstMessage(true);
    await createSession("New Chat");
    closeDrawer();
  }, [createSession, clearDbMessages, closeDrawer]);

  // -------------------------------------------------------------------
  // Switch session handler
  // -------------------------------------------------------------------
  const handleSwitchSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) {
        closeDrawer();
        return;
      }
      conversationHistory.current = [];
      pendingApprovalRef.current = null;
      setMessages([]);
      clearDbMessages();
      switchSession(id);
      closeDrawer();
    },
    [activeSessionId, switchSession, clearDbMessages, closeDrawer],
  );

  // -------------------------------------------------------------------
  // Delete session handler
  // -------------------------------------------------------------------
  const handleDeleteSession = useCallback(
    (id: string) => {
      Alert.alert(
        "Delete Chat",
        "Are you sure you want to delete this chat session?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteSession(id);
              // If deleted the active session, start fresh
              if (id === activeSessionId) {
                conversationHistory.current = [];
                pendingApprovalRef.current = null;
                setMessages([]);
                clearDbMessages();
                setIsFirstMessage(true);
              }
            },
          },
        ],
      );
    },
    [deleteSession, activeSessionId, clearDbMessages],
  );

  // -------------------------------------------------------------------
  // Title editing
  // -------------------------------------------------------------------
  const startEditingTitle = useCallback(() => {
    if (activeSession) {
      setTitleDraft(activeSession.title);
      setEditingTitle(true);
    }
  }, [activeSession]);

  const finishEditingTitle = useCallback(async () => {
    if (activeSessionId && titleDraft.trim()) {
      await renameSession(activeSessionId, titleDraft.trim());
    }
    setEditingTitle(false);
  }, [activeSessionId, titleDraft, renameSession]);

  const hasMessages = messages.length > 0;

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble
        role={item.role}
        text={item.text}
        response={item.response}
        isLoading={item.isLoading}
        toolProgress={item.toolProgress}
        pendingApproval={item.pendingApproval}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    ),
    [handleApprove, handleReject],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // -------------------------------------------------------------------
  // Format date for session list
  // -------------------------------------------------------------------
  const formatSessionDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // -------------------------------------------------------------------
  // Render session item for history drawer
  // -------------------------------------------------------------------
  const renderSessionItem = useCallback(
    ({ item }: { item: ChatSession }) => {
      const isActive = item.id === activeSessionId;

      return (
        <Pressable
          onPress={() => handleSwitchSession(item.id)}
          onLongPress={() => handleDeleteSession(item.id)}
          className={`mx-2 mb-1 rounded-xl px-4 py-3 ${
            isActive ? "bg-indigo-50 dark:bg-indigo-950" : "active:bg-stone-100 dark:active:bg-stone-800"
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View className="mr-3 flex-1">
              <Text
                className={`text-sm font-medium ${
                  isActive ? "text-indigo-700 dark:text-indigo-300" : "text-stone-900 dark:text-stone-100"
                }`}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                {formatSessionDate(item.updated_at)}
              </Text>
            </View>
            <Pressable
              onPress={() => handleDeleteSession(item.id)}
              hitSlop={8}
              className="rounded-lg p-1 active:bg-stone-200 dark:active:bg-stone-700"
            >
              <Ionicons name="trash-outline" size={16} color={Colors.gray[400]} />
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [activeSessionId, handleSwitchSession, handleDeleteSession],
  );

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header — two rows for breathing room on mobile */}
        <View className="border-b border-stone-200 bg-white px-4 pb-2 pt-2 dark:border-stone-800 dark:bg-stone-900">
          {/* Row 1: Menu + Title + New Chat */}
          <View className="flex-row items-center">
            <Pressable
              onPress={openDrawer}
              className="mr-2 rounded-lg p-1.5 active:bg-stone-100 dark:active:bg-stone-800"
              hitSlop={4}
            >
              <Ionicons name="menu-outline" size={22} color={Colors.gray[700]} />
            </Pressable>

            {editingTitle ? (
              <TextInput
                className="flex-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 text-base font-bold text-stone-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-stone-100"
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={finishEditingTitle}
                onSubmitEditing={finishEditingTitle}
                autoFocus
                returnKeyType="done"
                selectTextOnFocus
              />
            ) : (
              <Pressable onPress={startEditingTitle} className="flex-1">
                <Text
                  className="text-lg font-bold text-stone-900 dark:text-stone-100"
                  numberOfLines={1}
                >
                  {activeSession?.title ?? "Ask your Network"}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleNewChat}
              className="ml-2 rounded-lg border border-stone-200 p-1.5 active:bg-stone-50 dark:border-stone-800 dark:active:bg-stone-800"
              hitSlop={4}
            >
              <Ionicons name="create-outline" size={18} color={Colors.gray[600]} />
            </Pressable>
          </View>

          {/* Row 2: Mode toggle + Filter — below title with some spacing */}
          <View className="mt-2 flex-row items-center gap-2">
            <Pressable
              onPress={() =>
                setAgentMode((m) => (m === "hitl" ? "auto" : "hitl"))
              }
              className={`flex-row items-center rounded-lg border px-2.5 py-1 ${
                agentMode === "hitl"
                  ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
                  : "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950"
              }`}
            >
              <Ionicons
                name={agentMode === "hitl" ? "shield-checkmark" : "flash"}
                size={14}
                color={agentMode === "hitl" ? "#d97706" : "#16a34a"}
              />
              <Text
                className={`ml-1 text-xs font-semibold ${
                  agentMode === "hitl" ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300"
                }`}
              >
                {agentMode === "hitl" ? "Review" : "Auto"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowFilters(true)}
              className="flex-row items-center rounded-lg border border-stone-200 px-2.5 py-1 active:bg-stone-50 dark:border-stone-800 dark:active:bg-stone-800"
            >
              <Ionicons
                name="filter-outline"
                size={14}
                color={
                  activeFilterCount > 0
                    ? Colors.brand[600]
                    : Colors.gray[500]
                }
              />
              {activeFilterCount > 0 && (
                <View className="ml-1 h-4 w-4 items-center justify-center rounded-full bg-indigo-600">
                  <Text className="text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Chat area */}
        {!hasMessages ? (
          <View className="flex-1 items-center justify-center px-6">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={32}
                color={Colors.brand[600]}
              />
            </View>
            <Text className="mb-2 text-center text-xl font-bold text-stone-900 dark:text-stone-100">
              Ask about your network
            </Text>
            <Text className="mb-8 text-center text-base text-stone-500 dark:text-stone-400">
              Ask questions or give commands in plain English.{"\n"}
              The agent can read and modify your contacts.
            </Text>
            <SuggestedQuestions onSelect={handleSuggestionSelect} />
          </View>
        ) : (
          <View className="flex-1">
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={keyExtractor}
              contentContainerStyle={{
                paddingTop: 16,
                paddingBottom: 16,
              }}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
              showsVerticalScrollIndicator={false}
            />
            <SuggestedQuestions onSelect={handleSuggestionSelect} />
          </View>
        )}

        {/* Input area */}
        <View className="border-t border-stone-200 bg-white px-4 pb-2 pt-3 dark:border-stone-800 dark:bg-stone-900">
          <View className="flex-row items-end">
            <View className="mr-2 flex-1 flex-row items-end rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 dark:border-stone-800 dark:bg-stone-800">
              <TextInput
                ref={inputRef}
                className="max-h-24 flex-1 text-base text-stone-900 dark:text-stone-100"
                placeholder="Ask a question or give a command..."
                placeholderTextColor={Colors.gray[400]}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSend()}
                multiline
                returnKeyType="send"
                blurOnSubmit
                editable={!isProcessing}
              />
            </View>
            <Pressable
              onPress={() => handleSend()}
              disabled={!inputText.trim() || isProcessing}
              className={`h-11 w-11 items-center justify-center rounded-full ${
                inputText.trim() && !isProcessing
                  ? "bg-indigo-600 active:bg-indigo-700 dark:bg-indigo-500 dark:active:bg-indigo-600"
                  : "bg-stone-200 dark:bg-stone-700"
              }`}
            >
              <Ionicons
                name="send"
                size={18}
                color={
                  inputText.trim() && !isProcessing
                    ? Colors.white
                    : Colors.gray[400]
                }
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <AdvancedFilters
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Chat history drawer overlay */}
      {showHistory && (
        <Modal
          visible
          transparent
          animationType="none"
          onRequestClose={closeDrawer}
          statusBarTranslucent
        >
          <View className="flex-1 flex-row">
            {/* Animated drawer panel */}
            <Animated.View
              style={{
                width: DRAWER_WIDTH,
                transform: [{ translateX: drawerAnim }],
              }}
              className="h-full bg-white shadow-lg dark:bg-stone-900"
            >
              <SafeAreaView className="flex-1" edges={["top"]}>
                {/* Drawer header */}
                <View className="flex-row items-center justify-between border-b border-stone-100 px-4 pb-3 pt-4 dark:border-stone-800">
                  <Text className="text-lg font-bold text-stone-900 dark:text-stone-100">
                    Chat History
                  </Text>
                  <Pressable
                    onPress={closeDrawer}
                    className="rounded-lg p-1 active:bg-stone-100 dark:active:bg-stone-800"
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={22} color={Colors.gray[500]} />
                  </Pressable>
                </View>

                {/* New chat button */}
                <Pressable
                  onPress={handleNewChat}
                  className="mx-4 mt-3 mb-2 flex-row items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 active:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:active:bg-indigo-900"
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.brand[600]} />
                  <Text className="ml-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    New Chat
                  </Text>
                </Pressable>

                {/* Sessions list */}
                {sessionsLoading ? (
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-sm text-stone-400 dark:text-stone-500">Loading...</Text>
                  </View>
                ) : sessions.length === 0 ? (
                  <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-center text-sm text-stone-400 dark:text-stone-500">
                      No chat history yet.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={sessions}
                    renderItem={renderSessionItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                  />
                )}

                {/* Hint text */}
                <View className="border-t border-stone-100 px-4 py-3 dark:border-stone-800">
                  <Text className="text-center text-xs text-stone-400 dark:text-stone-500">
                    Long-press a chat to delete
                  </Text>
                </View>
              </SafeAreaView>
            </Animated.View>

            {/* Backdrop */}
            <Pressable
              onPress={closeDrawer}
              className="flex-1 bg-black/40"
            />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helper: human-readable label for tool calls in the chat
// ---------------------------------------------------------------------------

function getToolLabel(
  name: string,
  args: Record<string, unknown>,
): string {
  switch (name) {
    case "search_contacts":
      return `Searching contacts for "${args.query}"...`;
    case "get_contact_details":
      return "Getting contact details...";
    case "get_interactions":
      return "Looking up interactions...";
    case "get_network_stats":
      return "Calculating network stats...";
    case "get_relationships":
      return "Looking up relationships...";
    case "list_tags":
      return "Listing tags...";
    case "list_entities":
      return "Listing entities...";
    case "run_sql_query":
      return "Running database query...";
    case "create_contact":
      return `Creating contact "${args.first_name}"...`;
    case "update_contact":
      return `Updating contact...`;
    case "bulk_tag_contacts":
      return `Tagging contacts as "${args.tag}"...`;
    case "archive_contacts":
      return "Archiving contacts...";
    case "link_contacts":
      return "Linking contacts...";
    case "create_entity":
      return `Creating entity "${args.name}"...`;
    case "add_entity_person":
      return `Adding person to entity...`;
    case "log_interaction":
      return `Logging interaction...`;
    case "enrich_contact":
      return `Researching ${args.identifier ?? "contact"}...`;
    case "create_contact_from_enrichment":
      return `Creating contact "${args.first_name}"...`;
    case "queue_enrichment": {
      const items = args.items as unknown[];
      return `Queuing ${items?.length ?? 0} enrichment job(s)...`;
    }
    default:
      return `Running ${name}...`;
  }
}
