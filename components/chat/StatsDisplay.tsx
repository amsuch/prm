import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import type { StatsResult } from "@/lib/agent";

export function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="items-center">
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={color}
      />
      <Text className="mt-1 text-lg font-bold text-stone-900">{value}</Text>
      <Text className="text-xs text-stone-500">{label}</Text>
    </View>
  );
}

export function StatsCard({ stats }: { stats: StatsResult }) {
  return (
    <View className="mt-3 rounded-xl border border-stone-100 bg-stone-50 p-3">
      {/* Stat Rows */}
      <View className="flex-row justify-between">
        <StatItem
          icon="people"
          label="Total Contacts"
          value={stats.totalContacts.toString()}
          color={Colors.brand[600]}
        />
        <StatItem
          icon="chatbubbles"
          label="This Week"
          value={stats.contactedThisWeek.toString()}
          color={Colors.success}
        />
        <StatItem
          icon="time"
          label="Need Follow-up"
          value={stats.staleContacts.toString()}
          color={Colors.warning}
        />
      </View>

      {/* Top Companies */}
      {stats.topCompanies.length > 0 && (
        <View className="mt-3 border-t border-stone-200 pt-3">
          <Text className="mb-1.5 text-xs font-semibold uppercase text-stone-400">
            Top Companies
          </Text>
          {stats.topCompanies.map((c) => (
            <View
              key={c.company}
              className="flex-row items-center justify-between py-0.5"
            >
              <Text className="text-sm text-stone-700" numberOfLines={1}>
                {c.company}
              </Text>
              <Text className="text-sm font-medium text-stone-900">
                {c.count}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Source Breakdown */}
      {stats.sourceBreakdown.length > 0 && (
        <View className="mt-3 border-t border-stone-200 pt-3">
          <Text className="mb-1.5 text-xs font-semibold uppercase text-stone-400">
            Sources
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {stats.sourceBreakdown.map((s) => (
              <View
                key={s.source}
                className="rounded-full bg-white px-2.5 py-1"
              >
                <Text className="text-xs text-stone-600">
                  {s.source}: {s.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
