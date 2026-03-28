import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { getInitials } from "@/lib/utils";
import { removeRelationship } from "@/lib/relationships";
import type {
  RelationshipItem,
  GroupedRelationships,
} from "@/hooks/useRelationships";

type RelationshipsListProps = {
  groupedRelationships: GroupedRelationships;
  isLoading: boolean;
  error: string | null;
  onAddPress: () => void;
  onRefresh: () => void;
};

const AVATAR_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#4f46e5",
  "#c026d3",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const CATEGORY_ICONS: Record<string, string> = {
  Family: "heart-outline",
  Professional: "briefcase-outline",
  Social: "people-outline",
  Other: "link-outline",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Family: { bg: "bg-rose-50", text: "text-rose-700", icon: "#e11d48" },
  Professional: { bg: "bg-indigo-50", text: "text-indigo-700", icon: "#2563eb" },
  Social: { bg: "bg-green-50", text: "text-green-700", icon: "#16a34a" },
  Other: { bg: "bg-stone-50", text: "text-stone-700", icon: "#6b7280" },
};

const CATEGORY_ORDER = ["Family", "Professional", "Social", "Other"];

function RelationshipCard({
  item,
  onRemove,
}: {
  item: RelationshipItem;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const fullName = [item.related_first_name, item.related_last_name]
    .filter(Boolean)
    .join(" ");
  const initials = getInitials(item.related_first_name, item.related_last_name);
  const avatarBg = getAvatarColor(fullName);

  const handleLongPress = () => {
    Alert.alert(
      "Remove Relationship",
      `Remove "${item.relationship_name}" relationship with ${fullName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onRemove(item.relationship_id),
        },
      ],
    );
  };

  return (
    <Pressable
      onPress={() => router.push(`/contact/${item.related_contact_id}`)}
      onLongPress={handleLongPress}
      className="flex-row items-center rounded-xl bg-white px-3 py-2.5 active:bg-stone-50"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarBg }}
      >
        <Text className="text-sm font-bold text-white">{initials}</Text>
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-stone-900" numberOfLines={1}>
          {fullName}
        </Text>
        <Text className="mt-0.5 text-xs text-stone-500" numberOfLines={1}>
          {item.relationship_name}
          {item.related_company ? ` \u00B7 ${item.related_company}` : ""}
        </Text>
        {item.notes ? (
          <Text className="mt-0.5 text-xs text-stone-400" numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.gray[300]} />
    </Pressable>
  );
}

export function RelationshipsList({
  groupedRelationships,
  isLoading,
  error,
  onAddPress,
  onRefresh,
}: RelationshipsListProps) {
  const handleRemove = async (relationshipId: string) => {
    try {
      await removeRelationship(relationshipId);
      onRefresh();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to remove relationship",
      );
    }
  };

  const hasRelationships = Object.keys(groupedRelationships).length > 0;

  return (
    <View className="mx-4 mt-4">
      {/* Section Header */}
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="git-network-outline" size={18} color={Colors.gray[600]} />
          <Text className="ml-2 text-base font-semibold text-stone-900">
            Relationships
          </Text>
        </View>
        <Pressable
          onPress={onAddPress}
          className="flex-row items-center rounded-lg bg-indigo-50 px-2.5 py-1 active:bg-indigo-100"
        >
          <Ionicons name="add" size={16} color={Colors.brand[600]} />
          <Text className="ml-0.5 text-xs font-semibold text-indigo-700">Add</Text>
        </Pressable>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View className="items-center rounded-xl bg-white py-6 shadow-sm">
          <ActivityIndicator size="small" color={Colors.brand[600]} />
        </View>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <View className="items-center rounded-xl bg-white py-6 shadow-sm">
          <Text className="text-sm text-red-500">{error}</Text>
          <Pressable
            onPress={onRefresh}
            className="mt-2 rounded-lg bg-stone-100 px-3 py-1"
          >
            <Text className="text-xs font-medium text-stone-600">Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && !error && !hasRelationships && (
        <Pressable
          onPress={onAddPress}
          className="items-center rounded-xl bg-white py-6 shadow-sm active:bg-stone-50"
        >
          <Ionicons name="people-outline" size={28} color={Colors.gray[300]} />
          <Text className="mt-2 text-sm text-stone-400">No relationships yet</Text>
          <Text className="mt-1 text-xs text-indigo-600">Tap to add one</Text>
        </Pressable>
      )}

      {/* Grouped Relationships */}
      {!isLoading && !error && hasRelationships && (
        <View className="gap-3">
          {CATEGORY_ORDER.map((category) => {
            const items = groupedRelationships[category];
            if (!items || items.length === 0) return null;

            const catConfig = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
            const catIcon = CATEGORY_ICONS[category] ?? "link-outline";

            return (
              <View key={category}>
                <View className="mb-1.5 flex-row items-center">
                  <View className={`rounded-md p-1 ${catConfig.bg}`}>
                    <Ionicons
                      name={catIcon as keyof typeof Ionicons.glyphMap}
                      size={12}
                      color={catConfig.icon}
                    />
                  </View>
                  <Text
                    className={`ml-1.5 text-xs font-semibold uppercase tracking-wide ${catConfig.text}`}
                  >
                    {category}
                  </Text>
                  <View className="ml-1.5 rounded-full bg-stone-100 px-1.5">
                    <Text className="text-xs text-stone-500">{items.length}</Text>
                  </View>
                </View>
                <View className="gap-1 rounded-xl bg-white p-1 shadow-sm">
                  {items.map((item) => (
                    <RelationshipCard
                      key={item.relationship_id}
                      item={item}
                      onRemove={handleRemove}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
