import { useState } from "react";
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
import { EntityCard } from "@/components/EntityCard";
import { useEntities } from "@/hooks/useEntities";
import { useDebounce } from "@/hooks/useDebounce";
import { Colors } from "@/constants/colors";

export default function EntitiesScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");

  const debouncedSearch = useDebounce(searchText, 300);

  const { entities, isLoading, error, refresh } = useEntities(debouncedSearch);

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
            Try a different search term
          </Text>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-8 pt-20">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
          <Ionicons name="business-outline" size={32} color={Colors.brand[600]} />
        </View>
        <Text className="text-center text-lg font-semibold text-stone-800">
          No entities yet
        </Text>
        <Text className="mt-2 text-center text-sm text-stone-400">
          Add places and organizations you frequent — restaurants, gyms, companies, clubs
        </Text>
        <Pressable
          onPress={() => router.push("/entity/new" as never)}
          className="mt-5 flex-row items-center rounded-lg bg-indigo-600 px-4 py-2.5 active:bg-indigo-700"
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="ml-1 text-sm font-medium text-white">Add Entity</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-stone-50">
      {/* Search Bar */}
      <SearchBar
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search entities..."
      />

      {/* Loading State */}
      {isLoading && entities.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.brand[600]} />
          <Text className="mt-3 text-sm text-stone-400">Loading entities...</Text>
        </View>
      ) : (
        <FlatList
          data={entities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EntityCard entity={item} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={false}
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/entity/new" as never)}
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
