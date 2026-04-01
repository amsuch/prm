import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { Avatar } from "@/components/Avatar";
import type { RelationshipResult } from "@/lib/agent";

export function RelationshipCards({
  relationships,
}: {
  relationships: RelationshipResult[];
}) {
  const router = useRouter();

  if (relationships.length === 0) return null;

  return (
    <View className="mt-3">
      {relationships.map((rel, index) => {
        const fullName = [rel.related_first_name, rel.related_last_name]
          .filter(Boolean)
          .join(" ");

        return (
          <Pressable
            key={`${rel.related_contact_id}-${index}`}
            onPress={() =>
              router.push(`/contact/${rel.related_contact_id}`)
            }
            className="mt-2 flex-row items-center rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 active:bg-stone-100 dark:active:bg-stone-700"
          >
            <Avatar
              firstName={rel.related_first_name}
              lastName={rel.related_last_name}
              size="sm"
            />
            <View className="ml-2.5 flex-1">
              <Text
                className="text-sm font-semibold text-stone-900 dark:text-stone-100"
                numberOfLines={1}
              >
                {fullName}
              </Text>
              <Text className="text-xs text-stone-500 dark:text-stone-400">
                {rel.relationship_name}
                {rel.related_company ? ` - ${rel.related_company}` : ""}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={Colors.gray[300]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
