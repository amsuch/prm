import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
};

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}-${Date.now()}`;
}

export default function AskScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>("hitl");

  // Conversation history for the LLM agent (persisted across turns)
  const conversationHistory = useRef<ToolMessage[]>([]);
  // Pending approval state for resuming after HITL
  const pendingApprovalRef = useRef<{
    toolCall: ToolCall;
    messages: ToolMessage[];
  } | null>(null);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const { filters, search, clearFilters, activeFilterCount } = useSearch();

  // -------------------------------------------------------------------
  // Tool-calling agent flow (when LLM is configured)
  // -------------------------------------------------------------------
  const handleAgentSend = useCallback(
    async (messageText: string, agentMsgId: string) => {
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
              messages: [...conversationHistory.current],
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
            break;

          case "text":
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === agentMsgId
                  ? { ...msg, text: event.text, isLoading: false }
                  : msg,
              ),
            );
            break;

          case "done":
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
            break;
        }
      }
    },
    [session, userId, agentMode],
  );

  // -------------------------------------------------------------------
  // Fallback flow (no LLM configured — regex parser + Supabase)
  // -------------------------------------------------------------------
  const handleFallbackSend = useCallback(
    async (messageText: string, agentMsgId: string) => {
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
      }
    },
    [userId, session, agentMode],
  );

  // -------------------------------------------------------------------
  // Send handler — routes to agent or fallback
  // -------------------------------------------------------------------
  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text ?? inputText).trim();
      if (!messageText || !userId || isProcessing) return;

      setInputText("");
      setIsProcessing(true);

      const userMsgId = nextId();
      const agentMsgId = nextId();

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        text: messageText,
      };

      const llmConfig = getLLMConfigFromSession(session);

      const loadingMsg: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        text: llmConfig ? "Thinking..." : getQueryDescription(parseQuery(messageText)),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);

      try {
        if (llmConfig) {
          await handleAgentSend(messageText, agentMsgId);
        } else {
          await handleFallbackSend(messageText, agentMsgId);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [inputText, userId, isProcessing, session, handleAgentSend, handleFallbackSend],
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
                conversationHistory.current.push({
                  role: "assistant",
                  content: event.finalText,
                });
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
        }
      }

      setIsProcessing(false);
    },
    [userId, session],
  );

  const handleReject = useCallback(() => {
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
  }, []);

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

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header with mode toggle and filter */}
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <Text className="text-lg font-bold text-gray-900">
            Ask your Network
          </Text>
          <View className="flex-row items-center gap-2">
            {/* HITL / Auto toggle */}
            <Pressable
              onPress={() =>
                setAgentMode((m) => (m === "hitl" ? "auto" : "hitl"))
              }
              className={`flex-row items-center rounded-lg border px-2.5 py-1.5 ${
                agentMode === "hitl"
                  ? "border-amber-300 bg-amber-50"
                  : "border-green-300 bg-green-50"
              }`}
            >
              <Ionicons
                name={agentMode === "hitl" ? "shield-checkmark" : "flash"}
                size={14}
                color={agentMode === "hitl" ? "#d97706" : "#16a34a"}
              />
              <Text
                className={`ml-1 text-xs font-semibold ${
                  agentMode === "hitl" ? "text-amber-700" : "text-green-700"
                }`}
              >
                {agentMode === "hitl" ? "HITL" : "Auto"}
              </Text>
            </Pressable>

            {/* Filter button */}
            <Pressable
              onPress={() => setShowFilters(true)}
              className="flex-row items-center rounded-lg border border-gray-200 px-3 py-1.5 active:bg-gray-50"
            >
              <Ionicons
                name="filter-outline"
                size={16}
                color={
                  activeFilterCount > 0
                    ? Colors.brand[600]
                    : Colors.gray[500]
                }
              />
              {activeFilterCount > 0 && (
                <View className="ml-1 h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                  <Text className="text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Mode description bar */}
        <View
          className={`flex-row items-center px-4 py-1.5 ${
            agentMode === "hitl" ? "bg-amber-50" : "bg-green-50"
          }`}
        >
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={agentMode === "hitl" ? "#92400e" : "#166534"}
          />
          <Text
            className={`ml-1 text-[11px] ${
              agentMode === "hitl" ? "text-amber-800" : "text-green-800"
            }`}
          >
            {agentMode === "hitl"
              ? "Actions require your approval before executing"
              : "Actions execute immediately without confirmation"}
          </Text>
        </View>

        {/* Chat area */}
        {!hasMessages ? (
          <View className="flex-1 items-center justify-center px-6">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={32}
                color={Colors.brand[600]}
              />
            </View>
            <Text className="mb-2 text-center text-xl font-bold text-gray-900">
              Ask about your network
            </Text>
            <Text className="mb-8 text-center text-base text-gray-500">
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
        <View className="border-t border-gray-200 bg-white px-4 pb-2 pt-3">
          <View className="flex-row items-end">
            <View className="mr-2 flex-1 flex-row items-end rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2">
              <TextInput
                ref={inputRef}
                className="max-h-24 flex-1 text-base text-gray-900"
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
                  ? "bg-blue-600 active:bg-blue-700"
                  : "bg-gray-200"
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
    default:
      return `Running ${name}...`;
  }
}
