import { useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import type { Tables } from "@/types/database";

type TagSelectorProps = {
  allTags: Tables<"tags">[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string) => Promise<Tables<"tags"> | null>;
  isLoading?: boolean;
};

export function TagSelector({
  allTags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  isLoading = false,
}: TagSelectorProps) {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    const tag = await onCreateTag(trimmed);
    setIsCreating(false);

    if (tag) {
      onToggleTag(tag.id);
      setNewTagName("");
      setShowNewInput(false);
    }
  };

  if (isLoading) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color={Colors.brand[600]} />
      </View>
    );
  }

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {allTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <Pressable
              key={tag.id}
              onPress={() => onToggleTag(tag.id)}
              className={`flex-row items-center rounded-full px-3 py-1.5 ${
                isSelected ? "bg-indigo-600" : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
              }`}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color="white"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                className={`text-sm ${
                  isSelected ? "text-white font-medium" : "text-stone-600 dark:text-stone-400"
                }`}
              >
                {tag.name}
              </Text>
            </Pressable>
          );
        })}

        {/* Add new tag button */}
        {!showNewInput && (
          <Pressable
            onPress={() => setShowNewInput(true)}
            className="flex-row items-center rounded-full border border-dashed border-stone-300 dark:border-stone-600 px-3 py-1.5"
          >
            <Ionicons name="add" size={14} color={Colors.gray[500]} />
            <Text className="ml-1 text-sm text-stone-500 dark:text-stone-400">New tag</Text>
          </Pressable>
        )}
      </View>

      {/* New tag input */}
      {showNewInput && (
        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
            placeholder="Tag name"
            placeholderTextColor={Colors.gray[400]}
            value={newTagName}
            onChangeText={setNewTagName}
            autoFocus
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleCreate}
            disabled={isCreating || !newTagName.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-2 active:bg-indigo-700 disabled:opacity-50"
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-sm font-medium text-white">Add</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setShowNewInput(false);
              setNewTagName("");
            }}
            className="rounded-lg bg-stone-100 dark:bg-stone-800 px-3 py-2"
          >
            <Ionicons name="close" size={16} color={Colors.gray[500]} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
