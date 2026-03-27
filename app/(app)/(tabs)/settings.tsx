import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { supabase } from "@/lib/supabase";
import { getInitials } from "@/lib/utils";
import { CustomFieldManager } from "@/components/CustomFieldManager";
import { useTags } from "@/hooks/useTags";

const TAG_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#4f46e5",
  "#be185d",
  "#15803d",
  "#b45309",
];

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="mb-2 mt-6 px-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {title}
    </Text>
  );
}

function ProfileCard() {
  const { session } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(
    session?.user?.user_metadata?.full_name ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const email = session?.user?.email ?? "";
  const displayName =
    session?.user?.user_metadata?.full_name || email.split("@")[0] || "User";
  const initials = getInitials(
    displayName.split(" ")[0],
    displayName.split(" ")[1],
  );

  const handleSave = useCallback(async () => {
    if (!session?.user?.id) return;
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null } as never)
        .eq("id", session.user.id);

      if (updateError) throw updateError;

      // Also update user metadata so the session reflects the change
      await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      setIsEditing(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [session?.user?.id, fullName]);

  return (
    <View className="mx-5 overflow-hidden rounded-xl bg-white shadow-sm">
      <View className="items-center px-4 py-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <Text className="text-xl font-bold text-blue-700">{initials}</Text>
        </View>

        {isEditing ? (
          <View className="mt-3 w-full">
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm text-gray-900"
              placeholderTextColor="#9ca3af"
              autoFocus
            />
            <View className="mt-3 flex-row justify-center gap-3">
              <Pressable
                onPress={() => {
                  setIsEditing(false);
                  setFullName(
                    session?.user?.user_metadata?.full_name ?? "",
                  );
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 active:bg-gray-50"
              >
                <Text className="text-sm font-medium text-gray-600">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className={`rounded-lg px-4 py-2 ${
                  isSaving ? "bg-blue-300" : "bg-blue-600 active:bg-blue-700"
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
          <>
            <Text className="mt-3 text-lg font-semibold text-gray-900">
              {displayName}
            </Text>
            <Text className="mt-0.5 text-sm text-gray-500">{email}</Text>
            <Pressable
              onPress={() => setIsEditing(true)}
              className="mt-3 rounded-lg border border-gray-200 px-4 py-1.5 active:bg-gray-50"
            >
              <Text className="text-sm font-medium text-blue-600">
                Edit Name
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function TagManager() {
  const { session } = useSession();
  const { tags, refetch } = useTags();
  const [isAdding, setIsAdding] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  const userId = session?.user?.id;

  const handleAddTag = useCallback(async () => {
    if (!userId || !newTagName.trim()) return;
    setIsSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("tags")
        .insert({ user_id: userId, name: newTagName.trim(), color: selectedColor } as never);

      if (insertError) throw insertError;

      setNewTagName("");
      setSelectedColor(TAG_COLORS[0]);
      setIsAdding(false);
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create tag";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [userId, newTagName, selectedColor, refetch]);

  const handleDeleteTag = useCallback(
    (tagId: string, tagName: string) => {
      const doDelete = async () => {
        try {
          // Delete contact_tags associations first
          await supabase.from("contact_tags").delete().eq("tag_id", tagId);

          const { error: deleteError } = await supabase
            .from("tags")
            .delete()
            .eq("id", tagId);

          if (deleteError) throw deleteError;
          await refetch();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to delete tag";
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
            `Delete tag "${tagName}"? It will be removed from all contacts.`,
          )
        ) {
          doDelete();
        }
      } else {
        Alert.alert(
          "Delete Tag",
          `Delete tag "${tagName}"? It will be removed from all contacts.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: doDelete },
          ],
        );
      }
    },
    [refetch],
  );

  return (
    <View>
      {tags.length === 0 && !isAdding && (
        <View className="items-center py-6">
          <Ionicons name="pricetag-outline" size={28} color="#d1d5db" />
          <Text className="mt-1 text-sm text-gray-400">No tags created</Text>
        </View>
      )}

      {tags.map((tag, index) => (
        <View key={tag.id}>
          {index > 0 && <View className="ml-4 h-px bg-gray-100" />}
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center">
              <View
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: tag.color ?? "#6b7280" }}
              />
              <Text className="ml-2.5 text-sm font-medium text-gray-900">
                {tag.name}
              </Text>
            </View>
            <Pressable
              onPress={() => handleDeleteTag(tag.id, tag.name)}
              className="rounded-lg p-2 active:bg-red-50"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      ))}

      {isAdding ? (
        <View className="border-t border-gray-100 px-4 py-3">
          <TextInput
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="Tag name"
            className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"
            placeholderTextColor="#9ca3af"
            autoFocus
          />

          {/* Color picker */}
          <Text className="mb-1.5 text-xs font-medium text-gray-500">Color</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {TAG_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setSelectedColor(color)}
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  selectedColor === color ? "border-2 border-gray-400" : ""
                }`}
                style={{ backgroundColor: color }}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={14} color="white" />
                )}
              </Pressable>
            ))}
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setIsAdding(false);
                setNewTagName("");
                setSelectedColor(TAG_COLORS[0]);
              }}
              className="flex-1 items-center rounded-lg border border-gray-200 py-2.5 active:bg-gray-50"
            >
              <Text className="text-sm font-medium text-gray-600">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddTag}
              disabled={isSaving || !newTagName.trim()}
              className={`flex-1 items-center rounded-lg py-2.5 ${
                isSaving || !newTagName.trim()
                  ? "bg-blue-300"
                  : "bg-blue-600 active:bg-blue-700"
              }`}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-sm font-medium text-white">Add</Text>
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
              Add Tag
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    const doSignOut = async () => {
      setIsSigningOut(true);
      try {
        await signOut();
      } catch {
        setIsSigningOut(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) {
        doSignOut();
      }
    } else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: doSignOut },
      ]);
    }
  }, [signOut]);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Profile */}
      <SectionHeader title="Profile" />
      <ProfileCard />

      {/* Custom Fields */}
      <SectionHeader title="Custom Fields" />
      <View className="mx-5 overflow-hidden rounded-xl bg-white shadow-sm">
        <CustomFieldManager />
      </View>

      {/* Tags */}
      <SectionHeader title="Tags" />
      <View className="mx-5 overflow-hidden rounded-xl bg-white shadow-sm">
        <TagManager />
      </View>

      {/* About */}
      <SectionHeader title="About" />
      <View className="mx-5 overflow-hidden rounded-xl bg-white shadow-sm">
        <View className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-500">Version</Text>
            <Text className="text-sm font-medium text-gray-900">1.0.0</Text>
          </View>
          <View className="mt-3 h-px bg-gray-100" />
          <View className="mt-3 flex-row items-center">
            <Ionicons name="heart-outline" size={14} color="#6b7280" />
            <Text className="ml-1.5 text-sm text-gray-500">
              Built with Expo + Supabase
            </Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <View className="mx-5 mt-6 mb-12">
        <Pressable
          onPress={handleSignOut}
          disabled={isSigningOut}
          className={`items-center rounded-xl py-3.5 ${
            isSigningOut ? "bg-red-300" : "bg-red-500 active:bg-red-600"
          }`}
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="log-out-outline" size={18} color="white" />
              <Text className="ml-2 text-sm font-semibold text-white">
                Sign Out
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
