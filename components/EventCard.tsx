import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { getAvatarColor } from "@/components/Avatar";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import type { EventWithCount } from "@/hooks/useEvents";
import { formatDate } from "@/lib/utils";

type EventCardProps = {
  event: EventWithCount;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  conference: { bg: "#dbeafe", text: "#1e40af" },
  meetup: { bg: "#e0e7ff", text: "#3730a3" },
  party: { bg: "#fce7f3", text: "#9d174d" },
  workshop: { bg: "#fef3c7", text: "#92400e" },
  wedding: { bg: "#fee2e2", text: "#991b1b" },
  concert: { bg: "#ede9fe", text: "#5b21b6" },
  sports: { bg: "#dcfce7", text: "#166534" },
  dinner: { bg: "#ffedd5", text: "#9a3412" },
  travel: { bg: "#cffafe", text: "#155e75" },
  default: { bg: Colors.gray[100], text: Colors.gray[700] },
};

function getCategoryColor(category: string | null): { bg: string; text: string } {
  if (!category) return CATEGORY_COLORS.default;
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.default;
}

export function EventCard({ event }: EventCardProps) {
  const router = useRouter();
  const categoryColor = getCategoryColor(event.category);
  const avatarBg = getAvatarColor(event.name);

  const dateLabel = event.event_date
    ? formatDate(event.event_date)
    : null;

  return (
    <AnimatedPressable
      scaleDown={0.98}
      onPress={() => router.push(`/event/${event.id}` as never)}
      className="mx-4 mb-3 flex-row items-center rounded-xl bg-white dark:bg-stone-900 dark:border dark:border-stone-800 p-4 shadow-sm active:bg-stone-50 dark:active:bg-stone-800"
    >
      {/* Avatar */}
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarBg }}
      >
        <Ionicons name="calendar" size={22} color="white" />
      </View>

      {/* Info */}
      <View className="ml-3 flex-1">
        <Text
          className="text-base font-semibold text-stone-900 dark:text-stone-100"
          numberOfLines={1}
        >
          {event.name}
        </Text>
        {event.category && (
          <View className="mt-1 flex-row items-center">
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: categoryColor.bg }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: categoryColor.text }}
              >
                {event.category}
              </Text>
            </View>
            <Text className="ml-2 text-xs text-stone-400 dark:text-stone-500">
              {event.people_count}{" "}
              {event.people_count === 1 ? "person" : "people"}
            </Text>
          </View>
        )}
        {!event.category && event.people_count > 0 && (
          <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            {event.people_count}{" "}
            {event.people_count === 1 ? "person" : "people"}
          </Text>
        )}
        {(dateLabel || event.location) && (
          <Text
            className="mt-0.5 text-sm text-stone-500 dark:text-stone-400"
            numberOfLines={1}
          >
            {[dateLabel, event.location].filter(Boolean).join(" · ")}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={Colors.gray[300]} />
    </AnimatedPressable>
  );
}
