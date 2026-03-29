import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { formatDate } from "@/lib/utils";
import type { InteractionResult as InteractionResultType } from "@/lib/agent";

export function InteractionCard({
  interaction,
}: {
  interaction: InteractionResultType;
}) {
  const typeIcons: Record<string, string> = {
    call: "call-outline",
    email: "mail-outline",
    meeting: "people-outline",
    text: "chatbubble-outline",
    social: "share-social-outline",
    note: "document-text-outline",
    gift: "gift-outline",
    other: "ellipsis-horizontal",
  };

  const iconName = typeIcons[interaction.type] ?? "ellipsis-horizontal";
  const directionLabel =
    interaction.direction === "inbound"
      ? "Incoming"
      : interaction.direction === "outbound"
        ? "Outgoing"
        : "";

  return (
    <View className="mt-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-3">
      <View className="flex-row items-center">
        <Ionicons
          name={iconName as keyof typeof Ionicons.glyphMap}
          size={18}
          color={Colors.brand[600]}
        />
        <Text className="ml-2 text-sm font-semibold capitalize text-stone-900 dark:text-stone-100">
          {interaction.type}
        </Text>
        {directionLabel ? (
          <Text className="ml-2 text-xs text-stone-400 dark:text-stone-500">
            ({directionLabel})
          </Text>
        ) : null}
        <Text className="ml-auto text-xs text-stone-400 dark:text-stone-500">
          {formatDate(interaction.occurred_at)}
        </Text>
      </View>
      {interaction.title ? (
        <Text className="mt-1.5 text-sm font-medium text-stone-800 dark:text-stone-200">
          {interaction.title}
        </Text>
      ) : null}
      {interaction.body ? (
        <Text className="mt-1 text-sm text-stone-600 dark:text-stone-400" numberOfLines={3}>
          {interaction.body}
        </Text>
      ) : null}
    </View>
  );
}
