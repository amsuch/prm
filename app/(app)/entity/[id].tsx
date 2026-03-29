import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { EntityPersonCard } from "@/components/EntityPersonCard";
import { AddPersonModal } from "@/components/AddPersonModal";
import { useEntity } from "@/hooks/useEntity";
import type { EntityPerson } from "@/hooks/useEntity";
import {
  addPersonToEntity,
  removePersonFromEntity,
  promotePersonToContact,
  deleteEntity,
} from "@/lib/entities";
import { Colors } from "@/constants/colors";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  restaurant: { bg: "#fef3c7", text: "#92400e" },
  company: { bg: "#dbeafe", text: "#1e40af" },
  gym: { bg: "#dcfce7", text: "#166534" },
  club: { bg: "#f3e8ff", text: "#6b21a8" },
  school: { bg: "#fce7f3", text: "#9d174d" },
  church: { bg: "#e0e7ff", text: "#3730a3" },
  store: { bg: "#ffedd5", text: "#9a3412" },
  default: { bg: "#f3f4f6", text: "#374151" },
};

function getCategoryColor(category: string | null): { bg: string; text: string } {
  if (!category) return CATEGORY_COLORS.default;
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.default;
}

export default function EntityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;

  const { entity, people, isLoading, error, refresh } = useEntity(id);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const handleAddPerson = async (data: {
    first_name: string;
    last_name?: string;
    role?: string;
    notes?: string;
  }) => {
    if (!id || !userId) return;
    await addPersonToEntity(id, userId, data);
    await refresh();
  };

  const handlePromote = async (person: EntityPerson) => {
    if (!entity || !userId) return;

    Alert.alert(
      "Promote to Contact",
      `Promote ${person.first_name} to a full contact? This will create a new contact with their name and role.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Promote",
          onPress: async () => {
            try {
              setPromotingId(person.id);
              await promotePersonToContact(person, entity, userId);
              await refresh();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to promote person",
              );
            } finally {
              setPromotingId(null);
            }
          },
        },
      ],
    );
  };

  const handleDeletePerson = async (person: EntityPerson) => {
    try {
      await removePersonFromEntity(person.id);
      await refresh();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to remove person",
      );
    }
  };

  const handleDeleteEntity = () => {
    if (!id) return;
    Alert.alert(
      "Delete Entity",
      `Delete "${entity?.name}"? This will also remove all associated people. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEntity(id);
              router.back();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to delete entity",
              );
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50 dark:bg-stone-950">
        <ActivityIndicator size="large" color={Colors.brand[600]} />
        <Text className="mt-3 text-sm text-stone-400 dark:text-stone-500">Loading entity...</Text>
      </View>
    );
  }

  if (error || !entity) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50 px-8 dark:bg-stone-950">
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text className="mt-3 text-center text-base font-medium text-stone-700 dark:text-stone-300">
          {error ?? "Entity not found"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 active:bg-indigo-700"
        >
          <Text className="text-sm font-medium text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const categoryColor = getCategoryColor(entity.category);

  return (
    <View className="flex-1 bg-stone-50 dark:bg-stone-950">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
      >
        {/* Header Card */}
        <View className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-xl font-bold text-stone-900 dark:text-stone-100">
                {entity.name}
              </Text>
              {entity.category && (
                <View className="mt-1.5 flex-row">
                  <View
                    className="rounded-full px-2.5 py-0.5"
                    style={{ backgroundColor: categoryColor.bg }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: categoryColor.text }}
                    >
                      {entity.category}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <View className="h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
              <Ionicons name="business" size={28} color={Colors.brand[600]} />
            </View>
          </View>

          {/* Contact details */}
          <View className="mt-4">
            {entity.address && (
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://maps.google.com/?q=${encodeURIComponent(entity.address!)}`,
                  )
                }
                className="mb-2 flex-row items-center rounded-lg bg-stone-50 p-2.5 active:bg-stone-100 dark:bg-stone-800 dark:active:bg-stone-700"
              >
                <Ionicons name="location-outline" size={16} color={Colors.brand[600]} />
                <Text className="ml-2 flex-1 text-sm text-stone-700 dark:text-stone-300" numberOfLines={2}>
                  {entity.address}
                </Text>
                <Ionicons name="open-outline" size={14} color={Colors.gray[300]} />
              </Pressable>
            )}

            {entity.phone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${entity.phone}`)}
                className="mb-2 flex-row items-center rounded-lg bg-stone-50 p-2.5 active:bg-stone-100 dark:bg-stone-800 dark:active:bg-stone-700"
              >
                <Ionicons name="call-outline" size={16} color="#16a34a" />
                <Text className="ml-2 flex-1 text-sm text-stone-700 dark:text-stone-300">
                  {entity.phone}
                </Text>
                <Ionicons name="open-outline" size={14} color={Colors.gray[300]} />
              </Pressable>
            )}

            {entity.website && (
              <Pressable
                onPress={() => {
                  const url = entity.website!.startsWith("http")
                    ? entity.website!
                    : `https://${entity.website}`;
                  Linking.openURL(url);
                }}
                className="mb-2 flex-row items-center rounded-lg bg-stone-50 p-2.5 active:bg-stone-100 dark:bg-stone-800 dark:active:bg-stone-700"
              >
                <Ionicons name="globe-outline" size={16} color="#7c3aed" />
                <Text
                  className="ml-2 flex-1 text-sm text-indigo-600 dark:text-indigo-400"
                  numberOfLines={1}
                >
                  {entity.website}
                </Text>
                <Ionicons name="open-outline" size={14} color={Colors.gray[300]} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Notes */}
        {entity.notes && (
          <View className="mx-4 mt-3 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
            <Text className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Notes
            </Text>
            <Text className="text-sm leading-5 text-stone-700 dark:text-stone-300">
              {entity.notes}
            </Text>
          </View>
        )}

        {/* People Section */}
        <View className="mx-4 mt-4 mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            People ({people.length})
          </Text>
          <Pressable
            onPress={() => setShowAddPerson(true)}
            className="flex-row items-center rounded-full bg-indigo-600 px-3 py-1.5 active:bg-indigo-700"
          >
            <Ionicons name="add" size={14} color="white" />
            <Text className="ml-1 text-xs font-medium text-white">
              Add Person
            </Text>
          </Pressable>
        </View>

        {people.length === 0 ? (
          <View className="mx-4 items-center rounded-xl bg-white p-6 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
            <Ionicons name="person-outline" size={32} color={Colors.gray[300]} />
            <Text className="mt-2 text-sm text-stone-400 dark:text-stone-500">
              No people added yet
            </Text>
            <Pressable
              onPress={() => setShowAddPerson(true)}
              className="mt-3 flex-row items-center rounded-lg bg-indigo-50 px-4 py-2 active:bg-indigo-100 dark:bg-indigo-950"
            >
              <Ionicons name="add" size={16} color={Colors.brand[600]} />
              <Text className="ml-1 text-sm font-medium text-indigo-700">
                Add the first person
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="mx-4">
            {people.map((person) => (
              <EntityPersonCard
                key={person.id}
                person={person}
                onPromote={handlePromote}
                onDelete={handleDeletePerson}
                isPromoting={promotingId === person.id}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 flex-row border-t border-stone-100 bg-white px-4 pb-8 pt-3 dark:border-stone-800 dark:bg-stone-900">
        <Pressable
          onPress={() => router.push(`/entity/${id}/edit` as never)}
          className="mr-2 flex-1 flex-row items-center justify-center rounded-xl border border-stone-200 bg-white py-3 active:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:active:bg-stone-700"
        >
          <Ionicons name="create-outline" size={18} color={Colors.gray[700]} />
          <Text className="ml-2 text-sm font-semibold text-stone-700 dark:text-stone-300">Edit</Text>
        </Pressable>
        <Pressable
          onPress={handleDeleteEntity}
          className="ml-2 flex-row items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-3 active:bg-red-50 dark:border-red-800 dark:bg-stone-800 dark:active:bg-red-950"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </Pressable>
      </View>

      {/* Add Person Modal */}
      <AddPersonModal
        visible={showAddPerson}
        onClose={() => setShowAddPerson(false)}
        onSave={handleAddPerson}
      />
    </View>
  );
}
