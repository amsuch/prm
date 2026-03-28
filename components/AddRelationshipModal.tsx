import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useSession } from "@/lib/auth/ctx";
import {
  addRelationship,
  getRelationshipTypes,
  searchContactsForRelationship,
  type RelationshipType,
} from "@/lib/relationships";
import { Avatar } from "@/components/Avatar";
import type { RelationshipItem } from "@/hooks/useRelationships";
import { useDebounce } from "@/hooks/useDebounce";

type AddRelationshipModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  contactId: string;
  existingRelationships: RelationshipItem[];
};

type SearchResult = {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  avatar_url: string | null;
};

const CATEGORY_ORDER = ["Family", "Professional", "Social", "Other"];

export function AddRelationshipModal({
  visible,
  onClose,
  onAdded,
  contactId,
  existingRelationships,
}: AddRelationshipModalProps) {
  const { session } = useSession();
  const userId = session?.user?.id;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SearchResult | null>(null);
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Load relationship types on mount
  useEffect(() => {
    if (!visible || !userId) return;
    setIsLoadingTypes(true);
    getRelationshipTypes(userId)
      .then((types) => {
        setRelationshipTypes(types);
        if (types.length > 0 && !selectedTypeId) {
          setSelectedTypeId(types[0].id);
        }
      })
      .catch(() => {
        // Silently handle - types will be empty
      })
      .finally(() => setIsLoadingTypes(false));
  }, [visible, userId]);

  // Search contacts when query changes
  useEffect(() => {
    if (!visible || !userId) return;

    const existingIds = existingRelationships.map((r) => r.related_contact_id);

    setIsSearching(true);
    searchContactsForRelationship({
      query: debouncedQuery,
      userId,
      excludeContactId: contactId,
      existingRelatedIds: existingIds,
    })
      .then((results) => setSearchResults(results))
      .catch(() => setSearchResults([]))
      .finally(() => setIsSearching(false));
  }, [debouncedQuery, visible, userId, contactId, existingRelationships]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedContact(null);
      setSelectedTypeId(null);
      setNotes("");
    }
  }, [visible]);

  const handleSave = useCallback(async () => {
    if (!selectedContact || !selectedTypeId) return;

    setIsSaving(true);
    try {
      await addRelationship({
        contactAId: contactId,
        contactBId: selectedContact.id,
        relationshipTypeId: selectedTypeId,
        notes: notes.trim() || undefined,
      });
      onAdded();
      onClose();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to add relationship",
      );
    } finally {
      setIsSaving(false);
    }
  }, [selectedContact, selectedTypeId, contactId, notes, onAdded, onClose]);

  // Group relationship types by category
  const groupedTypes = relationshipTypes.reduce<Record<string, RelationshipType[]>>(
    (acc, type) => {
      const cat = type.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(type);
      return acc;
    },
    {},
  );

  const selectedType = relationshipTypes.find((t) => t.id === selectedTypeId);

  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(" ");
    const isSelected = selectedContact?.id === item.id;

    return (
      <Pressable
        onPress={() => setSelectedContact(item)}
        className={`flex-row items-center rounded-xl px-3 py-2.5 ${
          isSelected ? "bg-indigo-50" : "active:bg-stone-50"
        }`}
      >
        <Avatar
          firstName={item.first_name}
          lastName={item.last_name}
          imageUrl={item.avatar_url}
          size="sm"
        />
        <View className="ml-3 flex-1">
          <Text
            className={`text-sm font-medium ${
              isSelected ? "text-indigo-700" : "text-stone-900"
            }`}
            numberOfLines={1}
          >
            {fullName}
          </Text>
          {item.company ? (
            <Text className="text-xs text-stone-500" numberOfLines={1}>
              {item.company}
            </Text>
          ) : null}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={Colors.brand[600]} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-stone-50"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-stone-200 bg-white px-4 pb-3 pt-4">
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.gray[600]} />
          </Pressable>
          <Text className="text-lg font-semibold text-stone-900">Add Relationship</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* Step 1: Search and Select Contact */}
          <View className="mx-4 mt-4">
            <Text className="mb-2 text-sm font-semibold text-stone-700">
              Select Contact
            </Text>
            <View className="flex-row items-center rounded-xl bg-white px-3 py-2 shadow-sm">
              <Ionicons name="search" size={18} color={Colors.gray[400]} />
              <TextInput
                className="ml-2 flex-1 text-base text-stone-900"
                placeholder="Search by name or company..."
                placeholderTextColor={Colors.gray[400]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  className="ml-1 rounded-full bg-stone-100 p-1"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={Colors.gray[500]} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Selected contact indicator */}
          {selectedContact && (
            <View className="mx-4 mt-2 flex-row items-center rounded-xl bg-indigo-50 px-3 py-2">
              <Ionicons name="person" size={16} color={Colors.brand[600]} />
              <Text className="ml-2 flex-1 text-sm font-medium text-indigo-700">
                {[selectedContact.first_name, selectedContact.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </Text>
              <Pressable onPress={() => setSelectedContact(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={Colors.brand[500]} />
              </Pressable>
            </View>
          )}

          {/* Search Results */}
          {!selectedContact && (
            <View className="mx-4 mt-2 max-h-48 rounded-xl bg-white shadow-sm">
              {isSearching ? (
                <View className="items-center py-6">
                  <ActivityIndicator size="small" color={Colors.brand[600]} />
                </View>
              ) : searchResults.length === 0 ? (
                <View className="items-center py-6">
                  <Text className="text-sm text-stone-400">
                    {searchQuery ? "No contacts found" : "Type to search contacts"}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSearchResult}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  style={{ maxHeight: 192 }}
                  ItemSeparatorComponent={() => (
                    <View className="mx-3 h-px bg-stone-100" />
                  )}
                />
              )}
            </View>
          )}

          {/* Step 2: Relationship Type */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700">
              Relationship Type
            </Text>
            {isLoadingTypes ? (
              <View className="items-center rounded-xl bg-white py-6 shadow-sm">
                <ActivityIndicator size="small" color={Colors.brand[600]} />
              </View>
            ) : (
              <View className="rounded-xl bg-white px-3 py-3 shadow-sm">
                {CATEGORY_ORDER.map((category) => {
                  const types = groupedTypes[category];
                  if (!types || types.length === 0) return null;
                  return (
                    <View key={category} className="mb-3 last:mb-0">
                      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                        {category}
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {types.map((type) => {
                          const isSelected = selectedTypeId === type.id;
                          return (
                            <Pressable
                              key={type.id}
                              onPress={() => setSelectedTypeId(type.id)}
                              className={`rounded-lg px-3 py-1.5 ${
                                isSelected
                                  ? "bg-indigo-600"
                                  : "bg-stone-100 active:bg-stone-200"
                              }`}
                            >
                              <Text
                                className={`text-sm font-medium ${
                                  isSelected ? "text-white" : "text-stone-700"
                                }`}
                              >
                                {type.name}
                                {type.reverse_name && !type.is_symmetric
                                  ? ` / ${type.reverse_name}`
                                  : ""}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Selected type description for asymmetric */}
          {selectedType && !selectedType.is_symmetric && selectedType.reverse_name && (
            <View className="mx-4 mt-2 rounded-lg bg-amber-50 px-3 py-2">
              <Text className="text-xs text-amber-700">
                This contact will be shown as "{selectedType.name}" and the other
                contact as "{selectedType.reverse_name}"
              </Text>
            </View>
          )}

          {/* Step 3: Optional Notes */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700">
              Notes (optional)
            </Text>
            <TextInput
              className="min-h-[80px] rounded-xl bg-white px-3 py-3 text-base text-stone-900 shadow-sm"
              placeholder="How do they know each other?"
              placeholderTextColor={Colors.gray[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </ScrollView>

        {/* Save Button */}
        <View className="border-t border-stone-200 bg-white px-4 pb-8 pt-3">
          <Pressable
            onPress={handleSave}
            disabled={!selectedContact || !selectedTypeId || isSaving}
            className={`items-center rounded-xl py-3.5 ${
              selectedContact && selectedTypeId && !isSaving
                ? "bg-indigo-600 active:bg-indigo-700"
                : "bg-stone-200"
            }`}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                className={`text-base font-semibold ${
                  selectedContact && selectedTypeId ? "text-white" : "text-stone-400"
                }`}
              >
                Add Relationship
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
