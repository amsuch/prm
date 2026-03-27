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
import { parseQuery, getQueryDescription } from "@/lib/queryParser";
import { executeQuery, type AgentResponse } from "@/lib/agent";
import { ChatBubble } from "@/components/ChatBubble";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import {
  useSearch,
  DEFAULT_FILTERS,
  type SearchFilters,
} from "@/hooks/useSearch";

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

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const { filters, search, clearFilters, activeFilterCount } = useSearch();

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text ?? inputText).trim();
      if (!messageText || !userId || isProcessing) return;

      setInputText("");
      setIsProcessing(true);

      // Add user message
      const userMsgId = nextId();
      const agentMsgId = nextId();

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        text: messageText,
      };

      // Parse the query
      const parsed = parseQuery(messageText);
      const loadingText = getQueryDescription(parsed);

      // Add loading agent message
      const loadingMsg: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        text: loadingText,
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);

      try {
        const response = await executeQuery(parsed, userId);

        // Replace loading message with real response
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
                    type: "error",
                    message: "Something went wrong. Please try again.",
                  },
                }
              : msg,
          ),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [inputText, userId, isProcessing],
  );

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
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header area with filter button */}
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <Text className="text-lg font-bold text-gray-900">
            Ask your Network
          </Text>
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
            <Text
              className={`ml-1 text-sm font-medium ${
                activeFilterCount > 0
                  ? "text-brand-600"
                  : "text-gray-500"
              }`}
            >
              Filters
            </Text>
            {activeFilterCount > 0 && (
              <View className="ml-1.5 h-5 w-5 items-center justify-center rounded-full bg-brand-600">
                <Text className="text-xs font-bold text-white">
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Chat area */}
        {!hasMessages ? (
          <View className="flex-1 items-center justify-center px-6">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-brand-100">
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
              Ask questions in plain English about your contacts,
              interactions, and relationships.
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
            {/* Suggested questions at the bottom when there are messages */}
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
                placeholder="Ask a question..."
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
                  ? "bg-brand-600 active:bg-brand-700"
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

      {/* Advanced Filters Modal */}
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
