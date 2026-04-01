import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { Avatar } from "@/components/Avatar";
import type { AgentResultContact } from "@/lib/agent";

export function ContactCards({ contacts }: { contacts: AgentResultContact[] }) {
  const router = useRouter();

  if (contacts.length === 0) return null;

  return (
    <View className="mt-3">
      {contacts.map((contact) => {
        const fullName = [contact.first_name, contact.last_name]
          .filter(Boolean)
          .join(" ");
        const subtitle = [contact.job_title, contact.company]
          .filter(Boolean)
          .join(" at ");

        return (
          <Pressable
            key={contact.id}
            onPress={() => router.push(`/contact/${contact.id}`)}
            className="mt-2 flex-row items-center rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 active:bg-stone-100 dark:active:bg-stone-700"
          >
            <Avatar
              firstName={contact.first_name}
              lastName={contact.last_name}
              imageUrl={contact.avatar_url}
              size="sm"
            />
            <View className="ml-2.5 flex-1">
              <Text
                className="text-sm font-semibold text-stone-900 dark:text-stone-100"
                numberOfLines={1}
              >
                {fullName}
              </Text>
              {subtitle ? (
                <Text
                  className="text-xs text-stone-500 dark:text-stone-400"
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
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
