import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { createEntity } from "@/lib/entities";
import { Colors } from "@/constants/colors";
import { useEntityCategories } from "@/hooks/useEntityCategories";
import { parseGoogleMapsUrl, isGoogleMapsUrl } from "@/lib/googleMaps";
import type { EntityCategory } from "@/hooks/useEntityCategories";

export default function NewEntityScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { categories, isLoading: categoriesLoading } = useEntityCategories();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Maps link
  const [mapsLink, setMapsLink] = useState("");
  const [isParsingMap, setIsParsingMap] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  // Category picker state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  const selectedCategory = categories.find((c) => c.name === category);

  const handleImportMaps = async () => {
    if (!mapsLink.trim()) return;

    setIsParsingMap(true);
    setMapsError(null);

    try {
      const result = await parseGoogleMapsUrl(mapsLink.trim());
      if (!result) {
        setMapsError("Could not parse this Google Maps link");
        return;
      }

      if (result.name && !name) setName(result.name);
      if (result.address && !address) setAddress(result.address);
      setMapsLink("");
    } catch {
      setMapsError("Failed to parse Google Maps link");
    } finally {
      setIsParsingMap(false);
    }
  };

  const handleSelectCategory = (cat: EntityCategory) => {
    setCategory(cat.name);
    setShowCategoryPicker(false);
    setCustomCategory("");
  };

  const handleCustomCategory = () => {
    if (customCategory.trim()) {
      setCategory(customCategory.trim());
      setShowCategoryPicker(false);
      setCustomCategory("");
    }
  };

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
    <View className="flex-1 bg-stone-50 dark:bg-stone-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Google Maps Import */}
        <View className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
          <View className="flex-row items-center mb-2">
            <Ionicons name="map-outline" size={16} color={Colors.brand[600]} />
            <Text className="ml-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
              Paste Google Maps Link
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TextInput
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="https://maps.google.com/..."
              placeholderTextColor={Colors.gray[400]}
              value={mapsLink}
              onChangeText={(text) => {
                setMapsLink(text);
                setMapsError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleImportMaps}
              disabled={isParsingMap || !mapsLink.trim() || !isGoogleMapsUrl(mapsLink)}
              className={`rounded-xl px-4 py-2.5 ${
                isParsingMap || !mapsLink.trim() || !isGoogleMapsUrl(mapsLink)
                  ? "bg-stone-200 dark:bg-stone-700"
                  : "bg-indigo-600 active:bg-indigo-700"
              }`}
            >
              {isParsingMap ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text
                  className={`text-sm font-medium ${
                    !mapsLink.trim() || !isGoogleMapsUrl(mapsLink)
                      ? "text-stone-400 dark:text-stone-500"
                      : "text-white"
                  }`}
                >
                  Import
                </Text>
              )}
            </Pressable>
          </View>
          {mapsError && (
            <Text className="mt-1.5 text-xs text-red-500 dark:text-red-400">{mapsError}</Text>
          )}
        </View>

        <View className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
          {error && (
            <View className="mb-3 rounded-lg bg-red-50 p-3 dark:bg-red-950">
              <Text className="text-sm text-red-700 dark:text-red-400">{error}</Text>
            </View>
          )}

          {/* Name */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Name *</Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="e.g. Joe's Diner, Planet Fitness"
              placeholderTextColor={Colors.gray[400]}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* Category Picker */}
          <View className="mb-3" style={{ zIndex: 10 }}>
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Category</Text>

            {/* Selected category display / trigger */}
            <Pressable
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              className="flex-row items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
            >
              {category ? (
                <View className="flex-row items-center">
                  {selectedCategory && (
                    <Ionicons
                      name={selectedCategory.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={selectedCategory.color}
                    />
                  )}
                  <Text className={`text-base text-stone-900 dark:text-stone-100 ${selectedCategory ? "ml-2" : ""}`}>
                    {category}
                  </Text>
                </View>
              ) : (
                <Text className="text-base" style={{ color: Colors.gray[400] }}>
                  Select a category
                </Text>
              )}
              <Ionicons
                name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={Colors.gray[400]}
              />
            </Pressable>

            {/* Category dropdown */}
            {showCategoryPicker && (
              <View className="absolute left-0 right-0 top-16 z-20 rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-800">
                <ScrollView
                  style={{ maxHeight: 240 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {/* Clear selection */}
                  {category !== "" && (
                    <Pressable
                      onPress={() => {
                        setCategory("");
                        setShowCategoryPicker(false);
                      }}
                      className="border-b border-stone-100 px-4 py-2.5 active:bg-stone-50 dark:border-stone-700 dark:active:bg-stone-700"
                    >
                      <Text className="text-sm text-stone-400 italic dark:text-stone-500">None</Text>
                    </Pressable>
                  )}

                  {/* Category options */}
                  {categoriesLoading ? (
                    <View className="items-center py-4">
                      <ActivityIndicator size="small" color={Colors.brand[600]} />
                    </View>
                  ) : (
                    categories.map((cat) => (
                      <Pressable
                        key={cat.id}
                        onPress={() => handleSelectCategory(cat)}
                        className={`flex-row items-center border-b border-stone-50 px-4 py-2.5 active:bg-stone-50 dark:border-stone-700 dark:active:bg-stone-700 ${
                          category === cat.name ? "bg-indigo-50 dark:bg-indigo-950" : ""
                        }`}
                      >
                        <Ionicons
                          name={cat.icon as keyof typeof Ionicons.glyphMap}
                          size={16}
                          color={cat.color}
                        />
                        <Text
                          className={`ml-2.5 text-sm font-medium ${
                            category === cat.name ? "text-indigo-700 dark:text-indigo-400" : "text-stone-700 dark:text-stone-300"
                          }`}
                        >
                          {cat.name}
                        </Text>
                        <View
                          className="ml-auto h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      </Pressable>
                    ))
                  )}

                  {/* Custom category input */}
                  <View className="border-t border-stone-200 px-4 py-2.5 dark:border-stone-700">
                    <Text className="mb-1 text-xs text-stone-400 dark:text-stone-500">Or type custom:</Text>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                        placeholder="Custom category"
                        placeholderTextColor={Colors.gray[400]}
                        value={customCategory}
                        onChangeText={setCustomCategory}
                      />
                      <Pressable
                        onPress={handleCustomCategory}
                        disabled={!customCategory.trim()}
                        className={`rounded-lg px-3 py-2 ${
                          !customCategory.trim()
                            ? "bg-stone-200 dark:bg-stone-700"
                            : "bg-indigo-600 active:bg-indigo-700"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            !customCategory.trim() ? "text-stone-400 dark:text-stone-500" : "text-white"
                          }`}
                        >
                          Use
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>
              </View>
            )}
          </View>

          {/* Address */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Address</Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="Street address"
              placeholderTextColor={Colors.gray[400]}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* Phone */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Phone</Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="Phone number"
              placeholderTextColor={Colors.gray[400]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Website */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Website</Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Notes</Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
            className="flex-row items-center justify-center rounded-xl bg-indigo-600 py-3.5 active:bg-indigo-700"
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
