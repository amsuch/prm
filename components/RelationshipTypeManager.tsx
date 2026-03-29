import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRelationshipTypes, type RelationshipType } from "@/hooks/useRelationshipTypes";

const CATEGORIES = ["Family", "Professional", "Social", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<Category, { bg: string; text: string }> = {
  Family: { bg: "bg-pink-100", text: "text-pink-700" },
  Professional: { bg: "bg-indigo-100", text: "text-indigo-700" },
  Social: { bg: "bg-green-100", text: "text-green-700" },
  Other: { bg: "bg-stone-100", text: "text-stone-700" },
};

function CategoryBadge({ category }: { category: string }) {
  const cat = category as Category;
  const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;

  return (
    <View className={`rounded-md px-2 py-0.5 ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>{category}</Text>
    </View>
  );
}

function TypeRow({
  type,
  onDelete,
}: {
  type: RelationshipType;
  onDelete: (id: string, name: string) => void;
}) {
  const isAsymmetric = !type.is_symmetric && type.reverse_name !== type.name;

  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="text-sm font-medium text-stone-900 dark:text-stone-100">{type.name}</Text>
          {isAsymmetric && (
            <Text className="ml-1.5 text-sm text-stone-400 dark:text-stone-500">
              / {type.reverse_name}
            </Text>
          )}
          <View className="ml-2">
            <CategoryBadge category={type.category} />
          </View>
          {type.is_symmetric && (
            <View className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5">
              <Text className="text-xs text-amber-600">symmetric</Text>
            </View>
          )}
        </View>
        {type.is_system && (
          <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">System</Text>
        )}
      </View>
      {!type.is_system && (
        <Pressable
          onPress={() => onDelete(type.id, type.name)}
          className="ml-2 rounded-lg p-2 active:bg-red-50 dark:active:bg-red-950"
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </Pressable>
      )}
    </View>
  );
}

export function RelationshipTypeManager() {
  const { types, isLoading, createType, deleteType } = useRelationshipTypes();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newReverseName, setNewReverseName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Professional");
  const [isSymmetric, setIsSymmetric] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSymmetricToggle = useCallback(
    (value: boolean) => {
      setIsSymmetric(value);
      if (value) {
        setNewReverseName(newName);
      }
    },
    [newName],
  );

  const handleNameChange = useCallback(
    (text: string) => {
      setNewName(text);
      if (isSymmetric) {
        setNewReverseName(text);
      }
    },
    [isSymmetric],
  );

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await createType({
        name: newName.trim(),
        reverse_name: isSymmetric ? newName.trim() : newReverseName.trim() || newName.trim(),
        category: newCategory,
        is_symmetric: isSymmetric,
      });

      setNewName("");
      setNewReverseName("");
      setNewCategory("Professional");
      setIsSymmetric(true);
      setIsAdding(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to add relationship type",
      );
    } finally {
      setIsSaving(false);
    }
  }, [newName, newReverseName, newCategory, isSymmetric, createType]);

  const handleDelete = useCallback(
    (typeId: string, typeName: string) => {
      const doDelete = async () => {
        try {
          await deleteType(typeId);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to delete relationship type";
          if (Platform.OS === "web") {
            window.alert(message);
          } else {
            Alert.alert("Error", message);
          }
        }
      };

      if (Platform.OS === "web") {
        if (
          window.confirm(
            `Delete relationship type "${typeName}"? Existing relationships using this type will be affected.`,
          )
        ) {
          doDelete();
        }
      } else {
        Alert.alert(
          "Delete Type",
          `Delete relationship type "${typeName}"? Existing relationships using this type will be affected.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: doDelete },
          ],
        );
      }
    },
    [deleteType],
  );

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  // Group types by category
  const grouped = CATEGORIES.reduce(
    (acc, cat) => {
      const filtered = types.filter((t) => t.category === cat);
      if (filtered.length > 0) {
        acc.push({ category: cat, types: filtered });
      }
      return acc;
    },
    [] as { category: Category; types: RelationshipType[] }[],
  );

  return (
    <View>
      {types.length === 0 && !isAdding && (
        <View className="items-center py-6">
          <Ionicons name="people-outline" size={28} color="#d1d5db" />
          <Text className="mt-1 text-sm text-stone-400 dark:text-stone-500">
            No relationship types defined
          </Text>
        </View>
      )}

      {grouped.map((group, groupIndex) => (
        <View key={group.category}>
          {groupIndex > 0 && <View className="mx-4 h-px bg-stone-100 dark:bg-stone-800" />}
          <View className="px-4 pb-1 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              {group.category}
            </Text>
          </View>
          {group.types.map((type, index) => (
            <View key={type.id}>
              {index > 0 && <View className="ml-4 h-px bg-stone-50 dark:bg-stone-800" />}
              <TypeRow type={type} onDelete={handleDelete} />
            </View>
          ))}
        </View>
      ))}

      {/* Add Type form */}
      {isAdding ? (
        <View className="border-t border-stone-100 dark:border-stone-800 px-4 py-3">
          <Text className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
            New Relationship Type
          </Text>

          {/* Name */}
          <TextInput
            value={newName}
            onChangeText={handleNameChange}
            placeholder="Name (e.g. Mentor)"
            className="mb-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            placeholderTextColor="#a8a29e"
            autoFocus
          />

          {/* Reverse Name (only if asymmetric) */}
          {!isSymmetric && (
            <View className="mb-3">
              <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                Reverse Name
              </Text>
              <TextInput
                value={newReverseName}
                onChangeText={setNewReverseName}
                placeholder="Reverse name (e.g. Mentee)"
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
                placeholderTextColor="#a8a29e"
              />
              <Text className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                If A is &quot;{newName || "Mentor"}&quot; to B, then B is &quot;{newReverseName || "Mentee"}&quot; to A
              </Text>
            </View>
          )}

          {/* Category picker */}
          <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
            Category
          </Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setNewCategory(cat)}
                className={`rounded-lg px-3 py-1.5 ${
                  newCategory === cat ? "bg-indigo-600" : "bg-stone-100 dark:bg-stone-800"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    newCategory === cat ? "text-white" : "text-stone-600 dark:text-stone-400"
                  }`}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Symmetric toggle */}
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-medium text-stone-700 dark:text-stone-300">Symmetric</Text>
              <Text className="text-xs text-stone-400 dark:text-stone-500">
                Both sides use the same label (e.g. Friend)
              </Text>
            </View>
            <Switch
              value={isSymmetric}
              onValueChange={handleSymmetricToggle}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={isSymmetric ? "#2563eb" : "#f4f4f5"}
            />
          </View>

          {saveError && (
            <Text className="mb-2 text-xs text-red-500">{saveError}</Text>
          )}

          {/* Action buttons */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setIsAdding(false);
                setNewName("");
                setNewReverseName("");
                setNewCategory("Professional");
                setIsSymmetric(true);
                setSaveError(null);
              }}
              className="flex-1 items-center rounded-lg border border-stone-200 dark:border-stone-700 py-2.5 active:bg-stone-50 dark:active:bg-stone-800"
            >
              <Text className="text-sm font-medium text-stone-600 dark:text-stone-400">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              disabled={isSaving || !newName.trim()}
              className={`flex-1 items-center rounded-lg py-2.5 ${
                isSaving || !newName.trim()
                  ? "bg-indigo-300"
                  : "bg-indigo-600 active:bg-indigo-700"
              }`}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-sm font-medium text-white">Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="border-t border-stone-100 dark:border-stone-800 px-4 py-3">
          <Pressable
            onPress={() => setIsAdding(true)}
            className="flex-row items-center justify-center rounded-lg border border-dashed border-stone-300 dark:border-stone-600 py-2.5 active:bg-stone-50 dark:active:bg-stone-800"
          >
            <Ionicons name="add" size={18} color="#2563eb" />
            <Text className="ml-1 text-sm font-medium text-indigo-600">
              Add Type
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
