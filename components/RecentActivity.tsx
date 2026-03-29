import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { formatRelativeTime } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import type { RecentInteraction } from "@/hooks/useDashboard";

type RecentActivityProps = {
  interactions: RecentInteraction[];
  isLoading: boolean;
};

const INTERACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  call: "call-outline",
  email: "mail-outline",
  meeting: "calendar-outline",
  text: "chatbubble-outline",
  social: "share-social-outline",
  note: "document-text-outline",
  gift: "gift-outline",
  other: "ellipsis-horizontal-circle-outline",
};

const INTERACTION_COLORS: Record<string, string> = {
  call: "#2563eb",
  email: "#7c3aed",
  meeting: "#059669",
  text: "#0891b2",
  social: "#e11d48",
  note: Colors.gray[500],
  gift: "#d97706",
  other: Colors.gray[500],
};

function InteractionRow({ interaction }: { interaction: RecentInteraction }) {
  const contactName = [
    interaction.contact_first_name,
    interaction.contact_last_name,
  ]
    .filter(Boolean)
    .join(" ");
  const icon = INTERACTION_ICONS[interaction.type] ?? INTERACTION_ICONS.other;
  const iconColor = INTERACTION_COLORS[interaction.type] ?? INTERACTION_COLORS.other;

  return (
    <Pressable
      onPress={() =>
        router.push(`/(app)/contact/${interaction.contact_id}` as const)
      }
      className="flex-row items-center px-4 py-3 active:bg-stone-50 dark:active:bg-stone-800"
    >
      {/* Avatar */}
      <Avatar
        firstName={interaction.contact_first_name}
        lastName={interaction.contact_last_name}
        size="md"
      />

      {/* Content */}
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text className="text-sm font-semibold text-stone-900 dark:text-stone-100" numberOfLines={1}>
            {contactName}
          </Text>
        </View>
        <View className="mt-0.5 flex-row items-center">
          <Ionicons name={icon} size={12} color={iconColor} />
          <Text className="ml-1 text-xs text-stone-500 dark:text-stone-400 dark:text-stone-500" numberOfLines={1}>
            {interaction.title || interaction.type}
          </Text>
        </View>
      </View>

      {/* Time */}
      <Text className="ml-2 text-xs text-stone-400 dark:text-stone-500">
        {formatRelativeTime(interaction.occurred_at)}
      </Text>
    </Pressable>
  );
}

export function RecentActivity({ interactions, isLoading }: RecentActivityProps) {
  if (isLoading) {
    return (
      <View className="rounded-xl bg-white dark:bg-stone-900 shadow-sm">
        {[1, 2, 3].map((i) => (
          <View key={i} className="flex-row items-center px-4 py-3">
            <View className="h-10 w-10 rounded-full bg-stone-100" />
            <View className="ml-3 flex-1">
              <View className="h-4 w-28 rounded bg-stone-100" />
              <View className="mt-1 h-3 w-40 rounded bg-stone-100" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (interactions.length === 0) {
    return (
      <View className="items-center rounded-xl bg-white py-12 shadow-sm">
        <Ionicons name="time-outline" size={40} color={Colors.gray[300]} />
        <Text className="mt-2 text-stone-400 dark:text-stone-500">No activity yet</Text>
        <Text className="mt-1 text-sm text-stone-400 dark:text-stone-500">
          Log interactions to see them here
        </Text>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-xl bg-white dark:bg-stone-900 shadow-sm">
      {interactions.map((interaction, index) => (
        <View key={interaction.id}>
          {index > 0 && <View className="ml-17 h-px bg-stone-100 dark:bg-stone-800" />}
          <InteractionRow interaction={interaction} />
        </View>
      ))}
    </View>
  );
}
