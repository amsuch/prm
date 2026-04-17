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
import { createEvent } from "@/lib/events";
import { Colors } from "@/constants/colors";
import { useEventCategories } from "@/hooks/useEventCategories";
import type { EventCategory } from "@/hooks/useEventCategories";
import { extractEventFromInput } from "@/lib/eventExtract";
import { getLLMConfigFromSession } from "@/lib/llm";

export default function NewEventScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { categories, isLoading: categoriesLoading } = useEventCategories();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI extract
  const [extractInput, setExtractInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Category picker state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  const selectedCategory = categories.find((c) => c.name === category);

  const handleExtract = async () => {
    if (!extractInput.trim()) return;

    const llmConfig = getLLMConfigFromSession(session);
    if (!llmConfig) {
      setExtractError(
        "Configure your AI provider in Settings to extract automatically.",
      );
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      const extracted = await extractEventFromInput(
        extractInput.trim(),
        llmConfig,
      );

      if (extracted.name && !name) setName(extracted.name);
      if (extracted.category && !category) setCategory(extracted.category);
      if (extracted.event_date && !eventDate) setEventDate(extracted.event_date);
      if (extracted.location && !location) setLocation(extracted.location);
      if (extracted.url && !url) setUrl(extracted.url);
      if (extracted.description && !description)
        setDescription(extracted.description);

      setExtractInput("");
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Failed to extract event",
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSelectCategory = (cat: EventCategory) => {
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
      const event = await createEvent(userId, {
        name: name.trim(),
        category: category.trim() || null,
        event_date: eventDate.trim() || null,
        location: location.trim() || null,
        url: url.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
      });
      router.replace(`/event/${event.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
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
        {/* AI Extract */}
        <View className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
          <View className="flex-row items-center mb-2">
            <Ionicons name="sparkles-outline" size={16} color={Colors.brand[600]} />
            <Text className="ml-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
              Paste a link or describe the event
            </Text>
          </View>
          <TextInput
            className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            placeholder="https://lu.ma/... or 'NYC React meetup at Google last Tuesday'"
            placeholderTextColor={Colors.gray[400]}
            value={extractInput}
            onChangeText={(text) => {
              setExtractInput(text);
              setExtractError(null);
            }}
            multiline
            style={{ minHeight: 60, textAlignVertical: "top" }}
            autoCapitalize="none"
          />
          <Pressable
            onPress={handleExtract}
            disabled={isExtracting || !extractInput.trim()}
            className={`mt-2 flex-row items-center justify-center rounded-xl py-2.5 ${
              isExtracting || !extractInput.trim()
                ? "bg-stone-200 dark:bg-stone-700"
                : "bg-indigo-600 active:bg-indigo-700"
            }`}
          >
            {isExtracting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons
                  name="sparkles"
                  size={14}
                  color={!extractInput.trim() ? Colors.gray[400] : "white"}
                />
                <Text
                  className={`ml-1.5 text-sm font-medium ${
                    !extractInput.trim()
                      ? "text-stone-400 dark:text-stone-500"
                      : "text-white"
                  }`}
                >
                  Extract with AI
                </Text>
              </>
            )}
          </Pressable>
          {extractError && (
            <Text className="mt-1.5 text-xs text-red-500 dark:text-red-400">
              {extractError}
            </Text>
          )}
        </View>

        <View className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
          {error && (
            <View className="mb-3 rounded-lg bg-red-50 p-3 dark:bg-red-950">
              <Text className="text-sm text-red-700 dark:text-red-400">
                {error}
              </Text>
            </View>
          )}

          {/* Name */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Name *
            </Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="e.g. React NYC Meetup, Jane's Wedding"
              placeholderTextColor={Colors.gray[400]}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* Category Picker */}
          <View className="mb-3" style={{ zIndex: 10 }}>
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Category
            </Text>

            <Pressable
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              className="flex-row items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
            >
              {category ? (
                <View className="flex-row items-center">
                  {selectedCategory && (
                    <Ionicons
                      name={
                        selectedCategory.icon as keyof typeof Ionicons.glyphMap
                      }
                      size={16}
                      color={selectedCategory.color}
                    />
                  )}
                  <Text
                    className={`text-base text-stone-900 dark:text-stone-100 ${
                      selectedCategory ? "ml-2" : ""
                    }`}
                  >
                    {category}
                  </Text>
                </View>
              ) : (
                <Text
                  className="text-base"
                  style={{ color: Colors.gray[400] }}
                >
                  Select a category
                </Text>
              )}
              <Ionicons
                name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={Colors.gray[400]}
              />
            </Pressable>

            {showCategoryPicker && (
              <View className="absolute left-0 right-0 top-16 z-20 rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-800">
                <ScrollView
                  style={{ maxHeight: 240 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {category !== "" && (
                    <Pressable
                      onPress={() => {
                        setCategory("");
                        setShowCategoryPicker(false);
                      }}
                      className="border-b border-stone-100 px-4 py-2.5 active:bg-stone-50 dark:border-stone-700 dark:active:bg-stone-700"
                    >
                      <Text className="text-sm text-stone-400 italic dark:text-stone-500">
                        None
                      </Text>
                    </Pressable>
                  )}

                  {categoriesLoading ? (
                    <View className="items-center py-4">
                      <ActivityIndicator
                        size="small"
                        color={Colors.brand[600]}
                      />
                    </View>
                  ) : (
                    categories.map((cat) => (
                      <Pressable
                        key={cat.id}
                        onPress={() => handleSelectCategory(cat)}
                        className={`flex-row items-center border-b border-stone-50 px-4 py-2.5 active:bg-stone-50 dark:border-stone-700 dark:active:bg-stone-700 ${
                          category === cat.name
                            ? "bg-indigo-50 dark:bg-indigo-950"
                            : ""
                        }`}
                      >
                        <Ionicons
                          name={cat.icon as keyof typeof Ionicons.glyphMap}
                          size={16}
                          color={cat.color}
                        />
                        <Text
                          className={`ml-2.5 text-sm font-medium ${
                            category === cat.name
                              ? "text-indigo-700 dark:text-indigo-400"
                              : "text-stone-700 dark:text-stone-300"
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

                  <View className="border-t border-stone-200 px-4 py-2.5 dark:border-stone-700">
                    <Text className="mb-1 text-xs text-stone-400 dark:text-stone-500">
                      Or type custom:
                    </Text>
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
                            !customCategory.trim()
                              ? "text-stone-400 dark:text-stone-500"
                              : "text-white"
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

          {/* Date */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Date
            </Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.gray[400]}
              value={eventDate}
              onChangeText={setEventDate}
              autoCapitalize="none"
            />
          </View>

          {/* Location */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Location
            </Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="Venue, city, or address"
              placeholderTextColor={Colors.gray[400]}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          {/* URL */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Link
            </Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="https://..."
              placeholderTextColor={Colors.gray[400]}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Description */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Description
            </Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="Short summary of the event"
              placeholderTextColor={Colors.gray[400]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>

          {/* Notes */}
          <View className="mb-3">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Notes
            </Text>
            <TextInput
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              placeholder="Private notes about who you met or what happened"
              placeholderTextColor={Colors.gray[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>
        </View>

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
                  Create Event
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
