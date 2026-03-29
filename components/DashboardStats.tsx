import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import type { DashboardStats as StatsType } from "@/hooks/useDashboard";

type DashboardStatsProps = {
  stats: StatsType;
  isLoading: boolean;
};

type StatCardProps = {
  value: number;
  label: string;
  colorClass: string;
  textColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgTintClass: string;
};

function StatCard({
  value,
  label,
  colorClass,
  textColor,
  icon,
  iconColor,
  bgTintClass,
}: StatCardProps) {
  return (
    <View
      className="flex-1 rounded-xl bg-white dark:bg-stone-900 dark:border dark:border-stone-800 p-4 shadow-sm"
      style={Shadows.md}
    >
      <View className="flex-row items-center justify-between">
        <Text className={`text-2xl font-bold ${colorClass}`}>
          {value}
        </Text>
        <View className={`h-8 w-8 items-center justify-center rounded-lg ${bgTintClass}`}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      </View>
      <Text className={`mt-1 text-xs font-medium ${textColor}`}>{label}</Text>
    </View>
  );
}

export function DashboardStats({ stats, isLoading }: DashboardStatsProps) {
  if (isLoading) {
    return (
      <View className="flex-row gap-3">
        <View className="flex-1 rounded-xl bg-white dark:bg-stone-900 dark:border dark:border-stone-800 p-4 shadow-sm">
          <View className="h-8 w-16 rounded bg-stone-100 dark:bg-stone-800" />
          <View className="mt-2 h-3 w-20 rounded bg-stone-100 dark:bg-stone-800" />
        </View>
        <View className="flex-1 rounded-xl bg-white dark:bg-stone-900 dark:border dark:border-stone-800 p-4 shadow-sm">
          <View className="h-8 w-16 rounded bg-stone-100 dark:bg-stone-800" />
          <View className="mt-2 h-3 w-20 rounded bg-stone-100 dark:bg-stone-800" />
        </View>
        <View className="flex-1 rounded-xl bg-white dark:bg-stone-900 dark:border dark:border-stone-800 p-4 shadow-sm">
          <View className="h-8 w-16 rounded bg-stone-100 dark:bg-stone-800" />
          <View className="mt-2 h-3 w-20 rounded bg-stone-100 dark:bg-stone-800" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row gap-3">
      <StatCard
        value={stats.totalContacts}
        label="Total Contacts"
        colorClass="text-indigo-600"
        textColor="text-stone-500 dark:text-stone-400"
        icon="people"
        iconColor="#2563eb"
        bgTintClass="bg-indigo-50 dark:bg-indigo-950"
      />
      <StatCard
        value={stats.contactedThisWeek}
        label="This Week"
        colorClass="text-green-600"
        textColor="text-stone-500 dark:text-stone-400"
        icon="chatbubble"
        iconColor="#16a34a"
        bgTintClass="bg-green-50 dark:bg-green-950"
      />
      <StatCard
        value={stats.staleContacts}
        label="Stale"
        colorClass="text-amber-600"
        textColor="text-stone-500 dark:text-stone-400"
        icon="alert-circle"
        iconColor="#d97706"
        bgTintClass="bg-amber-50 dark:bg-amber-950"
      />
    </View>
  );
}
