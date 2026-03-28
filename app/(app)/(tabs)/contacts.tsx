import { useState, useCallback } from "react";
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
import { useContacts, type SortOption, type FilterOption } from "@/hooks/useContacts";
import { useDebounce } from "@/hooks/useDebounce";
import { Colors } from "@/constants/colors";

export default function ContactsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  const debouncedSearch = useDebounce(searchText, 300);

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
  } = useContacts(debouncedSearch, sortBy, filterBy);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

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

    if (debouncedSearch) {
      return (
        <View className="flex-1 items-center justify-center px-8 pt-20">
          <Ionicons name="search-outline" size={48} color={Colors.gray[300]} />
          <Text className="mt-3 text-center text-base font-medium text-stone-700">
            No results found
          </Text>
          <Text className="mt-1 text-center text-sm text-stone-400">
            Try a different search term or filter
          </Text>
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

  // Sort picker (inline)
  const cycleSortOption = () => {
    const options: SortOption[] = ["name_asc", "name_desc", "recent", "last_contacted"];
    const currentIndex = options.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % options.length;
    setSortBy(options[nextIndex]);
  };

  const sortLabel: Record<SortOption, string> = {
    name_asc: "A-Z",
    name_desc: "Z-A",
    recent: "Newest",
    last_contacted: "Last Contacted",
  };

  return (
    <View className="flex-1 bg-stone-50">
      {/* Search Bar */}
      <SearchBar value={searchText} onChangeText={setSearchText} />

      {/* Filter Row */}
      <View className="flex-row items-center justify-between px-4">
        <View className="flex-1">
          <FilterChips
            activeFilter={filterBy}
            onFilterChange={setFilterBy}
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
              {sortLabel[sortBy]}
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
    </View>
  );
}
