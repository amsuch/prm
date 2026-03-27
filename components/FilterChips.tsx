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
      className="mb-2 px-4"
      contentContainerStyle={{ gap: 8 }}
    >
      {chips.map((chip) => {
        const isActive = activeFilter === chip.id;
        return (
          <Pressable
            key={chip.id}
            onPress={() => onFilterChange(chip.id)}
            className={`rounded-full px-4 py-1.5 ${
              isActive ? "bg-blue-600" : "bg-white border border-gray-200"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isActive ? "text-white" : "text-gray-600"
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
