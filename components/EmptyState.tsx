import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
};

export function EmptyState({
  icon = "folder-open-outline",
  title,
  subtitle,
  ctaLabel,
  onCtaPress,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <Ionicons name={icon} size={40} color="#9ca3af" />
      </View>

      <Text className="text-center text-lg font-semibold text-gray-900">
        {title}
      </Text>

      {subtitle && (
        <Text className="mt-2 text-center text-sm leading-5 text-gray-500">
          {subtitle}
        </Text>
      )}

      {ctaLabel && onCtaPress && (
        <Pressable
          className="mt-6 rounded-lg bg-blue-600 px-6 py-3 active:bg-blue-700"
          onPress={onCtaPress}
        >
          <Text className="text-sm font-semibold text-white">{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
