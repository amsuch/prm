import { ScrollView, Pressable, Text } from "react-native";
import type { Tables } from "@/types/database";
import type { FilterOption } from "@/hooks/useContacts";

type FilterChipsProps = {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  tags: Tables<"tags">[];
};

type ChipItem = {
  id: FilterOption;
  label: string;
};

export function FilterChips({ activeFilter, onFilterChange, tags }: FilterChipsProps) {
  const builtInChips: ChipItem[] = [
    { id: "all", label: "All" },
    { id: "stale_30d", label: "Stale 30d+" },
    { id: "recent_7d", label: "Recent" },
  ];

  const tagChips: ChipItem[] = tags.map((t) => ({
    id: t.id,
    label: t.name,
  }));

  const chips = [...builtInChips, ...tagChips];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3 px-4"
      contentContainerStyle={{ gap: 8, alignItems: "center" }}
      style={{ maxHeight: 40 }}
    >
      {chips.map((chip) => {
        const isActive = activeFilter === chip.id;
        return (
          <Pressable
            key={chip.id}
            onPress={() => onFilterChange(chip.id)}
            style={{ alignSelf: "center" }}
            className={`rounded-lg px-3.5 py-1.5 ${
              isActive ? "bg-indigo-600" : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                isActive ? "text-white" : "text-stone-600 dark:text-stone-400"
              }`}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
