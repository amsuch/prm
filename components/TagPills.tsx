import { View, Text, ScrollView } from "react-native";
import type { Tables } from "@/types/database";

type TagPillsProps = {
  tags: Tables<"tags">[];
};

const TAG_COLORS = [
  { bg: "bg-indigo-50 dark:bg-indigo-950", text: "text-indigo-700" },
  { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-700" },
  { bg: "bg-green-50 dark:bg-green-950", text: "text-green-700" },
  { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700" },
  { bg: "bg-rose-50 dark:bg-rose-950", text: "text-rose-700" },
  { bg: "bg-cyan-50 dark:bg-cyan-950", text: "text-cyan-700" },
  { bg: "bg-indigo-50 dark:bg-indigo-950", text: "text-indigo-700" },
];

function getTagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length];
}

export function TagPills({ tags }: TagPillsProps) {
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {tags.map((tag, i) => {
        const color = getTagColor(i);
        return (
          <View key={tag.id} className={`rounded-full px-3 py-1 ${color.bg}`}>
            <Text className={`text-xs font-semibold ${color.text}`}>{tag.name}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
