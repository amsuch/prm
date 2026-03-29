import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime, formatDate, truncate } from "@/lib/utils";
import { Colors } from "@/constants/colors";
import { getInteractionTypeConfig } from "@/lib/interactions";
import type { DateGroup } from "@/hooks/useInteractions";
import type { Tables } from "@/types/database";

type InteractionTimelineProps = {
  groupedInteractions: DateGroup[];
  isLoading: boolean;
  error: string | null;
  onLogPress: () => void;
  onRefresh: () => void;
};

function InteractionItem({ interaction }: { interaction: Tables<"interactions"> }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getInteractionTypeConfig(interaction.type);
  const hasBody = !!interaction.body;

  return (
    <Pressable
      onPress={() => hasBody && setIsExpanded(!isExpanded)}
      className="flex-row rounded-xl bg-white dark:bg-stone-900 px-3 py-2.5 active:bg-stone-50 dark:active:bg-stone-800"
    >
      {/* Type Icon */}
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: config.color + "18" }}
      >
        <Ionicons
          name={config.icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={config.color}
        />
      </View>

      {/* Content */}
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center">
            <Text className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {interaction.title || config.label}
            </Text>
            {interaction.direction && (
              <View className="ml-1.5 rounded-md bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5">
                <Text className="text-xs text-stone-500 dark:text-stone-400">
                  {interaction.direction === "inbound" ? "In" : "Out"}
                </Text>
              </View>
            )}
          </View>
          <Text className="ml-2 text-xs text-stone-400 dark:text-stone-500">
            {formatRelativeTime(interaction.occurred_at)}
          </Text>
        </View>

        {/* Body preview or expanded */}
        {hasBody && !isExpanded && (
          <Text className="mt-0.5 text-xs text-stone-500 dark:text-stone-400" numberOfLines={1}>
            {truncate(interaction.body!, 80)}
          </Text>
        )}
        {hasBody && isExpanded && (
          <Text className="mt-1 text-sm leading-5 text-stone-600 dark:text-stone-400">
            {interaction.body}
          </Text>
        )}

        {/* Interaction type label when title is custom */}
        {interaction.title && (
          <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            {config.label} {"\u00B7"} {formatDate(interaction.occurred_at)}
          </Text>
        )}
      </View>

      {/* Expand indicator */}
      {hasBody && (
        <View className="ml-1 justify-center">
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={Colors.gray[300]}
          />
        </View>
      )}
    </Pressable>
  );
}

export function InteractionTimeline({
  groupedInteractions,
  isLoading,
  error,
  onLogPress,
  onRefresh,
}: InteractionTimelineProps) {
  const hasInteractions = groupedInteractions.length > 0;

  return (
    <View className="mx-4 mt-4">
      {/* Section Header */}
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={18} color={Colors.gray[600]} />
          <Text className="ml-2 text-base font-semibold text-stone-900 dark:text-stone-100">Activity</Text>
        </View>
        <Pressable
          onPress={onLogPress}
          className="flex-row items-center rounded-lg bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 active:bg-indigo-100 dark:active:bg-indigo-900"
        >
          <Ionicons name="add" size={16} color={Colors.brand[600]} />
          <Text className="ml-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Log</Text>
        </Pressable>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View className="items-center rounded-xl bg-white dark:bg-stone-900 py-6 shadow-sm">
          <ActivityIndicator size="small" color={Colors.brand[600]} />
        </View>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <View className="items-center rounded-xl bg-white dark:bg-stone-900 py-6 shadow-sm">
          <Text className="text-sm text-red-500 dark:text-red-400">{error}</Text>
          <Pressable
            onPress={onRefresh}
            className="mt-2 rounded-lg bg-stone-100 dark:bg-stone-800 px-3 py-1"
          >
            <Text className="text-xs font-medium text-stone-600 dark:text-stone-400">Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && !error && !hasInteractions && (
        <Pressable
          onPress={onLogPress}
          className="items-center rounded-xl bg-white dark:bg-stone-900 py-6 shadow-sm active:bg-stone-50 dark:active:bg-stone-800"
        >
          <Ionicons name="time-outline" size={28} color={Colors.gray[300]} />
          <Text className="mt-2 text-sm text-stone-400 dark:text-stone-500">No interactions yet</Text>
          <Text className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">Tap to log your first one</Text>
        </Pressable>
      )}

      {/* Timeline with date groups */}
      {!isLoading && !error && hasInteractions && (
        <View className="gap-3">
          {groupedInteractions.map((group) => (
            <View key={group.title}>
              {/* Date Group Header */}
              <View className="mb-1.5 flex-row items-center">
                <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
                <Text className="mx-3 text-xs font-semibold text-stone-400 dark:text-stone-500">
                  {group.title}
                </Text>
                <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
              </View>

              {/* Interactions in this group */}
              <View className="gap-1 rounded-xl bg-white dark:bg-stone-900 p-1 shadow-sm">
                {group.data.map((interaction) => (
                  <InteractionItem
                    key={interaction.id}
                    interaction={interaction}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
