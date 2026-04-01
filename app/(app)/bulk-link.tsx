import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { supabase } from "@/lib/supabase";
import { useRelationshipTypes } from "@/hooks/useRelationshipTypes";
import { Colors } from "@/constants/colors";
import { Avatar } from "@/components/Avatar";

type Contact = {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  avatar_url: string | null;
};

type LinkMode = "all_to_all" | "anchor";

const CATEGORY_COLORS: Record<string, string> = {
  family: "#e11d48",
  professional: "#2563eb",
  social: "#16a34a",
  other: Colors.gray[500],
};

export default function BulkLinkScreen() {
  const { session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id;
  const { types } = useRelationshipTypes();

  const [step, setStep] = useState<"select" | "configure" | "review" | "done">("select");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>("all_to_all");
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [result, setResult] = useState({ created: 0, skipped: 0 });

  // Load contacts on mount
  const loadContacts = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, company, job_title, avatar_url")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("first_name")
      .limit(500);

    if (!error && data) {
      setContacts(data as unknown as Contact[]);
    }
    setIsLoading(false);
  }, [userId]);

  // Load on first render
  useState(() => {
    loadContacts();
  });

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!searchText.trim()) return contacts;
    const q = searchText.toLowerCase();
    return contacts.filter(
      (c) =>
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q),
    );
  }, [contacts, searchText]);

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id)),
    [contacts, selectedIds],
  );

  const selectedType = useMemo(
    () => types.find((t) => t.id === selectedTypeId),
    [types, selectedTypeId],
  );

  // Calculate how many links will be created
  const linkCount = useMemo(() => {
    const n = selectedIds.size;
    if (linkMode === "all_to_all") {
      return (n * (n - 1)) / 2;
    }
    return anchorId ? n - 1 : 0;
  }, [selectedIds.size, linkMode, anchorId]);

  const toggleContact = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
  }, [filteredContacts]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleExecuteLink = useCallback(async () => {
    if (!selectedTypeId || selectedIds.size < 2) return;

    setIsLinking(true);
    let created = 0;
    let skipped = 0;

    try {
      const ids = Array.from(selectedIds);

      if (linkMode === "all_to_all") {
        // Link every pair
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const { error } = await supabase
              .from("contact_relationships")
              .insert({
                contact_a_id: ids[i],
                contact_b_id: ids[j],
                relationship_type_id: selectedTypeId,
              } as never);

            if (error) {
              if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
                skipped++;
              } else {
                throw error;
              }
            } else {
              created++;
            }
          }
        }
      } else if (anchorId) {
        // Link all to anchor
        for (const id of ids) {
          if (id === anchorId) continue;
          const { error } = await supabase
            .from("contact_relationships")
            .insert({
              contact_a_id: anchorId,
              contact_b_id: id,
              relationship_type_id: selectedTypeId,
            } as never);

          if (error) {
            if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
              skipped++;
            } else {
              throw error;
            }
          } else {
            created++;
          }
        }
      }

      setResult({ created, skipped });
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create relationships";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsLinking(false);
    }
  }, [selectedIds, selectedTypeId, linkMode, anchorId]);

  // Group types by category
  const groupedTypes = useMemo(() => {
    const groups: Record<string, typeof types> = {};
    for (const t of types) {
      const cat = t.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [types]);

  // ============================================================
  // Step 1: Select contacts
  // ============================================================
  if (step === "select") {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        {/* Search */}
        <View className="border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <View className="flex-row items-center rounded-xl border border-stone-200 bg-stone-50 px-3 dark:border-stone-700 dark:bg-stone-800">
            <Ionicons name="search" size={18} color={Colors.gray[400]} />
            <TextInput
              className="ml-2 flex-1 py-2.5 text-sm text-stone-900 dark:text-stone-100"
              placeholder="Search contacts..."
              placeholderTextColor="#a8a29e"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color={Colors.gray[400]} />
              </Pressable>
            )}
          </View>

          {/* Select All / Deselect */}
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-stone-500 dark:text-stone-400">
              {selectedIds.size} of {filteredContacts.length} selected
            </Text>
            <View className="flex-row gap-2">
              <Pressable onPress={handleSelectAll}>
                <Text className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Select All</Text>
              </Pressable>
              <Text className="text-xs text-stone-300 dark:text-stone-600">|</Text>
              <Pressable onPress={handleDeselectAll}>
                <Text className="text-xs font-medium text-stone-500 dark:text-stone-400">Clear</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.brand[600]} />
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => {
              const fullName = [item.first_name, item.last_name].filter(Boolean).join(" ");
              const isSelected = selectedIds.has(item.id);

              return (
                <Pressable
                  onPress={() => toggleContact(item.id)}
                  className={`flex-row items-center border-b border-stone-100 px-4 py-3 dark:border-stone-800 ${
                    isSelected ? "bg-indigo-50 dark:bg-indigo-950" : "bg-white active:bg-stone-50 dark:bg-stone-900 dark:active:bg-stone-800"
                  }`}
                >
                  <View
                    className={`mr-3 h-5 w-5 items-center justify-center rounded border ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-600"
                        : "border-stone-300 bg-white dark:border-stone-600 dark:bg-stone-800"
                    }`}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                  </View>
                  <Avatar
                    firstName={item.first_name}
                    lastName={item.last_name}
                    imageUrl={item.avatar_url}
                    size="sm"
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-medium text-stone-900 dark:text-stone-100">{fullName}</Text>
                    {item.company && (
                      <Text className="text-xs text-stone-500 dark:text-stone-400">{item.company}</Text>
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* Bottom bar */}
        <View className="absolute bottom-0 left-0 right-0 border-t border-stone-200 bg-white px-4 pb-6 pt-3 dark:border-stone-800 dark:bg-stone-900">
          <Pressable
            onPress={() => setStep("configure")}
            disabled={selectedIds.size < 2}
            className={`items-center rounded-xl py-3.5 ${
              selectedIds.size >= 2
                ? "bg-indigo-600 active:bg-indigo-700"
                : "bg-stone-200 dark:bg-stone-700"
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                selectedIds.size >= 2 ? "text-white" : "text-stone-400 dark:text-stone-500"
              }`}
            >
              {selectedIds.size >= 2
                ? `Continue with ${selectedIds.size} contacts`
                : "Select at least 2 contacts"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ============================================================
  // Step 2: Configure relationship
  // ============================================================
  if (step === "configure") {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        <FlatList
          data={[1]} // Single item to make it scrollable
          keyExtractor={() => "config"}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={() => (
            <View className="px-4 pt-4">
              {/* Selected contacts summary */}
              <View className="mb-6 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
                <Text className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
                  {selectedIds.size} contacts selected
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {selectedContacts.slice(0, 10).map((c) => {
                    const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
                    return (
                      <View key={c.id} className="rounded-full bg-indigo-50 px-2.5 py-1 dark:bg-indigo-950">
                        <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-400">{name}</Text>
                      </View>
                    );
                  })}
                  {selectedContacts.length > 10 && (
                    <View className="rounded-full bg-stone-100 px-2.5 py-1 dark:bg-stone-800">
                      <Text className="text-xs text-stone-500 dark:text-stone-400">
                        +{selectedContacts.length - 10} more
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Link mode */}
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Link Mode
              </Text>
              <View className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
                <Pressable
                  onPress={() => { setLinkMode("all_to_all"); setAnchorId(null); }}
                  className={`flex-row items-center border-b border-stone-100 px-4 py-3.5 dark:border-stone-800 ${
                    linkMode === "all_to_all" ? "bg-indigo-50 dark:bg-indigo-950" : "active:bg-stone-50 dark:active:bg-stone-800"
                  }`}
                >
                  <Ionicons
                    name={linkMode === "all_to_all" ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={linkMode === "all_to_all" ? Colors.brand[600] : Colors.gray[400]}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      Everyone to everyone
                    </Text>
                    <Text className="text-xs text-stone-500 dark:text-stone-400">
                      All {selectedIds.size} contacts linked to each other ({(selectedIds.size * (selectedIds.size - 1)) / 2} relationships)
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setLinkMode("anchor")}
                  className={`flex-row items-center px-4 py-3.5 ${
                    linkMode === "anchor" ? "bg-indigo-50 dark:bg-indigo-950" : "active:bg-stone-50 dark:active:bg-stone-800"
                  }`}
                >
                  <Ionicons
                    name={linkMode === "anchor" ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={linkMode === "anchor" ? Colors.brand[600] : Colors.gray[400]}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      All linked to one contact
                    </Text>
                    <Text className="text-xs text-stone-500 dark:text-stone-400">
                      Pick an anchor contact — everyone else links to them ({selectedIds.size - 1} relationships)
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Anchor contact picker */}
              {linkMode === "anchor" && (
                <>
                  <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    Anchor Contact
                  </Text>
                  <View className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
                    {selectedContacts.map((c) => {
                      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
                      const isAnchor = anchorId === c.id;

                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setAnchorId(c.id)}
                          className={`flex-row items-center border-b border-stone-100 px-4 py-2.5 dark:border-stone-800 ${
                            isAnchor ? "bg-indigo-50 dark:bg-indigo-950" : "active:bg-stone-50 dark:active:bg-stone-800"
                          }`}
                        >
                          <Ionicons
                            name={isAnchor ? "radio-button-on" : "radio-button-off"}
                            size={18}
                            color={isAnchor ? Colors.brand[600] : Colors.gray[400]}
                          />
                          <View className="ml-2">
                            <Avatar
                              firstName={c.first_name}
                              lastName={c.last_name}
                              imageUrl={c.avatar_url}
                              size="xs"
                            />
                          </View>
                          <Text className="ml-2 text-sm text-stone-900 dark:text-stone-100">{name}</Text>
                          {isAnchor && (
                            <View className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 dark:bg-indigo-900/50">
                              <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Anchor</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Relationship type picker */}
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Relationship Type
              </Text>
              <View className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
                {Object.entries(groupedTypes).map(([category, catTypes]) => (
                  <View key={category}>
                    <View className="bg-stone-50 px-4 py-1.5 dark:bg-stone-800">
                      <Text
                        className="text-xs font-semibold capitalize"
                        style={{ color: CATEGORY_COLORS[category] ?? Colors.gray[500] }}
                      >
                        {category}
                      </Text>
                    </View>
                    {catTypes.map((type) => {
                      const isSelected = selectedTypeId === type.id;
                      return (
                        <Pressable
                          key={type.id}
                          onPress={() => setSelectedTypeId(type.id)}
                          className={`flex-row items-center border-b border-stone-50 px-4 py-3 dark:border-stone-800 ${
                            isSelected ? "bg-indigo-50 dark:bg-indigo-950" : "active:bg-stone-50 dark:active:bg-stone-800"
                          }`}
                        >
                          <Ionicons
                            name={isSelected ? "radio-button-on" : "radio-button-off"}
                            size={18}
                            color={isSelected ? Colors.brand[600] : Colors.gray[400]}
                          />
                          <Text className="ml-3 text-sm text-stone-900 dark:text-stone-100">{type.name}</Text>
                          {!type.is_symmetric && type.reverse_name && (
                            <Text className="ml-1 text-xs text-stone-400 dark:text-stone-500">
                              / {type.reverse_name}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          )}
        />

        {/* Bottom bar */}
        <View className="absolute bottom-0 left-0 right-0 border-t border-stone-200 bg-white px-4 pb-6 pt-3 dark:border-stone-800 dark:bg-stone-900">
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setStep("select")}
              className="flex-1 items-center rounded-xl border border-stone-200 py-3.5 active:bg-stone-50 dark:border-stone-700 dark:active:bg-stone-800"
            >
              <Text className="text-sm font-semibold text-stone-600 dark:text-stone-400">Back</Text>
            </Pressable>
            <Pressable
              onPress={() => setStep("review")}
              disabled={!selectedTypeId || (linkMode === "anchor" && !anchorId)}
              className={`flex-1 items-center rounded-xl py-3.5 ${
                selectedTypeId && (linkMode !== "anchor" || anchorId)
                  ? "bg-indigo-600 active:bg-indigo-700"
                  : "bg-stone-200 dark:bg-stone-700"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selectedTypeId && (linkMode !== "anchor" || anchorId)
                    ? "text-white"
                    : "text-stone-400 dark:text-stone-500"
                }`}
              >
                Review
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ============================================================
  // Step 3: Review and confirm
  // ============================================================
  if (step === "review") {
    const anchor = anchorId ? contacts.find((c) => c.id === anchorId) : null;
    const anchorName = anchor
      ? [anchor.first_name, anchor.last_name].filter(Boolean).join(" ")
      : "";

    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        <View className="flex-1 px-4 pt-6">
          {/* Summary card */}
          <View className="mb-6 rounded-xl bg-white p-5 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
            <View className="mb-4 flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-cyan-100">
                <Ionicons name="link" size={24} color="#0891b2" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {linkCount} relationship{linkCount === 1 ? "" : "s"}
                </Text>
                <Text className="text-sm text-stone-500 dark:text-stone-400">
                  will be created
                </Text>
              </View>
            </View>

            <View className="rounded-lg bg-stone-50 p-3 dark:bg-stone-800">
              <View className="mb-2 flex-row items-center">
                <Ionicons name="people" size={16} color={Colors.gray[500]} />
                <Text className="ml-2 text-sm text-stone-700 dark:text-stone-300">
                  {selectedIds.size} contacts
                </Text>
              </View>
              <View className="mb-2 flex-row items-center">
                <Ionicons name="heart" size={16} color={Colors.gray[500]} />
                <Text className="ml-2 text-sm text-stone-700 dark:text-stone-300">
                  Type: {selectedType?.name ?? "Unknown"}
                  {selectedType && !selectedType.is_symmetric && selectedType.reverse_name
                    ? ` / ${selectedType.reverse_name}`
                    : ""}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons
                  name={linkMode === "all_to_all" ? "git-network" : "git-branch"}
                  size={16}
                  color={Colors.gray[500]}
                />
                <Text className="ml-2 text-sm text-stone-700 dark:text-stone-300">
                  {linkMode === "all_to_all"
                    ? "Everyone linked to each other"
                    : `Everyone linked to ${anchorName}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Contact list preview */}
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Contacts
          </Text>
          <View className="overflow-hidden rounded-xl bg-white shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
            {selectedContacts.slice(0, 15).map((c) => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
              const isAnchor = linkMode === "anchor" && c.id === anchorId;

              return (
                <View key={c.id} className="flex-row items-center border-b border-stone-100 px-4 py-2.5 dark:border-stone-800">
                  <Avatar
                    firstName={c.first_name}
                    lastName={c.last_name}
                    imageUrl={c.avatar_url}
                    size="sm"
                  />
                  <Text className="ml-3 flex-1 text-sm text-stone-900 dark:text-stone-100">{name}</Text>
                  {isAnchor && (
                    <View className="rounded-full bg-indigo-100 px-2 py-0.5 dark:bg-indigo-900/50">
                      <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Anchor</Text>
                    </View>
                  )}
                </View>
              );
            })}
            {selectedContacts.length > 15 && (
              <View className="px-4 py-2.5">
                <Text className="text-xs text-stone-400 dark:text-stone-500">
                  +{selectedContacts.length - 15} more
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom bar */}
        <View className="border-t border-stone-200 bg-white px-4 pb-6 pt-3 dark:border-stone-800 dark:bg-stone-900">
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setStep("configure")}
              disabled={isLinking}
              className="flex-1 items-center rounded-xl border border-stone-200 py-3.5 active:bg-stone-50 dark:border-stone-700 dark:active:bg-stone-800"
            >
              <Text className="text-sm font-semibold text-stone-600 dark:text-stone-400">Back</Text>
            </Pressable>
            <Pressable
              onPress={handleExecuteLink}
              disabled={isLinking}
              className={`flex-1 items-center rounded-xl py-3.5 ${
                isLinking ? "bg-green-400" : "bg-green-600 active:bg-green-700"
              }`}
            >
              {isLinking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark" size={18} color="white" />
                  <Text className="ml-1 text-sm font-semibold text-white">
                    Create {linkCount} Link{linkCount === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ============================================================
  // Step 4: Done
  // ============================================================
  return (
    <View className="flex-1 items-center justify-center bg-stone-50 px-6">
      <View className="w-full max-w-sm items-center">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
        </View>
        <Text className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Relationships Created
        </Text>
        <Text className="mt-2 text-center text-sm text-stone-500 dark:text-stone-400">
          {result.created} relationship{result.created === 1 ? "" : "s"} created
          {result.skipped > 0
            ? `, ${result.skipped} already existed`
            : ""}
        </Text>

        <View className="mt-8 w-full gap-3">
          <Pressable
            onPress={() => {
              setStep("select");
              setSelectedIds(new Set());
              setSelectedTypeId(null);
              setAnchorId(null);
            }}
            className="items-center rounded-xl bg-indigo-600 py-3.5 active:bg-indigo-700"
          >
            <Text className="text-sm font-semibold text-white">
              Link More Contacts
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="items-center rounded-xl border border-stone-200 py-3.5 active:bg-stone-50 dark:border-stone-700 dark:active:bg-stone-800"
          >
            <Text className="text-sm font-semibold text-stone-600 dark:text-stone-400">Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
