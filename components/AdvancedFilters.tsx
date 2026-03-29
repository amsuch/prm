import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useTags } from "@/hooks/useTags";
import type {
  SearchFilters,
  LastContactedRange,
  SourceFilter,
  SearchSortOption,
} from "@/lib/search";

type AdvancedFiltersProps = {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClear: () => void;
};

const LAST_CONTACTED_OPTIONS: { value: LastContactedRange; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "over_90d", label: "More than 90 days" },
];

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "device", label: "Device" },
  { value: "manual", label: "Manual" },
];

const SORT_OPTIONS: { value: SearchSortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "last_contacted", label: "Last Contacted" },
  { value: "recently_added", label: "Recently Added" },
];

type TriStateValue = boolean | null;
const TRI_STATE_OPTIONS: { value: TriStateValue; label: string }[] = [
  { value: null, label: "Any" },
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

export function AdvancedFilters({
  visible,
  onClose,
  filters,
  onApply,
  onClear,
}: AdvancedFiltersProps) {
  const { tags } = useTags();
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

  // Sync local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const toggleTag = (tagId: string) => {
    setLocalFilters((prev) => {
      const existing = prev.tagIds.includes(tagId);
      return {
        ...prev,
        tagIds: existing
          ? prev.tagIds.filter((id) => id !== tagId)
          : [...prev.tagIds, tagId],
      };
    });
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 pb-3 pt-4">
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.gray[600]} />
          </Pressable>
          <Text className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Filters
          </Text>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              Clear All
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Tags */}
          <View className="mt-4 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Tags
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {tags.length === 0 ? (
                <Text className="text-sm text-stone-400 dark:text-stone-500">
                  No tags created yet
                </Text>
              ) : (
                tags.map((tag) => {
                  const isSelected = localFilters.tagIds.includes(tag.id);
                  return (
                    <Pressable
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      className={`rounded-full border px-3 py-1.5 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                          : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-stone-700 dark:text-stone-300"
                        }`}
                      >
                        {tag.name}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>

          {/* Company */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Company
            </Text>
            <View className="flex-row items-center rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2">
              <Ionicons
                name="business-outline"
                size={18}
                color={Colors.gray[400]}
              />
              <TextInput
                className="ml-2 flex-1 text-base text-stone-900 dark:text-stone-100"
                placeholder="Filter by company..."
                placeholderTextColor={Colors.gray[400]}
                value={localFilters.company}
                onChangeText={(text) =>
                  setLocalFilters((prev) => ({ ...prev, company: text }))
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
              {localFilters.company.length > 0 && (
                <Pressable
                  onPress={() =>
                    setLocalFilters((prev) => ({ ...prev, company: "" }))
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Colors.gray[400]}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {/* Job Title */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Job Title
            </Text>
            <View className="flex-row items-center rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2">
              <Ionicons
                name="briefcase-outline"
                size={18}
                color={Colors.gray[400]}
              />
              <TextInput
                className="ml-2 flex-1 text-base text-stone-900 dark:text-stone-100"
                placeholder="Filter by job title..."
                placeholderTextColor={Colors.gray[400]}
                value={localFilters.jobTitle}
                onChangeText={(text) =>
                  setLocalFilters((prev) => ({ ...prev, jobTitle: text }))
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
              {localFilters.jobTitle.length > 0 && (
                <Pressable
                  onPress={() =>
                    setLocalFilters((prev) => ({ ...prev, jobTitle: "" }))
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Colors.gray[400]}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {/* Has Email */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Has Email
            </Text>
            <View className="flex-row gap-2">
              {TRI_STATE_OPTIONS.map((option) => {
                const isSelected = localFilters.hasEmail === option.value;
                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        hasEmail: option.value,
                      }))
                    }
                    className={`rounded-lg border px-4 py-2 ${
                      isSelected
                        ? "border-indigo-300 bg-indigo-100 dark:bg-indigo-900"
                        : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected
                          ? "font-medium text-indigo-700 dark:text-indigo-300"
                          : "text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Has Phone */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Has Phone
            </Text>
            <View className="flex-row gap-2">
              {TRI_STATE_OPTIONS.map((option) => {
                const isSelected = localFilters.hasPhone === option.value;
                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        hasPhone: option.value,
                      }))
                    }
                    className={`rounded-lg border px-4 py-2 ${
                      isSelected
                        ? "border-indigo-300 bg-indigo-100 dark:bg-indigo-900"
                        : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected
                          ? "font-medium text-indigo-700 dark:text-indigo-300"
                          : "text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Has Notes */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Has Notes
            </Text>
            <View className="flex-row gap-2">
              {TRI_STATE_OPTIONS.map((option) => {
                const isSelected = localFilters.hasNotes === option.value;
                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        hasNotes: option.value,
                      }))
                    }
                    className={`rounded-lg border px-4 py-2 ${
                      isSelected
                        ? "border-indigo-300 bg-indigo-100 dark:bg-indigo-900"
                        : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected
                          ? "font-medium text-indigo-700 dark:text-indigo-300"
                          : "text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Last Contacted */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Last Contacted
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {LAST_CONTACTED_OPTIONS.map((option) => {
                const isSelected =
                  localFilters.lastContactedRange === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        lastContactedRange: option.value,
                      }))
                    }
                    className={`rounded-full border px-3 py-1.5 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                        : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-stone-700 dark:text-stone-300"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Source */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Source
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SOURCE_OPTIONS.map((option) => {
                const isSelected = localFilters.source === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        source: option.value,
                      }))
                    }
                    className={`rounded-full border px-3 py-1.5 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                        : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-stone-700 dark:text-stone-300"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sort By */}
          <View className="mt-6 px-4">
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Sort By
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => {
                const isSelected = localFilters.sortBy === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        sortBy: option.value,
                      }))
                    }
                    className={`rounded-full border px-3 py-1.5 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                        : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-stone-700 dark:text-stone-300"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View className="border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 pb-8 pt-3">
          <Pressable
            onPress={handleApply}
            className="items-center rounded-xl bg-indigo-600 py-3.5 active:bg-indigo-700"
          >
            <Text className="text-base font-semibold text-white">
              Apply Filters
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
