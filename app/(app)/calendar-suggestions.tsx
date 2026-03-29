import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { Colors } from "@/constants/colors";
import { formatDate } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import {
  dismissSuggestion,
  restoreSuggestion,
  createContactFromSuggestion,
  type Suggestion,
} from "@/lib/calendarSync";

export default function CalendarSuggestionsScreen() {
  const { session } = useSession();
  const { suggestions, isLoading, refetch } = useCalendarSync();
  const [showDismissed, setShowDismissed] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const userId = session?.user?.id;

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const dismissedSuggestions = suggestions.filter((s) => s.status === "dismissed");
  const createdSuggestions = suggestions.filter((s) => s.status === "created");

  const handleDismiss = useCallback(
    async (suggestion: Suggestion) => {
      setProcessingId(suggestion.id);
      try {
        await dismissSuggestion(suggestion.id, userId!);
        await refetch();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to dismiss suggestion";
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Error", message);
        }
      } finally {
        setProcessingId(null);
      }
    },
    [refetch],
  );

  const handleRestore = useCallback(
    async (suggestion: Suggestion) => {
      setProcessingId(suggestion.id);
      try {
        await restoreSuggestion(suggestion.id, userId!);
        await refetch();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to restore suggestion";
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Error", message);
        }
      } finally {
        setProcessingId(null);
      }
    },
    [refetch],
  );

  const handleCreateContact = useCallback(
    async (suggestion: Suggestion) => {
      if (!userId) return;
      setProcessingId(suggestion.id);
      try {
        const contactId = await createContactFromSuggestion(
          suggestion.id,
          userId,
        );
        await refetch();
        router.push(`/(app)/contact/${contactId}/edit` as never);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create contact";
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Error", message);
        }
      } finally {
        setProcessingId(null);
      }
    },
    [userId, refetch],
  );

  const renderSuggestionRow = (suggestion: Suggestion, isDismissed: boolean) => {
    const isProcessing = processingId === suggestion.id;

    return (
      <View
        key={suggestion.id}
        className="border-b border-stone-100 px-4 py-3"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            {suggestion.display_name && (
              <Text className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {suggestion.display_name}
              </Text>
            )}
            <Text
              className={`text-sm ${suggestion.display_name ? "text-stone-500 dark:text-stone-400" : "font-semibold text-stone-900 dark:text-stone-100"}`}
              numberOfLines={1}
            >
              {suggestion.email}
            </Text>
            {suggestion.event_title && (
              <View className="mt-1 flex-row items-center">
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={Colors.gray[400]}
                />
                <Text className="ml-1 text-xs text-stone-400" numberOfLines={1}>
                  {suggestion.event_title}
                  {suggestion.event_date
                    ? ` - ${formatDate(suggestion.event_date)}`
                    : ""}
                </Text>
              </View>
            )}
          </View>

          {isProcessing ? (
            <ActivityIndicator
              size="small"
              color={Colors.brand[600]}
              style={{ marginLeft: 8 }}
            />
          ) : isDismissed ? (
            <Pressable
              onPress={() => handleRestore(suggestion)}
              className="ml-2 rounded-lg border border-stone-200 px-3 py-1.5 active:bg-stone-50"
            >
              <Text className="text-xs font-medium text-stone-600 dark:text-stone-400">Restore</Text>
            </Pressable>
          ) : (
            <View className="ml-2 flex-row gap-2">
              <Pressable
                onPress={() => handleDismiss(suggestion)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 active:bg-stone-50"
              >
                <Text className="text-xs font-medium text-stone-500">
                  Dismiss
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleCreateContact(suggestion)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 active:bg-indigo-700"
              >
                <Text className="text-xs font-medium text-white">
                  Create Contact
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50">
        <ActivityIndicator size="large" color={Colors.brand[600]} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-stone-50">
      <View className="px-4 pt-5 pb-24">
        <Text className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          Calendar Suggestions
        </Text>
        <Text className="mt-1 text-stone-500 dark:text-stone-400">
          Unmatched attendees from your calendar events
        </Text>

        {/* Pending suggestions */}
        {pendingSuggestions.length > 0 ? (
          <>
            <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-stone-400">
              Pending ({pendingSuggestions.length})
            </Text>
            <View className="overflow-hidden rounded-xl bg-white shadow-sm">
              {pendingSuggestions.map((s) => renderSuggestionRow(s, false))}
            </View>
          </>
        ) : (
          <View className="mt-8 items-center rounded-xl bg-white px-4 py-8 shadow-sm">
            <Ionicons
              name="checkmark-circle-outline"
              size={40}
              color={Colors.success}
            />
            <Text className="mt-2 text-base font-semibold text-stone-900 dark:text-stone-100">
              All caught up!
            </Text>
            <Text className="mt-1 text-sm text-stone-500">
              No pending suggestions to review
            </Text>
          </View>
        )}

        {/* Created contacts */}
        {createdSuggestions.length > 0 && (
          <>
            <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-stone-400">
              Created ({createdSuggestions.length})
            </Text>
            <View className="overflow-hidden rounded-xl bg-white shadow-sm">
              {createdSuggestions.map((s) => (
                <View
                  key={s.id}
                  className="flex-row items-center border-b border-stone-100 px-4 py-3"
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={Colors.success}
                  />
                  <View className="ml-2 flex-1">
                    {s.display_name && (
                      <Text className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        {s.display_name}
                      </Text>
                    )}
                    <Text className="text-xs text-stone-500">{s.email}</Text>
                  </View>
                  {s.created_contact_id && (
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/(app)/contact/${s.created_contact_id}` as never,
                        )
                      }
                      className="rounded-lg border border-stone-200 px-3 py-1.5 active:bg-stone-50"
                    >
                      <Text className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        View
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Dismissed toggle and list */}
        {dismissedSuggestions.length > 0 && (
          <>
            <Pressable
              onPress={() => setShowDismissed(!showDismissed)}
              className="mb-2 mt-6 flex-row items-center"
            >
              <Text className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Dismissed ({dismissedSuggestions.length})
              </Text>
              <Ionicons
                name={showDismissed ? "chevron-up" : "chevron-down"}
                size={14}
                color={Colors.gray[400]}
                style={{ marginLeft: 4 }}
              />
            </Pressable>

            {showDismissed && (
              <View className="overflow-hidden rounded-xl bg-white shadow-sm">
                {dismissedSuggestions.map((s) => renderSuggestionRow(s, true))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
