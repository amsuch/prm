import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { ContactCard } from "@/components/ContactCard";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { useContacts, type FilterOption } from "@/hooks/useContacts";
import { useDebounce } from "@/hooks/useDebounce";
import { Colors } from "@/constants/colors";
import { DEFAULT_FILTERS, countActiveFilters } from "@/lib/search";
import type { SearchFilters } from "@/lib/search";

const SORT_CYCLE_OPTIONS = ["name_asc", "recently_added", "last_contacted"] as const;

export default function ContactsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(searchText, 300);

  // Build the full filters object with debounced search query
  const activeFilters = useMemo<SearchFilters>(
    () => ({
      ...filters,
      query: debouncedSearch,
    }),
    [filters, debouncedSearch],
  );

  const {
    contacts,
    tags,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useContacts(activeFilters);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters],
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // Map FilterChip quick-filter changes to SearchFilters
  const handleQuickFilter = useCallback((filter: FilterOption) => {
    setFilters((prev) => {
      // Reset the quick-filter-relevant fields
      const base: SearchFilters = {
        ...prev,
        tagIds: [],
        lastContactedRange: "any",
      };

      if (filter === "all") {
        return base;
      } else if (filter === "stale_30d") {
        return { ...base, lastContactedRange: "over_90d" as const };
      } else if (filter === "recent_7d") {
        return { ...base, lastContactedRange: "7d" as const };
      } else {
        // Tag ID
        return { ...base, tagIds: [filter] };
      }
    });
  }, []);

  // Derive the active FilterOption from current filters for FilterChips highlighting
  const activeChipFilter = useMemo<FilterOption>(() => {
    if (filters.tagIds.length === 1) return filters.tagIds[0];
    if (filters.lastContactedRange === "over_90d") return "stale_30d";
    if (filters.lastContactedRange === "7d") return "recent_7d";
    return "all";
  }, [filters.tagIds, filters.lastContactedRange]);

  const handleApplyFilters = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Sort cycling (updates the sortBy within filters)
  const cycleSortOption = useCallback(() => {
    setFilters((prev) => {
      const currentIndex = SORT_CYCLE_OPTIONS.indexOf(prev.sortBy as typeof SORT_CYCLE_OPTIONS[number]);
      const nextIndex = (currentIndex + 1) % SORT_CYCLE_OPTIONS.length;
      return { ...prev, sortBy: SORT_CYCLE_OPTIONS[nextIndex] };
    });
  }, []);

  const sortLabel: Record<string, string> = {
    name_asc: "A-Z",
    relevance: "Relevance",
    recently_added: "Newest",
    last_contacted: "Last Contacted",
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color={Colors.brand[600]} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    if (error) {
      return (
        <View className="flex-1 items-center justify-center px-8 pt-20">
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text className="mt-3 text-center text-base font-medium text-stone-700">
            Something went wrong
          </Text>
          <Text className="mt-1 text-center text-sm text-stone-400">{error}</Text>
          <Pressable
            onPress={refresh}
            className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 active:bg-indigo-700"
          >
            <Text className="text-sm font-medium text-white">Try Again</Text>
          </Pressable>
        </View>
      );
    }

    if (debouncedSearch || activeFilterCount > 0) {
      return (
        <View className="flex-1 items-center justify-center px-8 pt-20">
          <Ionicons name="search-outline" size={48} color={Colors.gray[300]} />
          <Text className="mt-3 text-center text-base font-medium text-stone-700">
            No results found
          </Text>
          <Text className="mt-1 text-center text-sm text-stone-400">
            Try a different search term or filter
          </Text>
          {activeFilterCount > 0 && (
            <Pressable
              onPress={handleClearFilters}
              className="mt-4 rounded-lg border border-stone-200 bg-white px-5 py-2 active:bg-stone-50"
            >
              <Text className="text-sm font-medium text-indigo-600">Clear Filters</Text>
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-8 pt-20">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
          <Ionicons name="people-outline" size={32} color={Colors.brand[600]} />
        </View>
        <Text className="text-center text-lg font-semibold text-stone-800">
          No contacts yet
        </Text>
        <Text className="mt-2 text-center text-sm text-stone-400">
          Add your first contact or import from LinkedIn / your device
        </Text>
        <View className="mt-5 flex-row gap-3">
          <Pressable
            onPress={() => router.push("/contact/new")}
            className="flex-row items-center rounded-lg bg-indigo-600 px-4 py-2.5 active:bg-indigo-700"
          >
            <Ionicons name="add" size={18} color="white" />
            <Text className="ml-1 text-sm font-medium text-white">Add Contact</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/import")}
            className="flex-row items-center rounded-lg border border-stone-200 bg-white px-4 py-2.5 active:bg-stone-50"
          >
            <Ionicons name="download-outline" size={18} color={Colors.gray[600]} />
            <Text className="ml-1 text-sm font-medium text-stone-700">Import</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-stone-50">
      {/* Search Bar + Filter Button */}
      <View className="flex-row items-center pr-4">
        <View className="flex-1">
          <SearchBar value={searchText} onChangeText={setSearchText} />
        </View>
        <Pressable
          onPress={() => setShowFilters(true)}
          className="rounded-xl bg-white p-3 shadow-sm active:bg-stone-50"
        >
          <Ionicons name="options-outline" size={20} color={Colors.gray[700]} />
          {activeFilterCount > 0 && (
            <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
              <Text className="text-xs font-bold text-white">{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Filter Row */}
      <View className="flex-row items-center justify-between px-4">
        <View className="flex-1">
          <FilterChips
            activeFilter={activeChipFilter}
            onFilterChange={handleQuickFilter}
            tags={tags}
          />
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/import")}
            className="flex-row items-center rounded-full bg-white px-3 py-1.5 shadow-sm active:bg-stone-50"
          >
            <Ionicons name="download-outline" size={14} color={Colors.brand[600]} />
            <Text className="ml-1 text-xs font-medium text-indigo-600">Import</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/bulk-link")}
            className="flex-row items-center rounded-full bg-white px-3 py-1.5 shadow-sm active:bg-stone-50"
          >
            <Ionicons name="link" size={14} color={Colors.brand[600]} />
            <Text className="ml-1 text-xs font-medium text-indigo-600">Link</Text>
          </Pressable>
          <Pressable
            onPress={cycleSortOption}
            className="flex-row items-center rounded-full bg-white px-3 py-1.5 shadow-sm active:bg-stone-50"
          >
            <Ionicons name="swap-vertical" size={14} color={Colors.gray[500]} />
            <Text className="ml-1 text-xs font-medium text-stone-500">
              {sortLabel[filters.sortBy] ?? "A-Z"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Loading State */}
      {isLoading && contacts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.brand[600]} />
          <Text className="mt-3 text-sm text-stone-400">Loading contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ContactCard contact={item} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={isRefreshing}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/contact/new")}
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg active:bg-indigo-700"
        style={{
          elevation: 8,
          shadowColor: Colors.brand[900],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>

      {/* Advanced Filters Modal */}
      <AdvancedFilters
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />
    </View>
  );
}
