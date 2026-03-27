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

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  response?: AgentResponse;
  isLoading?: boolean;
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

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const { filters, search, clearFilters, activeFilterCount } = useSearch();

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

      const parsed = parseQuery(messageText);
      const loadingText = getQueryDescription(parsed);

      const loadingMsg: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        text: loadingText,
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);

      try {
        let response: AgentResponse;

        // In HITL mode, action intents get previewed first
        if (agentMode === "hitl" && isActionIntent(parsed)) {
          response = await previewAction(parsed, userId);
        } else {
          response = await executeQuery(parsed, userId);
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMsgId
              ? { ...msg, text: response.message, response, isLoading: false }
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
                  response: { type: "error" as const, message: "Something went wrong." },
                }
              : msg,
          ),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [inputText, userId, isProcessing, agentMode],
  );

  const handleApprove = useCallback(
    async (pendingAction: PendingAction) => {
      setIsProcessing(true);
      const agentMsgId = nextId();

      const loadingMsg: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        text: "Executing...",
        isLoading: true,
      };

      setMessages((prev) => [...prev, loadingMsg]);

      try {
        const response = await confirmAction(pendingAction);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMsgId
              ? { ...msg, text: response.message, response, isLoading: false }
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
                  response: { type: "error" as const, message: "Action failed." },
                }
              : msg,
          ),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const handleReject = useCallback(() => {
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
        <View className={`flex-row items-center px-4 py-1.5 ${
          agentMode === "hitl" ? "bg-amber-50" : "bg-green-50"
        }`}>
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={agentMode === "hitl" ? "#92400e" : "#166534"}
          />
          <Text className={`ml-1 text-[11px] ${
            agentMode === "hitl" ? "text-amber-800" : "text-green-800"
          }`}>
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
                paddingBottom: 8,
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
