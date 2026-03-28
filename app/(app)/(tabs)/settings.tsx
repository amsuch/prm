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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { getInitials, formatDate } from "@/lib/utils";
import { CustomFieldManager } from "@/components/CustomFieldManager";
import { RelationshipTypeManager } from "@/components/RelationshipTypeManager";
import { useTags } from "@/hooks/useTags";
import { useUserEmails } from "@/hooks/useUserEmails";
import { useCalendarSync } from "@/hooks/useCalendarSync";

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
    <Text className="mb-2 mt-6 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
    <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
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
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-base text-gray-900"
              placeholderTextColor={Colors.gray[400]}
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
          <Ionicons name="pricetag-outline" size={28} color={Colors.gray[300]} />
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
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
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
            className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
            placeholderTextColor={Colors.gray[400]}
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
            <Ionicons name="add" size={18} color={Colors.brand[600]} />
            <Text className="ml-1 text-sm font-medium text-blue-600">
              Add Tag
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function UserEmailManager() {
  const { emails, addEmail, removeEmail, isLoading } = useUserEmails();
  const [isAdding, setIsAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState<"work" | "personal">("work");
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!newEmail.trim()) return;
    setIsSaving(true);
    try {
      await addEmail(newEmail.trim().toLowerCase(), newLabel);
      setNewEmail("");
      setNewLabel("work");
      setIsAdding(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add email";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [newEmail, newLabel, addEmail]);

  const handleRemove = useCallback(
    (id: string, email: string) => {
      const doRemove = async () => {
        try {
          await removeEmail(id);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to remove email";
          if (Platform.OS === "web") {
            window.alert(message);
          } else {
            Alert.alert("Error", message);
          }
        }
      };

      if (Platform.OS === "web") {
        if (window.confirm(`Remove "${email}"?`)) {
          doRemove();
        }
      } else {
        Alert.alert("Remove Email", `Remove "${email}"?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doRemove },
        ]);
      }
    },
    [removeEmail],
  );

  return (
    <View>
      <View className="px-4 pt-3 pb-1">
        <Text className="text-xs text-gray-500">
          Your emails are filtered out when matching calendar attendees.
        </Text>
      </View>

      {isLoading && emails.length === 0 && (
        <View className="items-center py-6">
          <ActivityIndicator size="small" color={Colors.brand[600]} />
        </View>
      )}

      {!isLoading && emails.length === 0 && !isAdding && (
        <View className="items-center py-6">
          <Ionicons name="mail-outline" size={28} color={Colors.gray[300]} />
          <Text className="mt-1 text-sm text-gray-400">No emails added</Text>
        </View>
      )}

      {emails.map((item, index) => (
        <View key={item.id}>
          {index > 0 && <View className="ml-4 h-px bg-gray-100" />}
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-1 flex-row items-center">
              <Ionicons name="mail-outline" size={16} color={Colors.gray[500]} />
              <Text className="ml-2 flex-1 text-sm font-medium text-gray-900" numberOfLines={1}>
                {item.email}
              </Text>
              <View
                className={`ml-2 rounded-full px-2 py-0.5 ${
                  item.label === "work" ? "bg-blue-100" : "bg-purple-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    item.label === "work" ? "text-blue-700" : "text-purple-700"
                  }`}
                >
                  {item.label}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => handleRemove(item.id, item.email)}
              className="ml-2 rounded-lg p-2 active:bg-red-50"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </Pressable>
          </View>
        </View>
      ))}

      {isAdding ? (
        <View className="border-t border-gray-100 px-4 py-3">
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="email@example.com"
            className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
            placeholderTextColor={Colors.gray[400]}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text className="mb-1.5 text-xs font-medium text-gray-500">Label</Text>
          <View className="mb-3 flex-row gap-2">
            <Pressable
              onPress={() => setNewLabel("work")}
              className={`flex-1 items-center rounded-lg border py-2 ${
                newLabel === "work"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white active:bg-gray-50"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  newLabel === "work" ? "text-blue-700" : "text-gray-600"
                }`}
              >
                Work
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setNewLabel("personal")}
              className={`flex-1 items-center rounded-lg border py-2 ${
                newLabel === "personal"
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200 bg-white active:bg-gray-50"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  newLabel === "personal" ? "text-purple-700" : "text-gray-600"
                }`}
              >
                Personal
              </Text>
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setIsAdding(false);
                setNewEmail("");
                setNewLabel("work");
              }}
              className="flex-1 items-center rounded-lg border border-gray-200 py-2.5 active:bg-gray-50"
            >
              <Text className="text-sm font-medium text-gray-600">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              disabled={isSaving || !newEmail.trim()}
              className={`flex-1 items-center rounded-lg py-2.5 ${
                isSaving || !newEmail.trim()
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
            <Ionicons name="add" size={18} color={Colors.brand[600]} />
            <Text className="ml-1 text-sm font-medium text-blue-600">
              Add Email
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function CalendarManager() {
  const { session } = useSession();
  const {
    isConnected,
    lastSyncAt,
    isSyncing,
    syncResult,
    syncError,
    pendingSuggestionsCount,
    sync,
    disconnect,
  } = useCalendarSync();

  const handleConnect = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/calendar.events.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          redirectTo: Platform.OS === "web" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      // Token capture happens in SessionProvider's onAuthStateChange
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect calendar";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    const doDisconnect = async () => {
      try {
        await disconnect();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to disconnect calendar";
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Error", message);
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Disconnect Google Calendar?")) {
        doDisconnect();
      }
    } else {
      Alert.alert(
        "Disconnect Calendar",
        "Disconnect Google Calendar? Existing interactions will be kept.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Disconnect", style: "destructive", onPress: doDisconnect },
        ],
      );
    }
  }, [disconnect]);

  if (!isConnected) {
    return (
      <View className="px-4 py-4">
        <Text className="mb-3 text-xs text-gray-500">
          Connect your Google Calendar to auto-create interactions from meeting
          events.
        </Text>
        <Pressable
          onPress={handleConnect}
          className="flex-row items-center justify-center rounded-lg bg-blue-600 py-3 active:bg-blue-700"
        >
          <Ionicons name="logo-google" size={18} color="white" />
          <Text className="ml-2 text-sm font-semibold text-white">
            Connect Google Calendar
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="px-4 py-4">
      {/* Connection status */}
      <View className="mb-3 flex-row items-center">
        <View className="rounded-full bg-green-100 px-2.5 py-1">
          <Text className="text-xs font-semibold text-green-700">Connected</Text>
        </View>
        {lastSyncAt && (
          <Text className="ml-2 text-xs text-gray-400">
            Last sync: {formatDate(lastSyncAt)}
          </Text>
        )}
      </View>

      {/* Sync Now button */}
      <Pressable
        onPress={sync}
        disabled={isSyncing}
        className={`mb-3 flex-row items-center justify-center rounded-lg py-3 ${
          isSyncing ? "bg-blue-300" : "bg-blue-600 active:bg-blue-700"
        }`}
      >
        {isSyncing ? (
          <>
            <ActivityIndicator size="small" color="white" />
            <Text className="ml-2 text-sm font-semibold text-white">
              Syncing...
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="sync-outline" size={18} color="white" />
            <Text className="ml-2 text-sm font-semibold text-white">
              Sync Now
            </Text>
          </>
        )}
      </Pressable>

      {/* Sync result */}
      {syncResult && (
        <View className="mb-3 rounded-lg bg-green-50 px-3 py-2.5">
          <Text className="text-xs font-medium text-green-800">
            Sync complete: {syncResult.eventsProcessed} events processed,{" "}
            {syncResult.interactionsCreated} interactions created,{" "}
            {syncResult.suggestionsCreated} suggestions added
          </Text>
        </View>
      )}

      {/* Sync error */}
      {syncError && (
        <View className="mb-3 rounded-lg bg-red-50 px-3 py-2.5">
          <Text className="text-xs font-medium text-red-800">{syncError}</Text>
        </View>
      )}

      {/* Pending suggestions */}
      {pendingSuggestionsCount > 0 && (
        <Pressable
          onPress={() => router.push("/(app)/calendar-suggestions" as never)}
          className="mb-3 flex-row items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5 active:bg-amber-100"
        >
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={16} color="#b45309" />
            <Text className="ml-2 text-xs font-medium text-amber-800">
              {pendingSuggestionsCount} pending suggestion
              {pendingSuggestionsCount !== 1 ? "s" : ""} to review
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#b45309" />
        </Pressable>
      )}

      {/* Disconnect */}
      <Pressable
        onPress={handleDisconnect}
        className="flex-row items-center justify-center rounded-lg border border-gray-200 py-2.5 active:bg-gray-50"
      >
        <Ionicons name="unlink-outline" size={16} color={Colors.gray[500]} />
        <Text className="ml-1.5 text-sm font-medium text-gray-500">
          Disconnect
        </Text>
      </Pressable>
    </View>
  );
}

type AIProvider = "openai" | "anthropic";

const AI_MODELS: Record<AIProvider, { id: string; label: string; tier: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-6", label: "Opus 4.6", tier: "Most capable" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", tier: "Fast + smart" },
    { id: "claude-opus-4-5-20250220", label: "Opus 4.5", tier: "Coding + agents" },
    { id: "claude-sonnet-4-5-20250514", label: "Sonnet 4.5", tier: "Balanced" },
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", tier: "Fastest" },
  ],
  openai: [
    { id: "gpt-5.4", label: "GPT-5.4", tier: "Most capable" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", tier: "Fast + smart" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", tier: "Fastest + cheapest" },
    { id: "gpt-4.1", label: "GPT-4.1", tier: "Reliable" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", tier: "Budget" },
  ],
};

const DEFAULT_SYSTEM_PROMPT = `You are a personal relationship manager assistant. You have access to the user's contact database including names, companies, job titles, emails, phones, tags, interaction history, and relationships between contacts.

Answer questions about the user's network concisely and helpfully. When listing contacts, include their name, company, and relevant details. When asked about interactions, include dates and context.

If you don't have enough information to answer, say so clearly. Never make up contacts or interactions that don't exist in the data provided.`;

function AIKeyManager() {
  const { session } = useSession();
  const [provider, setProvider] = useState<AIProvider>(
    (session?.user?.user_metadata?.ai_provider as AIProvider) || "anthropic",
  );
  const [model, setModel] = useState<string>(
    (session?.user?.user_metadata?.ai_model as string) || AI_MODELS.anthropic[0].id,
  );
  const [apiKey, setApiKey] = useState(
    (session?.user?.user_metadata?.ai_api_key as string) || "",
  );
  const [systemPrompt, setSystemPrompt] = useState(
    (session?.user?.user_metadata?.ai_system_prompt as string) || DEFAULT_SYSTEM_PROMPT,
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(!!session?.user?.user_metadata?.ai_api_key);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          ai_provider: provider,
          ai_model: model,
          ai_api_key: apiKey.trim(),
          ai_system_prompt: systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
        },
      });
      if (error) throw error;
      setSaved(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save API key";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [provider, model, apiKey, systemPrompt]);

  const handleClear = useCallback(async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { ai_provider: null, ai_model: null, ai_api_key: null, ai_system_prompt: null },
      });
      if (error) throw error;
      setApiKey("");
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setModel(AI_MODELS.anthropic[0].id);
      setProvider("anthropic");
      setSaved(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to clear API key";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSaving(false);
    }
  }, []);

  const maskedKey = apiKey
    ? apiKey.slice(0, 7) + "\u2022".repeat(20) + apiKey.slice(-4)
    : "";

  return (
    <View className="px-4 py-4">
      <Text className="mb-3 text-xs text-gray-500">
        Add an API key to enable AI-powered answers in the Ask tab.
      </Text>

      {/* Provider toggle */}
      <View className="mb-3 flex-row overflow-hidden rounded-xl border border-gray-200">
        <Pressable
          onPress={() => { setProvider("anthropic"); setModel(AI_MODELS.anthropic[0].id); setSaved(false); }}
          className={`flex-1 items-center py-2.5 ${
            provider === "anthropic" ? "bg-blue-600" : "bg-white active:bg-gray-50"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              provider === "anthropic" ? "text-white" : "text-gray-600"
            }`}
          >
            Claude
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { setProvider("openai"); setModel(AI_MODELS.openai[0].id); setSaved(false); }}
          className={`flex-1 items-center py-2.5 ${
            provider === "openai" ? "bg-blue-600" : "bg-white active:bg-gray-50"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              provider === "openai" ? "text-white" : "text-gray-600"
            }`}
          >
            GPT
          </Text>
        </Pressable>
      </View>

      {/* Model picker */}
      <Text className="mb-1.5 text-xs font-medium text-gray-500">Model</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {AI_MODELS[provider].map((m) => (
          <Pressable
            key={m.id}
            onPress={() => { setModel(m.id); setSaved(false); }}
            className={`rounded-lg border px-3 py-2 ${
              model === m.id
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 bg-white active:bg-gray-50"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                model === m.id ? "text-blue-700" : "text-gray-700"
              }`}
            >
              {m.label}
            </Text>
            <Text
              className={`text-xs ${
                model === m.id ? "text-blue-500" : "text-gray-400"
              }`}
            >
              {m.tier}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* API Key input */}
      <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-gray-50">
        <TextInput
          value={showKey ? apiKey : (apiKey ? maskedKey : "")}
          onChangeText={(t) => { setApiKey(t); setSaved(false); }}
          placeholder={
            provider === "anthropic"
              ? "sk-ant-api03-..."
              : "sk-..."
          }
          placeholderTextColor={Colors.gray[400]}
          className="flex-1 px-3 py-2.5 text-sm text-gray-900"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showKey && !!apiKey}
        />
        {apiKey.length > 0 && (
          <Pressable
            onPress={() => setShowKey(!showKey)}
            className="px-3 py-2.5"
          >
            <Ionicons
              name={showKey ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={Colors.gray[500]}
            />
          </Pressable>
        )}
      </View>

      {/* System Prompt */}
      <Pressable
        onPress={() => setShowPrompt(!showPrompt)}
        className="mb-2 flex-row items-center justify-between"
      >
        <Text className="text-xs font-medium text-gray-500">System Prompt</Text>
        <View className="flex-row items-center">
          {systemPrompt !== DEFAULT_SYSTEM_PROMPT && (
            <Text className="mr-2 text-xs text-blue-500">Customized</Text>
          )}
          <Ionicons
            name={showPrompt ? "chevron-up" : "chevron-down"}
            size={14}
            color={Colors.gray[400]}
          />
        </View>
      </Pressable>
      {showPrompt && (
        <View className="mb-3">
          <TextInput
            value={systemPrompt}
            onChangeText={(t) => { setSystemPrompt(t); setSaved(false); }}
            placeholder="Instructions for the AI assistant..."
            placeholderTextColor={Colors.gray[400]}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            className="mb-2 min-h-[120px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
          />
          {systemPrompt !== DEFAULT_SYSTEM_PROMPT && (
            <Pressable
              onPress={() => { setSystemPrompt(DEFAULT_SYSTEM_PROMPT); setSaved(false); }}
              className="self-start"
            >
              <Text className="text-xs text-blue-600">Reset to default</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Actions */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={handleSave}
          disabled={isSaving || !apiKey.trim() || saved}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            isSaving || !apiKey.trim() || saved
              ? "bg-gray-200"
              : "bg-blue-600 active:bg-blue-700"
          }`}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text
              className={`text-sm font-medium ${
                !apiKey.trim() || saved ? "text-gray-400" : "text-white"
              }`}
            >
              {saved ? "Saved" : "Save Key"}
            </Text>
          )}
        </Pressable>
        {apiKey.length > 0 && (
          <Pressable
            onPress={handleClear}
            disabled={isSaving}
            className="items-center rounded-lg border border-gray-200 px-4 py-2.5 active:bg-gray-50"
          >
            <Text className="text-sm font-medium text-gray-500">Clear</Text>
          </Pressable>
        )}
      </View>

      {saved && (
        <View className="mt-2 flex-row items-center">
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text className="ml-1 text-xs text-green-600">
            Saved — using {AI_MODELS[provider].find((m) => m.id === model)?.label ?? model}
          </Text>
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
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="pb-24">
      {/* Profile */}
      <SectionHeader title="Profile" />
      <ProfileCard />

      {/* Custom Fields */}
      <SectionHeader title="Custom Fields" />
      <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <CustomFieldManager />
      </View>

      {/* Tags */}
      <SectionHeader title="Tags" />
      <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <TagManager />
      </View>

      {/* Relationship Types */}
      <SectionHeader title="Relationship Types" />
      <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <RelationshipTypeManager />
      </View>

      {/* My Emails */}
      <SectionHeader title="My Emails" />
      <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <UserEmailManager />
      </View>

      {/* Google Calendar */}
      <SectionHeader title="Google Calendar" />
      <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <CalendarManager />
      </View>

      {/* AI API Keys */}
      <SectionHeader title="AI Provider" />
      <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <AIKeyManager />
      </View>

      {/* About */}
      <SectionHeader title="About" />
      <View className="mx-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <View className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-500">Version</Text>
            <Text className="text-sm font-medium text-gray-900">1.0.0</Text>
          </View>
          <View className="mt-3 h-px bg-gray-100" />
          <View className="mt-3 flex-row items-center">
            <Ionicons name="heart-outline" size={14} color={Colors.gray[500]} />
            <Text className="ml-1.5 text-sm text-gray-500">
              Built with Expo + Supabase
            </Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <View className="mx-4 mt-6 mb-12">
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
