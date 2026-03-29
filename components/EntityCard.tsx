import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { getAvatarColor } from "@/components/Avatar";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import type { EntityWithCount } from "@/hooks/useEntities";

type EntityCardProps = {
  entity: EntityWithCount;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  restaurant: { bg: "#fef3c7", text: "#92400e" },
  company: { bg: "#dbeafe", text: "#1e40af" },
  gym: { bg: "#dcfce7", text: "#166534" },
  club: { bg: "#f3e8ff", text: "#6b21a8" },
  school: { bg: "#fce7f3", text: "#9d174d" },
  church: { bg: "#e0e7ff", text: "#3730a3" },
  store: { bg: "#ffedd5", text: "#9a3412" },
  default: { bg: Colors.gray[100], text: Colors.gray[700] },
};

function getCategoryColor(category: string | null): { bg: string; text: string } {
  if (!category) return CATEGORY_COLORS.default;
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.default;
}

export function EntityCard({ entity }: EntityCardProps) {
  const router = useRouter();
  const categoryColor = getCategoryColor(entity.category);
  const avatarBg = getAvatarColor(entity.name);

  return (
    <AnimatedPressable
      scaleDown={0.98}
      onPress={() => router.push(`/entity/${entity.id}` as never)}
      className="mx-4 mb-2 flex-row items-center rounded-xl bg-white dark:bg-stone-900 dark:border dark:border-stone-800 p-3 shadow-sm active:bg-stone-50 dark:active:bg-stone-800"
    >
      {/* Avatar */}
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarBg }}
      >
        <Ionicons name="business" size={22} color="white" />
      </View>

      {/* Info */}
      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold text-stone-900 dark:text-stone-100" numberOfLines={1}>
          {entity.name}
        </Text>
        {entity.category && (
          <View className="mt-1 flex-row items-center">
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: categoryColor.bg }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: categoryColor.text }}
              >
                {entity.category}
              </Text>
            </View>
            <Text className="ml-2 text-xs text-stone-400 dark:text-stone-500">
              {entity.people_count} {entity.people_count === 1 ? "person" : "people"}
            </Text>
          </View>
        )}
        {!entity.category && entity.people_count > 0 && (
          <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            {entity.people_count} {entity.people_count === 1 ? "person" : "people"}
          </Text>
        )}
        {entity.address && (
          <Text className="mt-0.5 text-sm text-stone-500 dark:text-stone-400" numberOfLines={1}>
            {entity.address}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colors.gray[300]}
      />
    </AnimatedPressable>
  );
}
