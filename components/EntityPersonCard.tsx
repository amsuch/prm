import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import type { EntityPerson } from "@/hooks/useEntity";

type EntityPersonCardProps = {
  person: EntityPerson;
  onPromote: (person: EntityPerson) => void;
  onDelete: (person: EntityPerson) => void;
  isPromoting?: boolean;
};

export function EntityPersonCard({
  person,
  onPromote,
  onDelete,
  isPromoting = false,
}: EntityPersonCardProps) {
  const router = useRouter();
  const fullName = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(" ");
  const initial = person.first_name.charAt(0).toUpperCase();
  const isPromoted = !!person.promoted_contact_id;

  const handleDelete = () => {
    Alert.alert(
      "Remove Person",
      `Remove ${fullName} from this entity?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onDelete(person),
        },
      ],
    );
  };

  return (
    <View className="mb-2 flex-row items-center rounded-xl bg-white p-3 shadow-sm">
      {/* Avatar */}
      <View className="h-10 w-10 items-center justify-center rounded-full bg-stone-200">
        <Text className="text-sm font-bold text-stone-600">{initial}</Text>
      </View>

      {/* Info */}
      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-stone-900">{fullName}</Text>
        {person.role && (
          <Text className="mt-0.5 text-xs text-stone-500">{person.role}</Text>
        )}
      </View>

      {/* Actions */}
      <View className="flex-row items-center gap-2">
        {isPromoted ? (
          <Pressable
            onPress={() => router.push(`/contact/${person.promoted_contact_id}`)}
            className="flex-row items-center rounded-full bg-green-50 px-3 py-1.5 active:bg-green-100"
          >
            <Ionicons name="person" size={14} color="#16a34a" />
            <Text className="ml-1 text-xs font-medium text-green-700">
              View Contact
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => onPromote(person)}
            disabled={isPromoting}
            className="flex-row items-center rounded-full bg-indigo-50 px-3 py-1.5 active:bg-indigo-100"
            style={{ opacity: isPromoting ? 0.5 : 1 }}
          >
            <Ionicons name="arrow-up-circle" size={14} color={Colors.brand[600]} />
            <Text className="ml-1 text-xs font-medium text-indigo-700">
              {isPromoting ? "Promoting..." : "Promote"}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleDelete}
          className="rounded-full p-1.5 active:bg-red-50"
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </Pressable>
      </View>
    </View>
  );
}
