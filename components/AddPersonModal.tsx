import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

type AddPersonModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    first_name: string;
    last_name?: string;
    role?: string;
    notes?: string;
  }) => Promise<void>;
};

export function AddPersonModal({
  visible,
  onClose,
  onSave,
}: AddPersonModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setRole("");
    setNotes("");
    setError(null);
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        role: role.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end"
      >
        <Pressable
          className="flex-1"
          onPress={handleClose}
        />
        <View className="rounded-t-2xl bg-white dark:bg-stone-900 px-5 pb-8 pt-5 shadow-lg">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Add Person
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={Colors.gray[500]} />
            </Pressable>
          </View>

          {error && (
            <View className="mb-3 rounded-lg bg-red-50 dark:bg-red-950 p-3">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          {/* First Name */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              First Name *
            </Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5 text-base text-stone-900 dark:text-stone-100"
              placeholder="First name"
              placeholderTextColor={Colors.gray[400]}
              value={firstName}
              onChangeText={setFirstName}
              autoFocus
            />
          </View>

          {/* Last Name */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Last Name
            </Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5 text-base text-stone-900 dark:text-stone-100"
              placeholder="Last name"
              placeholderTextColor={Colors.gray[400]}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          {/* Role */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Role
            </Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5 text-base text-stone-900 dark:text-stone-100"
              placeholder="e.g. Waiter, Barista, Trainer"
              placeholderTextColor={Colors.gray[400]}
              value={role}
              onChangeText={setRole}
            />
          </View>

          {/* Notes */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Notes
            </Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5 text-base text-stone-900 dark:text-stone-100"
              placeholder="Optional notes"
              placeholderTextColor={Colors.gray[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: "top" }}
            />
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className="flex-row items-center justify-center rounded-xl bg-indigo-600 py-3.5 active:bg-indigo-700"
            style={{ opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="add-circle" size={18} color="white" />
                <Text className="ml-2 text-base font-semibold text-white">
                  Add Person
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
