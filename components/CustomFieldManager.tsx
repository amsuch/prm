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
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import { useCustomFieldDefinitions } from "@/hooks/useCustomFieldDefinitions";
import type { Tables } from "@/types/database";

const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multi_select",
  "url",
] as const;

type FieldType = (typeof FIELD_TYPES)[number];

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Yes/No",
  select: "Select",
  multi_select: "Multi-Select",
  url: "URL",
};

const FIELD_TYPE_COLORS: Record<FieldType, { bg: string; text: string }> = {
  text: { bg: "bg-blue-100", text: "text-blue-700" },
  number: { bg: "bg-purple-100", text: "text-purple-700" },
  date: { bg: "bg-green-100", text: "text-green-700" },
  boolean: { bg: "bg-amber-100", text: "text-amber-700" },
  select: { bg: "bg-cyan-100", text: "text-cyan-700" },
  multi_select: { bg: "bg-pink-100", text: "text-pink-700" },
  url: { bg: "bg-indigo-100", text: "text-indigo-700" },
};

function FieldTypeBadge({ type }: { type: string }) {
  const fieldType = type as FieldType;
  const colors = FIELD_TYPE_COLORS[fieldType] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  const label = FIELD_TYPE_LABELS[fieldType] ?? type;

  return (
    <View className={`rounded-md px-2 py-0.5 ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>{label}</Text>
    </View>
  );
}

function FieldRow({
  field,
  onDelete,
}: {
  field: Tables<"custom_field_definitions">;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="flex-1 flex-row items-center">
        <Text className="text-sm font-medium text-gray-900">{field.name}</Text>
        <View className="ml-2">
          <FieldTypeBadge type={field.field_type} />
        </View>
      </View>
      <Pressable
        onPress={() => onDelete(field.id, field.name)}
        className="ml-2 rounded-lg p-2 active:bg-red-50"
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </Pressable>
    </View>
  );
}

export function CustomFieldManager() {
  const { session } = useSession();
  const { definitions, isLoading, refetch } = useCustomFieldDefinitions();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newOptions, setNewOptions] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const handleAdd = useCallback(async () => {
    if (!userId || !newName.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const fieldKey = newName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      const insertData: Record<string, unknown> = {
        user_id: userId,
        name: newName.trim(),
        field_key: fieldKey,
        field_type: newType,
        display_order: definitions.length,
      };

      if (
        (newType === "select" || newType === "multi_select") &&
        newOptions.trim()
      ) {
        insertData.options = newOptions
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
      }

      const { error: insertError } = await supabase
        .from("custom_field_definitions")
        .insert(insertData as never);

      if (insertError) throw insertError;

      setNewName("");
      setNewType("text");
      setNewOptions("");
      setIsAdding(false);
      await refetch();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to add custom field",
      );
    } finally {
      setIsSaving(false);
    }
  }, [userId, newName, newType, newOptions, definitions.length, refetch]);

  const handleDelete = useCallback(
    (fieldId: string, fieldName: string) => {
      const doDelete = async () => {
        try {
          const { error: deleteError } = await supabase
            .from("custom_field_definitions")
            .delete()
            .eq("id", fieldId);

          if (deleteError) throw deleteError;
          await refetch();
        } catch (err) {
          if (Platform.OS === "web") {
            window.alert(
              err instanceof Error ? err.message : "Failed to delete field",
            );
          } else {
            Alert.alert(
              "Error",
              err instanceof Error ? err.message : "Failed to delete field",
            );
          }
        }
      };

      if (Platform.OS === "web") {
        if (
          window.confirm(
            `Delete "${fieldName}"? This will remove this field from all contacts.`,
          )
        ) {
          doDelete();
        }
      } else {
        Alert.alert(
          "Delete Field",
          `Delete "${fieldName}"? This will remove this field from all contacts.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: doDelete },
          ],
        );
      }
    },
    [refetch],
  );

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  return (
    <View>
      {/* Existing fields */}
      {definitions.length === 0 && !isAdding && (
        <View className="items-center py-6">
          <Ionicons name="list-outline" size={28} color="#d1d5db" />
          <Text className="mt-1 text-sm text-gray-400">
            No custom fields defined
          </Text>
        </View>
      )}

      {definitions.map((field, index) => (
        <View key={field.id}>
          {index > 0 && <View className="ml-4 h-px bg-gray-100" />}
          <FieldRow field={field} onDelete={handleDelete} />
        </View>
      ))}

      {/* Add Field form */}
      {isAdding ? (
        <View className="border-t border-gray-100 px-4 py-3">
          <Text className="mb-2 text-sm font-medium text-gray-700">
            New Field
          </Text>

          {/* Name input */}
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Field name"
            className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"
            placeholderTextColor="#9ca3af"
            autoFocus
          />

          {/* Type picker */}
          <Text className="mb-1.5 text-xs font-medium text-gray-500">
            Field Type
          </Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {FIELD_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => setNewType(type)}
                className={`rounded-lg px-3 py-1.5 ${
                  newType === type ? "bg-blue-600" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    newType === type ? "text-white" : "text-gray-600"
                  }`}
                >
                  {FIELD_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Options input (for select/multi_select) */}
          {(newType === "select" || newType === "multi_select") && (
            <View className="mb-3">
              <Text className="mb-1.5 text-xs font-medium text-gray-500">
                Options (comma-separated)
              </Text>
              <TextInput
                value={newOptions}
                onChangeText={setNewOptions}
                placeholder="Option 1, Option 2, Option 3"
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"
                placeholderTextColor="#9ca3af"
              />
            </View>
          )}

          {saveError && (
            <Text className="mb-2 text-xs text-red-500">{saveError}</Text>
          )}

          {/* Action buttons */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setIsAdding(false);
                setNewName("");
                setNewType("text");
                setNewOptions("");
                setSaveError(null);
              }}
              className="flex-1 items-center rounded-lg border border-gray-200 py-2.5 active:bg-gray-50"
            >
              <Text className="text-sm font-medium text-gray-600">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              disabled={isSaving || !newName.trim()}
              className={`flex-1 items-center rounded-lg py-2.5 ${
                isSaving || !newName.trim()
                  ? "bg-blue-300"
                  : "bg-blue-600 active:bg-blue-700"
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
        <View className="border-t border-gray-100 px-4 py-3">
          <Pressable
            onPress={() => setIsAdding(true)}
            className="flex-row items-center justify-center rounded-lg border border-dashed border-gray-300 py-2.5 active:bg-gray-50"
          >
            <Ionicons name="add" size={18} color="#2563eb" />
            <Text className="ml-1 text-sm font-medium text-blue-600">
              Add Field
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
