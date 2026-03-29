import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { Avatar } from "@/components/Avatar";
import type { ActionType, AgentResultContact } from "@/lib/agent";

export function ActionCard({
  actionType,
  count,
  contact,
}: {
  actionType: ActionType;
  count?: number;
  contact?: AgentResultContact;
}) {
  const router = useRouter();

  // Action type configuration
  const actionConfig: Record<
    ActionType,
    { icon: string; bgClass: string; borderClass: string; iconColor: string; label: string }
  > = {
    add: {
      icon: "checkmark-circle",
      bgClass: "bg-green-50 dark:bg-green-950",
      borderClass: "border-green-200 dark:border-green-800",
      iconColor: "#10b981",
      label: "Contact Created",
    },
    bulk_tag: {
      icon: "pricetag",
      bgClass: "bg-indigo-50 dark:bg-indigo-950",
      borderClass: "border-indigo-200 dark:border-indigo-800",
      iconColor: "#3b82f6",
      label: "Contacts Tagged",
    },
    bulk_update: {
      icon: "create",
      bgClass: "bg-indigo-50 dark:bg-indigo-950",
      borderClass: "border-indigo-200 dark:border-indigo-800",
      iconColor: "#3b82f6",
      label: "Contacts Updated",
    },
    archive: {
      icon: "archive",
      bgClass: "bg-amber-50 dark:bg-amber-950",
      borderClass: "border-amber-200 dark:border-amber-800",
      iconColor: "#f59e0b",
      label: "Contacts Archived",
    },
    enrich: {
      icon: "search",
      bgClass: "bg-purple-50 dark:bg-purple-950",
      borderClass: "border-purple-200 dark:border-purple-800",
      iconColor: "#8b5cf6",
      label: "Contact Enrichment",
    },
    update: {
      icon: "create",
      bgClass: "bg-indigo-50 dark:bg-indigo-950",
      borderClass: "border-indigo-200 dark:border-indigo-800",
      iconColor: "#3b82f6",
      label: "Contact Updated",
    },
    link: {
      icon: "link",
      bgClass: "bg-cyan-50 dark:bg-cyan-950",
      borderClass: "border-cyan-200 dark:border-cyan-800",
      iconColor: "#0891b2",
      label: "Contacts Linked",
    },
    create_entity: {
      icon: "business",
      bgClass: "bg-green-50 dark:bg-green-950",
      borderClass: "border-green-200 dark:border-green-800",
      iconColor: "#10b981",
      label: "Entity Created",
    },
    add_entity_person: {
      icon: "person-add",
      bgClass: "bg-indigo-50 dark:bg-indigo-950",
      borderClass: "border-indigo-200 dark:border-indigo-800",
      iconColor: "#3b82f6",
      label: "Person Added",
    },
    promote_person: {
      icon: "arrow-up-circle",
      bgClass: "bg-purple-50 dark:bg-purple-950",
      borderClass: "border-purple-200 dark:border-purple-800",
      iconColor: "#8b5cf6",
      label: "Person Promoted",
    },
  };

  const config = actionConfig[actionType];

  // For "add" and "enrich", show the contact card
  if ((actionType === "add" || actionType === "enrich") && contact) {
    const fullName = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");
    const subtitle = [contact.job_title, contact.company]
      .filter(Boolean)
      .join(" at ");

    return (
      <View className={`mt-3 rounded-xl border ${config.borderClass} ${config.bgClass} p-3`}>
        <View className="mb-2 flex-row items-center">
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={18}
            color={config.iconColor}
          />
          <Text className="ml-2 text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
            {config.label}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/contact/${contact.id}`)}
          className="flex-row items-center rounded-lg bg-white dark:bg-stone-800 p-2.5 active:bg-stone-50 dark:active:bg-stone-700"
        >
          <Avatar
            firstName={contact.first_name}
            lastName={contact.last_name}
            imageUrl={contact.avatar_url}
            size="md"
          />
          <View className="ml-2.5 flex-1">
            <Text
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
              numberOfLines={1}
            >
              {fullName}
            </Text>
            {subtitle ? (
              <Text className="text-xs text-stone-500 dark:text-stone-400" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={Colors.gray[300]}
          />
        </Pressable>
      </View>
    );
  }

  // For bulk actions (bulk_tag, bulk_update, archive), show a summary card
  return (
    <View className={`mt-3 rounded-xl border ${config.borderClass} ${config.bgClass} p-3`}>
      <View className="flex-row items-center">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: config.iconColor + "20" }}
        >
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={config.iconColor}
          />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
            {config.label}
          </Text>
          {count !== undefined && (
            <Text className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {count}
            </Text>
          )}
        </View>
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={config.iconColor}
        />
      </View>
    </View>
  );
}
