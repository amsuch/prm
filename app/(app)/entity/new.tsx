import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { supabase } from "@/lib/supabase";
import { createEntity } from "@/lib/entities";
import { Colors } from "@/constants/colors";

export default function NewEntityScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category autocomplete
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("entities")
      .select("category")
      .eq("user_id", userId)
      .not("category", "is", null)
      .then(({ data }) => {
        type CategoryRow = { category: string | null };
        const rows = (data ?? []) as unknown as CategoryRow[];
        const unique = [...new Set(rows.map((r) => r.category).filter(Boolean) as string[])];
        unique.sort();
        setAllCategories(unique);
      });
  }, [userId]);

  const filteredCategories = useMemo(() => {
    if (!category.trim()) return allCategories;
    const query = category.toLowerCase();
    return allCategories.filter(
      (c) => c.toLowerCase().includes(query) && c.toLowerCase() !== query,
    );
  }, [category, allCategories]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!userId) return;

    setIsSaving(true);
    setError(null);

    try {
      const entity = await createEntity(userId, {
        name: name.trim(),
        category: category.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        notes: notes.trim() || null,
      });
      router.replace(`/entity/${entity.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entity");
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm">
          {error && (
            <View className="mb-3 rounded-lg bg-red-50 p-3">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          {/* Name */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-gray-700">Name *</Text>
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
              placeholder="e.g. Joe's Diner, Planet Fitness"
              placeholderTextColor={Colors.gray[400]}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* Category with autocomplete */}
          <View className="mb-3" style={{ zIndex: 10 }}>
            <Text className="mb-1 text-sm font-medium text-gray-700">Category</Text>
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
              placeholder="e.g. Restaurant, Gym, Company"
              placeholderTextColor={Colors.gray[400]}
              value={category}
              onChangeText={(text) => {
                setCategory(text);
                setShowCategorySuggestions(true);
              }}
              onFocus={() => setShowCategorySuggestions(true)}
              onBlur={() => {
                // Delay to allow press event on suggestions
                setTimeout(() => setShowCategorySuggestions(false), 200);
              }}
            />
            {showCategorySuggestions && filteredCategories.length > 0 && (
              <View className="absolute left-0 right-0 top-16 z-20 max-h-32 rounded-lg border border-gray-200 bg-white shadow-lg">
                <FlatList
                  data={filteredCategories}
                  keyExtractor={(item) => item}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        setCategory(item);
                        setShowCategorySuggestions(false);
                      }}
                      className="border-b border-gray-50 px-4 py-2 active:bg-gray-50"
                    >
                      <Text className="text-sm text-gray-700">{item}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
          </View>

          {/* Address */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-gray-700">Address</Text>
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
              placeholder="Street address"
              placeholderTextColor={Colors.gray[400]}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* Phone */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-gray-700">Phone</Text>
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
              placeholder="Phone number"
              placeholderTextColor={Colors.gray[400]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Website */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-gray-700">Website</Text>
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
              placeholder="https://example.com"
              placeholderTextColor={Colors.gray[400]}
              value={website}
              onChangeText={setWebsite}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          {/* Notes */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-gray-700">Notes</Text>
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
              placeholder="Optional notes about this place"
              placeholderTextColor={Colors.gray[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>
        </View>

        {/* Save Button */}
        <View className="mx-4 mt-4">
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className="flex-row items-center justify-center rounded-xl bg-blue-600 py-3.5 active:bg-blue-700"
            style={{ opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="add-circle" size={18} color="white" />
                <Text className="ml-2 text-base font-semibold text-white">
                  Create Entity
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
