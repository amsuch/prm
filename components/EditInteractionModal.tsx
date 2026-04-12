import { useState, useCallback, useEffect } from "react";
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
import {
  updateInteraction,
  deleteInteraction,
  INTERACTION_TYPES,
  INTERACTION_DIRECTIONS,
  type InteractionType,
  type InteractionDirection,
} from "@/lib/interactions";
import { DateTimePicker } from "@/components/DateTimePicker";
import type { Tables } from "@/types/database";

type EditInteractionModalProps = {
  visible: boolean;
  onClose: () => void;
  onUpdated: () => void;
  interaction: Tables<"interactions"> | null;
  contactName: string;
};

export function EditInteractionModal({
  visible,
  onClose,
  onUpdated,
  interaction,
  contactName,
}: EditInteractionModalProps) {
  const [selectedType, setSelectedType] = useState<InteractionType>("call");
  const [direction, setDirection] = useState<InteractionDirection>("outbound");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Populate form from interaction when modal opens
  useEffect(() => {
    if (visible && interaction) {
      setSelectedType((interaction.type as InteractionType) ?? "call");
      setDirection(
        interaction.direction
          ? (interaction.direction as InteractionDirection)
          : "none",
      );
      setTitle(interaction.title ?? "");
      setBody(interaction.body ?? "");
      setOccurredAt(interaction.occurred_at);
    }
  }, [visible, interaction]);

  const handleSave = useCallback(async () => {
    if (!interaction) return;

    setIsSaving(true);
    try {
      await updateInteraction(interaction.id, {
        type: selectedType,
        direction,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        occurredAt,
      });
      onUpdated();
      onClose();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to update interaction",
      );
    } finally {
      setIsSaving(false);
    }
  }, [interaction, selectedType, direction, title, body, occurredAt, onUpdated, onClose]);

  const handleDelete = useCallback(() => {
    if (!interaction) return;

    Alert.alert(
      "Delete Interaction",
      "Are you sure you want to delete this interaction? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteInteraction(interaction.id);
              onUpdated();
              onClose();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to delete interaction",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [interaction, onUpdated, onClose]);

  const selectedTypeConfig = INTERACTION_TYPES.find((t) => t.value === selectedType);
  const disabled = isSaving || isDeleting;

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
            Edit Interaction
          </Text>
          <Pressable onPress={handleDelete} hitSlop={8} disabled={disabled}>
            <Ionicons
              name="trash-outline"
              size={22}
              color={disabled ? Colors.gray[300] : Colors.error}
            />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Contact Name */}
          <View className="mx-4 mt-4 flex-row items-center rounded-xl bg-white px-3 py-2.5 shadow-sm dark:bg-stone-900">
            <Ionicons name="person" size={16} color={Colors.brand[600]} />
            <Text className="ml-2 text-sm font-medium text-stone-700 dark:text-stone-300">
              with {contactName}
            </Text>
          </View>

          {/* Type Selection */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {INTERACTION_TYPES.map((type) => {
                const isSelected = selectedType === type.value;
                return (
                  <Pressable
                    key={type.value}
                    onPress={() => setSelectedType(type.value)}
                    className={`flex-row items-center rounded-xl px-3 py-2 ${
                      isSelected
                        ? "border-2 bg-white shadow-sm dark:bg-stone-900"
                        : "border-2 border-transparent bg-white active:bg-stone-50 dark:bg-stone-900 dark:active:bg-stone-800"
                    }`}
                    style={isSelected ? { borderColor: type.color } : undefined}
                  >
                    <Ionicons
                      name={type.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={isSelected ? type.color : Colors.gray[400]}
                    />
                    <Text
                      className={`ml-1.5 text-sm font-medium ${
                        isSelected
                          ? "text-stone-900 dark:text-stone-100"
                          : "text-stone-500 dark:text-stone-400"
                      }`}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Direction */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Direction
            </Text>
            <View className="flex-row gap-2">
              {INTERACTION_DIRECTIONS.map((dir) => {
                const isSelected = direction === dir.value;
                return (
                  <Pressable
                    key={dir.value}
                    onPress={() => setDirection(dir.value)}
                    className={`flex-1 items-center rounded-xl py-2.5 ${
                      isSelected
                        ? "bg-indigo-600"
                        : "bg-white shadow-sm active:bg-stone-50 dark:bg-stone-900 dark:active:bg-stone-800"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected
                          ? "text-white"
                          : "text-stone-600 dark:text-stone-400"
                      }`}
                    >
                      {dir.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Title */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Title (optional)
            </Text>
            <TextInput
              className="rounded-xl bg-white px-3 py-3 text-base text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
              placeholder={`e.g., ${selectedTypeConfig?.label ?? "Interaction"} about project`}
              placeholderTextColor={Colors.gray[400]}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>

          {/* Body / Notes */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Notes (optional)
            </Text>
            <TextInput
              className="min-h-[120px] rounded-xl bg-white px-3 py-3 text-base text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
              placeholder="What was discussed? Key takeaways..."
              placeholderTextColor={Colors.gray[400]}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Date/Time Picker */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Date & Time
            </Text>
            <DateTimePicker value={occurredAt} onChange={setOccurredAt} />
          </View>

          {/* Spacer for bottom button */}
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
