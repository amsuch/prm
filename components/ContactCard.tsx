import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { Colors } from "@/constants/colors";
import type { ContactWithDetails } from "@/hooks/useContacts";

type ContactCardProps = {
  contact: ContactWithDetails;
};

const AVATAR_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#4f46e5",
  "#c026d3",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ContactCard({ contact }: ContactCardProps) {
  const router = useRouter();
  const initials = getInitials(contact.first_name, contact.last_name);
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const subtitle = [contact.job_title, contact.company].filter(Boolean).join(" at ");
  const avatarBg = getAvatarColor(fullName);
  const tags =
    contact.contact_tags?.map((ct) => ct.tags).filter(Boolean) ?? [];

  return (
    <Pressable
      onPress={() => router.push(`/contact/${contact.id}`)}
      className="mx-4 mb-2 flex-row items-center rounded-xl bg-white p-3 shadow-sm active:bg-gray-50"
    >
      {/* Avatar */}
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarBg }}
      >
        <Text className="text-lg font-bold text-white">{initials}</Text>
      </View>

      {/* Info */}
      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {fullName}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {tags.length > 0 && (
          <View className="mt-1 flex-row flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <View
                key={tag.id}
                className="rounded-full bg-blue-50 px-2 py-0.5"
              >
                <Text className="text-xs font-medium text-blue-700">
                  {tag.name}
                </Text>
              </View>
            ))}
            {tags.length > 3 && (
              <View className="rounded-full bg-gray-100 px-2 py-0.5">
                <Text className="text-xs text-gray-500">
                  +{tags.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Right side: last contacted */}
      <View className="items-end ml-2">
        <Text className="text-xs text-gray-400">
          {formatRelativeTime(contact.last_contacted_at)}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.gray[300]}
          style={{ marginTop: 4 }}
        />
      </View>
    </Pressable>
  );
}
