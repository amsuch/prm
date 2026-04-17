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
import { EventPersonCard } from "@/components/EventPersonCard";
import { AddPersonModal } from "@/components/AddPersonModal";
import { useEvent } from "@/hooks/useEvent";
import type { EventPerson } from "@/hooks/useEvent";
import {
  addPersonToEvent,
  removePersonFromEvent,
  promotePersonToContact,
  deleteEvent,
} from "@/lib/events";
import { Colors } from "@/constants/colors";
import { formatDate } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  conference: { bg: "#dbeafe", text: "#1e40af" },
  meetup: { bg: "#e0e7ff", text: "#3730a3" },
  party: { bg: "#fce7f3", text: "#9d174d" },
  workshop: { bg: "#fef3c7", text: "#92400e" },
  wedding: { bg: "#fee2e2", text: "#991b1b" },
  concert: { bg: "#ede9fe", text: "#5b21b6" },
  sports: { bg: "#dcfce7", text: "#166534" },
  dinner: { bg: "#ffedd5", text: "#9a3412" },
  travel: { bg: "#cffafe", text: "#155e75" },
  default: { bg: Colors.gray[100], text: Colors.gray[700] },
};

function getCategoryColor(category: string | null): { bg: string; text: string } {
  if (!category) return CATEGORY_COLORS.default;
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.default;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;

  const { event, people, isLoading, error, refresh } = useEvent(id);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const handleAddPerson = async (data: {
    first_name: string;
    last_name?: string;
    role?: string;
    notes?: string;
  }) => {
    if (!id || !userId) return;
    await addPersonToEvent(id, userId, data);
    await refresh();
  };

  const handlePromote = async (person: EventPerson) => {
    if (!event || !userId) return;

    Alert.alert(
      "Promote to Contact",
      `Promote ${person.first_name} to a full contact? This will create a new contact linked to "${event.name}".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Promote",
          onPress: async () => {
            try {
              setPromotingId(person.id);
              await promotePersonToContact(person, event, userId);
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

  const handleDeletePerson = async (person: EventPerson) => {
    try {
      await removePersonFromEvent(person.id);
      await refresh();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to remove person",
      );
    }
  };

  const handleDeleteEvent = () => {
    if (!id) return;
    Alert.alert(
      "Delete Event",
      `Delete "${event?.name}"? This will also remove all associated people. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(id);
              router.back();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to delete event",
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
        <Text className="mt-3 text-sm text-stone-400 dark:text-stone-500">
          Loading event...
        </Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50 px-8 dark:bg-stone-950">
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text className="mt-3 text-center text-base font-medium text-stone-700 dark:text-stone-300">
          {error ?? "Event not found"}
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

  const categoryColor = getCategoryColor(event.category);

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
              <Text className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {event.name}
              </Text>
              {event.category && (
                <View className="mt-1.5 flex-row">
                  <View
                    className="rounded-full px-2.5 py-0.5"
                    style={{ backgroundColor: categoryColor.bg }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: categoryColor.text }}
                    >
                      {event.category}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <View className="h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
              <Ionicons name="calendar" size={28} color={Colors.brand[600]} />
            </View>
          </View>

          <View className="mt-4">
            {event.event_date && (
              <View className="mb-2 flex-row items-center rounded-lg bg-stone-50 p-2.5 dark:bg-stone-800">
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={Colors.brand[600]}
                />
                <Text className="ml-2 flex-1 text-sm text-stone-700 dark:text-stone-300">
                  {formatDate(event.event_date)}
                </Text>
              </View>
            )}

            {event.location && (
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://maps.google.com/?q=${encodeURIComponent(
                      event.location!,
                    )}`,
                  )
                }
                className="mb-2 flex-row items-center rounded-lg bg-stone-50 p-2.5 active:bg-stone-100 dark:bg-stone-800 dark:active:bg-stone-700"
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={Colors.brand[600]}
                />
                <Text
                  className="ml-2 flex-1 text-sm text-stone-700 dark:text-stone-300"
                  numberOfLines={2}
                >
                  {event.location}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={Colors.gray[300]}
                />
              </Pressable>
            )}

            {event.url && (
              <Pressable
                onPress={() => {
                  const u = event.url!.startsWith("http")
                    ? event.url!
                    : `https://${event.url}`;
                  Linking.openURL(u);
                }}
                className="mb-2 flex-row items-center rounded-lg bg-stone-50 p-2.5 active:bg-stone-100 dark:bg-stone-800 dark:active:bg-stone-700"
              >
                <Ionicons name="link-outline" size={16} color="#7c3aed" />
                <Text
                  className="ml-2 flex-1 text-sm text-indigo-600 dark:text-indigo-400"
                  numberOfLines={1}
                >
                  {event.url}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={Colors.gray[300]}
                />
              </Pressable>
            )}
          </View>
        </View>

        {event.description && (
          <View className="mx-4 mt-3 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Description
            </Text>
            <Text className="text-sm leading-5 text-stone-700 dark:text-stone-300">
              {event.description}
            </Text>
          </View>
        )}

        {event.notes && (
          <View className="mx-4 mt-3 rounded-xl bg-white p-4 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Notes
            </Text>
            <Text className="text-sm leading-5 text-stone-700 dark:text-stone-300">
              {event.notes}
            </Text>
          </View>
        )}

        {/* People Section */}
        <View className="mx-4 mt-4 mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
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
              <Text className="ml-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                Add the first person
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="mx-4">
            {people.map((person) => (
              <EventPersonCard
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
          onPress={() => router.push(`/event/${id}/edit` as never)}
          className="mr-2 flex-1 flex-row items-center justify-center rounded-xl border border-stone-200 bg-white py-3 active:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:active:bg-stone-700"
        >
          <Ionicons name="create-outline" size={18} color={Colors.gray[700]} />
          <Text className="ml-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
            Edit
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDeleteEvent}
          className="ml-2 flex-row items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-3 active:bg-red-50 dark:border-red-800 dark:bg-stone-800 dark:active:bg-red-950"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </Pressable>
      </View>

      <AddPersonModal
        visible={showAddPerson}
        onClose={() => setShowAddPerson(false)}
        onSave={handleAddPerson}
      />
    </View>
  );
}
