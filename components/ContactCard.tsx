import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime } from "@/lib/utils";
import { Colors } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { Avatar } from "@/components/Avatar";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import type { ContactWithDetails } from "@/hooks/useContacts";

type ContactCardProps = {
  contact: ContactWithDetails;
};

export function ContactCard({ contact }: ContactCardProps) {
  const router = useRouter();
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const subtitle = [contact.job_title, contact.company].filter(Boolean).join(" at ");
  const tags =
    contact.contact_tags?.map((ct) => ct.tags).filter(Boolean) ?? [];

  return (
    <AnimatedPressable
      scaleDown={0.98}
      onPress={() => router.push(`/contact/${contact.id}`)}
      className="mx-4 mb-2 flex-row items-center rounded-xl bg-white dark:bg-stone-900 dark:border dark:border-stone-800 p-3 shadow-sm active:bg-stone-50 dark:active:bg-stone-800"
      style={Shadows.sm}
    >
      {/* Avatar */}
      <Avatar
        firstName={contact.first_name}
        lastName={contact.last_name}
        imageUrl={contact.avatar_url}
        size="lg"
      />

      {/* Info */}
      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold text-stone-900 dark:text-stone-100" numberOfLines={1}>
          {fullName}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-stone-500 dark:text-stone-400" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {tags.length > 0 && (
          <View className="mt-1 flex-row flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <View
                key={tag.id}
                className="rounded-full bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5"
              >
                <Text className="text-xs font-medium text-indigo-700">
                  {tag.name}
                </Text>
              </View>
            ))}
            {tags.length > 3 && (
              <View className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5">
                <Text className="text-xs text-stone-500 dark:text-stone-400">
                  +{tags.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Right side: last contacted */}
      <View className="items-end ml-2">
        <Text className="text-xs text-stone-400 dark:text-stone-500">
          {formatRelativeTime(contact.last_contacted_at)}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.gray[300]}
          style={{ marginTop: 4 }}
        />
      </View>
    </AnimatedPressable>
  );
}
