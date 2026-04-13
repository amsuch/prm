import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useSession } from "@/lib/auth/ctx";
import {
  getRelationshipTypes,
  updateRelationship,
  removeRelationship,
  type RelationshipType,
} from "@/lib/relationships";
import type { RelationshipItem } from "@/hooks/useRelationships";

type EditRelationshipModalProps = {
  visible: boolean;
  onClose: () => void;
  onUpdated: () => void;
  relationship: RelationshipItem | null;
};

const CATEGORY_ORDER = ["Family", "Professional", "Social", "Other"];

export function EditRelationshipModal({
  visible,
  onClose,
  onUpdated,
  relationship,
}: EditRelationshipModalProps) {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);

  // Load relationship types
  useEffect(() => {
    if (!visible || !userId) return;
    setIsLoadingTypes(true);
    getRelationshipTypes(userId)
      .then((types) => setRelationshipTypes(types))
      .catch(() => {})
      .finally(() => setIsLoadingTypes(false));
  }, [visible, userId]);

  // Populate form from existing relationship
  useEffect(() => {
    if (visible && relationship) {
      setNotes(relationship.notes ?? "");
      // Find the matching type by name
      const matchingType = relationshipTypes.find(
        (t) =>
          t.name === relationship.relationship_name ||
          t.reverse_name === relationship.relationship_name,
      );
      if (matchingType) {
        setSelectedTypeId(matchingType.id);
      }
    }
  }, [visible, relationship, relationshipTypes]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedTypeId(null);
      setNotes("");
    }
  }, [visible]);

  const handleSave = useCallback(async () => {
    if (!relationship) return;

    setIsSaving(true);
    try {
      await updateRelationship(relationship.relationship_id, {
        notes: notes.trim() || null,
        relationshipTypeId: selectedTypeId ?? undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to update relationship",
      );
    } finally {
      setIsSaving(false);
    }
  }, [relationship, notes, selectedTypeId, onUpdated, onClose]);

  const handleDelete = useCallback(() => {
    if (!relationship) return;

    const fullName = [relationship.related_first_name, relationship.related_last_name]
      .filter(Boolean)
      .join(" ");

    Alert.alert(
      "Remove Relationship",
      `Remove "${relationship.relationship_name}" relationship with ${fullName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await removeRelationship(relationship.relationship_id);
              onUpdated();
              onClose();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to remove relationship",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [relationship, onUpdated, onClose]);

  // Group types by category
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
  const disabled = isSaving || isDeleting;
  const relatedName = relationship
    ? [relationship.related_first_name, relationship.related_last_name]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-stone-50 dark:bg-stone-950"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-stone-200 bg-white px-4 pb-3 pt-4 dark:border-stone-700 dark:bg-stone-900">
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.gray[600]} />
          </Pressable>
          <Text className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Edit Relationship
          </Text>
          <Pressable onPress={handleDelete} hitSlop={8} disabled={disabled}>
            <Ionicons
              name="trash-outline"
              size={22}
              color={disabled ? Colors.gray[300] : Colors.error}
            />
          </Pressable>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* Related contact indicator */}
          <View className="mx-4 mt-4 flex-row items-center rounded-xl bg-indigo-50 px-3 py-2.5 dark:bg-indigo-950">
            <Ionicons name="person" size={16} color={Colors.brand[600]} />
            <Text className="ml-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {relatedName}
            </Text>
          </View>

          {/* Relationship Type */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Relationship Type
            </Text>
            {isLoadingTypes ? (
              <View className="items-center rounded-xl bg-white py-6 shadow-sm dark:bg-stone-900">
                <ActivityIndicator size="small" color={Colors.brand[600]} />
              </View>
            ) : (
              <View className="rounded-xl bg-white px-3 py-3 shadow-sm dark:bg-stone-900">
                {CATEGORY_ORDER.map((category) => {
                  const types = groupedTypes[category];
                  if (!types || types.length === 0) return null;
                  return (
                    <View key={category} className="mb-3 last:mb-0">
                      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
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
                                  : "bg-stone-100 active:bg-stone-200 dark:bg-stone-800"
                              }`}
                            >
                              <Text
                                className={`text-sm font-medium ${
                                  isSelected
                                    ? "text-white"
                                    : "text-stone-700 dark:text-stone-300"
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

          {/* Asymmetric type explanation */}
          {selectedType && !selectedType.is_symmetric && selectedType.reverse_name && (
            <View className="mx-4 mt-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950">
              <Text className="text-xs text-amber-700 dark:text-amber-300">
                This contact will be shown as &quot;{selectedType.name}&quot; and the
                other contact as &quot;{selectedType.reverse_name}&quot;
              </Text>
            </View>
          )}

          {/* Notes */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Notes (optional)
            </Text>
            <TextInput
              className="min-h-[80px] rounded-xl bg-white px-3 py-3 text-base text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
              placeholder="How do they know each other?"
              placeholderTextColor={Colors.gray[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Spacer */}
          <View className="h-24" />
        </ScrollView>

        {/* Save Button */}
        <View className="border-t border-stone-200 bg-white px-4 pb-8 pt-3 dark:border-stone-700 dark:bg-stone-900">
          <Pressable
            onPress={handleSave}
            disabled={disabled}
            className={`items-center rounded-xl py-3.5 ${
              disabled
                ? "bg-stone-200 dark:bg-stone-700"
                : "bg-indigo-600 active:bg-indigo-700"
            }`}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Save Changes
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
