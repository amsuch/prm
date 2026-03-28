import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DeviceContact } from "@/lib/contacts";
import { getInitials } from "@/lib/utils";

type DeviceContactListProps = {
  contacts: DeviceContact[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
};

export function DeviceContactList({
  contacts,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: DeviceContactListProps) {
  const [search, setSearch] = useState("");

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const query = search.toLowerCase();
    return contacts.filter((c) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const company = (c.company ?? "").toLowerCase();
      const emails = c.emails.map((e) => e.email.toLowerCase()).join(" ");
      return (
        fullName.includes(query) ||
        company.includes(query) ||
        emails.includes(query)
      );
    });
  }, [contacts, search]);

  const allSelected = filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.has(c.id));

  const renderItem = useCallback(
    ({ item }: { item: DeviceContact }) => {
      const isSelected = selectedIds.has(item.id);
      const initials = getInitials(item.firstName, item.lastName);
      const primaryEmail = item.emails[0]?.email;
      const primaryPhone = item.phones[0]?.number;

      return (
        <Pressable
          className={`flex-row items-center border-b border-stone-100 px-4 py-3 ${
            isSelected ? "bg-indigo-50/50" : "bg-white"
          } active:bg-stone-50`}
          onPress={() => onToggle(item.id)}
        >
          {/* Checkbox */}
          <View
            className={`mr-3 h-6 w-6 items-center justify-center rounded-md border-2 ${
              isSelected
                ? "border-indigo-600 bg-indigo-600"
                : "border-stone-300 bg-white"
            }`}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </View>

          {/* Avatar */}
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-stone-200">
            <Text className="text-sm font-semibold text-stone-600">
              {initials}
            </Text>
          </View>

          {/* Info */}
          <View className="flex-1">
            <Text className="text-sm font-medium text-stone-900">
              {item.firstName} {item.lastName}
            </Text>
            {item.company && (
              <Text className="text-xs text-stone-500" numberOfLines={1}>
                {item.company}
                {item.jobTitle ? ` - ${item.jobTitle}` : ""}
              </Text>
            )}
            {primaryEmail && (
              <Text className="text-xs text-stone-400" numberOfLines={1}>
                {primaryEmail}
              </Text>
            )}
            {!primaryEmail && primaryPhone && (
              <Text className="text-xs text-stone-400" numberOfLines={1}>
                {primaryPhone}
              </Text>
            )}
          </View>
        </Pressable>
      );
    },
    [selectedIds, onToggle],
  );

  return (
    <View className="flex-1">
      {/* Search + controls */}
      <View className="border-b border-stone-200 bg-white px-4 py-3">
        <View className="mb-3 flex-row items-center rounded-lg border border-stone-200 bg-stone-50 px-3">
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            className="ml-2 flex-1 py-2.5 text-sm text-stone-900"
            placeholder="Search contacts..."
            placeholderTextColor="#a8a29e"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-stone-500">
            {selectedIds.size} of {contacts.length} selected
            {search ? ` (${filteredContacts.length} shown)` : ""}
          </Text>
          <Pressable
            className="rounded-md px-3 py-1.5 active:bg-stone-100"
            onPress={allSelected ? onDeselectAll : onSelectAll}
          >
            <Text className="text-xs font-semibold text-indigo-600">
              {allSelected ? "Deselect All" : "Select All"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Contact list */}
      <FlatList
        data={filteredContacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredContacts.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-12">
            <Ionicons name="search-outline" size={40} color="#d1d5db" />
            <Text className="mt-3 text-sm text-stone-400">
              {search
                ? "No contacts match your search"
                : "No contacts found on device"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
