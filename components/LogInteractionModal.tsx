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
import { useSession } from "@/lib/auth/ctx";
import {
  logInteraction,
  INTERACTION_TYPES,
  INTERACTION_DIRECTIONS,
  type InteractionType,
  type InteractionDirection,
} from "@/lib/interactions";

type LogInteractionModalProps = {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void;
  contactId: string;
  contactName: string;
};

export function LogInteractionModal({
  visible,
  onClose,
  onLogged,
  contactId,
  contactName,
}: LogInteractionModalProps) {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [selectedType, setSelectedType] = useState<InteractionType>("call");
  const [direction, setDirection] = useState<InteractionDirection>("outbound");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedType("call");
      setDirection("outbound");
      setTitle("");
      setBody("");
    }
  }, [visible]);

  const handleSave = useCallback(async () => {
    if (!userId) return;

    setIsSaving(true);
    try {
      await logInteraction({
        userId,
        contactId,
        type: selectedType,
        direction,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      onLogged();
      onClose();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to log interaction",
      );
    } finally {
      setIsSaving(false);
    }
  }, [userId, contactId, selectedType, direction, title, body, onLogged, onClose]);

  const selectedTypeConfig = INTERACTION_TYPES.find((t) => t.value === selectedType);

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
          <Text className="text-lg font-semibold text-stone-900">Log Interaction</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Contact Name */}
          <View className="mx-4 mt-4 flex-row items-center rounded-xl bg-white px-3 py-2.5 shadow-sm">
            <Ionicons name="person" size={16} color={Colors.brand[600]} />
            <Text className="ml-2 text-sm font-medium text-stone-700">
              with {contactName}
            </Text>
          </View>

          {/* Type Selection */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700">Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {INTERACTION_TYPES.map((type) => {
                const isSelected = selectedType === type.value;
                return (
                  <Pressable
                    key={type.value}
                    onPress={() => setSelectedType(type.value)}
                    className={`flex-row items-center rounded-xl px-3 py-2 ${
                      isSelected
                        ? "border-2 bg-white shadow-sm"
                        : "border-2 border-transparent bg-white active:bg-stone-50"
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
                        isSelected ? "text-stone-900" : "text-stone-500"
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
            <Text className="mb-2 text-sm font-semibold text-stone-700">Direction</Text>
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
                        : "bg-white shadow-sm active:bg-stone-50"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? "text-white" : "text-stone-600"
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
            <Text className="mb-2 text-sm font-semibold text-stone-700">
              Title (optional)
            </Text>
            <TextInput
              className="rounded-xl bg-white px-3 py-3 text-base text-stone-900 shadow-sm"
              placeholder={`e.g., ${selectedTypeConfig?.label ?? "Interaction"} about project`}
              placeholderTextColor={Colors.gray[400]}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>

          {/* Body / Notes */}
          <View className="mx-4 mt-5">
            <Text className="mb-2 text-sm font-semibold text-stone-700">
              Notes (optional)
            </Text>
            <TextInput
              className="min-h-[120px] rounded-xl bg-white px-3 py-3 text-base text-stone-900 shadow-sm"
              placeholder="What was discussed? Key takeaways..."
              placeholderTextColor={Colors.gray[400]}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Date display */}
          <View className="mx-4 mt-5 flex-row items-center rounded-xl bg-white px-3 py-3 shadow-sm">
            <Ionicons name="calendar-outline" size={18} color={Colors.gray[500]} />
            <Text className="ml-2 text-sm text-stone-600">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
            <Text className="ml-auto text-xs text-stone-400">Now</Text>
          </View>

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </ScrollView>

        {/* Save Button */}
        <View className="border-t border-stone-200 bg-white px-4 pb-8 pt-3">
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className={`items-center rounded-xl py-3.5 ${
              isSaving ? "bg-stone-200" : "bg-indigo-600 active:bg-indigo-700"
            }`}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons
                  name={selectedTypeConfig?.icon as keyof typeof Ionicons.glyphMap ?? "add"}
                  size={18}
                  color="#ffffff"
                />
                <Text className="ml-2 text-base font-semibold text-white">
                  Log {selectedTypeConfig?.label ?? "Interaction"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
