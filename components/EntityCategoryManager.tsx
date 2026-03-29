import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEntityCategories, type EntityCategory } from "@/hooks/useEntityCategories";
import { Colors, AvatarColors } from "@/constants/colors";

const ICON_OPTIONS: { name: string; label: string }[] = [
  { name: "restaurant-outline", label: "Restaurant" },
  { name: "business-outline", label: "Company" },
  { name: "barbell-outline", label: "Gym" },
  { name: "people-outline", label: "Club" },
  { name: "school-outline", label: "School" },
  { name: "heart-outline", label: "Church" },
  { name: "storefront-outline", label: "Store" },
  { name: "beer-outline", label: "Bar" },
  { name: "cafe-outline", label: "Cafe" },
  { name: "cut-outline", label: "Salon" },
  { name: "medkit-outline", label: "Medical" },
  { name: "home-outline", label: "Home" },
  { name: "car-outline", label: "Auto" },
  { name: "airplane-outline", label: "Travel" },
  { name: "musical-notes-outline", label: "Music" },
  { name: "library-outline", label: "Library" },
  { name: "globe-outline", label: "Other" },
  { name: "star-outline", label: "Favorite" },
];

function CategoryRow({
  category,
  onDelete,
  onUpdate,
}: {
  category: EntityCategory;
  onDelete: (id: string, name: string) => void;
  onUpdate: (id: string, data: { name: string; icon: string; color: string }) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editIcon, setEditIcon] = useState(category.icon);
  const [editColor, setEditColor] = useState(category.color);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    setEditError(null);
    try {
      await onUpdate(category.id, {
        name: editName.trim(),
        icon: editIcon,
        color: editColor,
      });
      setIsEditing(false);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update category",
      );
    } finally {
      setIsSaving(false);
    }
  }, [category.id, editName, editIcon, editColor, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
    setEditError(null);
    setIsEditing(false);
  }, [category.name, category.icon, category.color]);

  if (isEditing) {
    return (
      <View className="px-4 py-3">
        {/* Name input */}
        <TextInput
          value={editName}
          onChangeText={setEditName}
          placeholder="Category name"
          className="mb-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-4 py-2.5 text-sm text-stone-900 dark:text-stone-100"
          placeholderTextColor={Colors.gray[400]}
          autoFocus
        />

        {/* Icon picker */}
        <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Icon</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon.name}
              onPress={() => setEditIcon(icon.name)}
              className={`items-center justify-center rounded-lg p-2 ${
                editIcon === icon.name
                  ? "bg-indigo-100 dark:bg-indigo-900 border border-indigo-300"
                  : "bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
              }`}
              style={{ width: 40, height: 40 }}
            >
              <Ionicons
                name={icon.name as keyof typeof Ionicons.glyphMap}
                size={18}
                color={
                  editIcon === icon.name
                    ? Colors.brand[600]
                    : Colors.gray[500]
                }
              />
            </Pressable>
          ))}
        </View>

        {/* Color picker */}
        <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Color</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {AvatarColors.map((color) => (
            <Pressable
              key={color}
              onPress={() => setEditColor(color)}
              className={`h-8 w-8 items-center justify-center rounded-full ${
                editColor === color ? "border-2 border-stone-400" : ""
              }`}
              style={{ backgroundColor: color }}
            >
              {editColor === color && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </Pressable>
          ))}
        </View>

        {editError && (
          <Text className="mb-2 text-xs text-red-500">{editError}</Text>
        )}

        {/* Save / Cancel buttons */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleCancel}
            className="flex-1 items-center rounded-lg border border-stone-200 dark:border-stone-700 py-2.5 active:bg-stone-50 dark:active:bg-stone-800"
          >
            <Text className="text-sm font-medium text-stone-600 dark:text-stone-400">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving || !editName.trim()}
            className={`flex-1 items-center rounded-lg py-2.5 ${
              isSaving || !editName.trim()
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
    );
  }

  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable
        onPress={() => setIsEditing(true)}
        className="flex-1 flex-row items-center active:opacity-70"
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={category.color}
        />
        <Text className="ml-2.5 text-sm font-medium text-stone-900 dark:text-stone-100">
          {category.name}
        </Text>
        <View
          className="ml-2 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        {category.is_system && (
          <Text className="ml-2 text-xs text-stone-400 dark:text-stone-500">System</Text>
        )}
      </Pressable>
      {!category.is_system && (
        <Pressable
          onPress={() => onDelete(category.id, category.name)}
          className="ml-2 rounded-lg p-2 active:bg-red-50 dark:active:bg-red-950"
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </Pressable>
      )}
    </View>
  );
}

export function EntityCategoryManager() {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } =
    useEntityCategories();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0].name);
  const [selectedColor, setSelectedColor] = useState<string>(AvatarColors[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await createCategory({
        name: newName.trim(),
        icon: selectedIcon,
        color: selectedColor,
      });

      setNewName("");
      setSelectedIcon(ICON_OPTIONS[0].name);
      setSelectedColor(AvatarColors[0]);
      setIsAdding(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to add category",
      );
    } finally {
      setIsSaving(false);
    }
  }, [newName, selectedIcon, selectedColor, createCategory]);

  const handleDelete = useCallback(
    (categoryId: string, categoryName: string) => {
      const doDelete = async () => {
        try {
          await deleteCategory(categoryId);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to delete category";
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
            `Delete "${categoryName}"? Entities using this category will keep their current category text.`,
          )
        ) {
          doDelete();
        }
      } else {
        Alert.alert(
          "Delete Category",
          `Delete "${categoryName}"? Entities using this category will keep their current category text.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: doDelete },
          ],
        );
      }
    },
    [deleteCategory],
  );

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color={Colors.brand[600]} />
      </View>
    );
  }

  return (
    <View>
      {/* Existing categories */}
      {categories.length === 0 && !isAdding && (
        <View className="items-center py-6">
          <Ionicons name="grid-outline" size={28} color={Colors.gray[300]} />
          <Text className="mt-1 text-sm text-stone-400 dark:text-stone-500">
            No categories defined
          </Text>
        </View>
      )}

      {categories.map((cat, index) => (
        <View key={cat.id}>
          {index > 0 && <View className="ml-4 h-px bg-stone-100 dark:bg-stone-800" />}
          <CategoryRow category={cat} onDelete={handleDelete} onUpdate={updateCategory} />
        </View>
      ))}

      {/* Add Category form */}
      {isAdding ? (
        <View className="border-t border-stone-100 dark:border-stone-800 px-4 py-3">
          <Text className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
            New Category
          </Text>

          {/* Name input */}
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Category name"
            className="mb-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-4 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            placeholderTextColor={Colors.gray[400]}
            autoFocus
          />

          {/* Icon picker */}
          <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Icon</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {ICON_OPTIONS.map((icon) => (
              <Pressable
                key={icon.name}
                onPress={() => setSelectedIcon(icon.name)}
                className={`items-center justify-center rounded-lg p-2 ${
                  selectedIcon === icon.name
                    ? "bg-indigo-100 border border-indigo-300"
                    : "bg-stone-50 border border-stone-200"
                }`}
                style={{ width: 40, height: 40 }}
              >
                <Ionicons
                  name={icon.name as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={
                    selectedIcon === icon.name
                      ? Colors.brand[600]
                      : Colors.gray[500]
                  }
                />
              </Pressable>
            ))}
          </View>

          {/* Color picker */}
          <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Color</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {AvatarColors.map((color) => (
              <Pressable
                key={color}
                onPress={() => setSelectedColor(color)}
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  selectedColor === color ? "border-2 border-stone-400" : ""
                }`}
                style={{ backgroundColor: color }}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={14} color="white" />
                )}
              </Pressable>
            ))}
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
                setSelectedIcon(ICON_OPTIONS[0].name);
                setSelectedColor(AvatarColors[0]);
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
            <Ionicons name="add" size={18} color={Colors.brand[600]} />
            <Text className="ml-1 text-sm font-medium text-indigo-600">
              Add Category
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
