import { View, Text, Pressable, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getInitials } from "@/lib/utils";
import { Colors } from "@/constants/colors";
import type { ContactFull } from "@/hooks/useContact";

type ContactHeaderProps = {
  contact: ContactFull;
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

export function ContactHeader({ contact }: ContactHeaderProps) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const initials = getInitials(contact.first_name, contact.last_name);
  const avatarBg = getAvatarColor(fullName);
  const subtitle = [contact.job_title, contact.company].filter(Boolean).join(" at ");

  const primaryEmail = contact.contact_emails.find((e) => e.is_primary)?.email ??
    contact.contact_emails[0]?.email;
  const primaryPhone = contact.contact_phones.find((p) => p.is_primary)?.phone ??
    contact.contact_phones[0]?.phone;

  const handleCall = () => {
    if (primaryPhone) {
      Linking.openURL(`tel:${primaryPhone}`);
    } else {
      Alert.alert("No Phone", "This contact has no phone number.");
    }
  };

  const handleEmail = () => {
    if (primaryEmail) {
      Linking.openURL(`mailto:${primaryEmail}`);
    } else {
      Alert.alert("No Email", "This contact has no email address.");
    }
  };

  const handleMessage = () => {
    if (primaryPhone) {
      Linking.openURL(`sms:${primaryPhone}`);
    } else {
      Alert.alert("No Phone", "This contact has no phone number for messaging.");
    }
  };

  return (
    <View className="items-center bg-white px-6 pb-6 pt-4">
      {/* Large Avatar */}
      <View
        className="mb-3 h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarBg }}
      >
        <Text className="text-3xl font-bold text-white">{initials}</Text>
      </View>

      {/* Name */}
      <Text className="text-xl font-bold text-stone-900">{fullName}</Text>

      {/* Subtitle */}
      {subtitle ? (
        <Text className="mt-1 text-sm text-stone-500">{subtitle}</Text>
      ) : null}

      {contact.department ? (
        <Text className="mt-0.5 text-xs text-stone-400">{contact.department}</Text>
      ) : null}

      {/* Quick Action Icons */}
      <View className="mt-4 flex-row gap-6">
        <Pressable
          onPress={handleCall}
          className="items-center rounded-xl bg-green-50 px-4 py-2 active:bg-green-100"
        >
          <Ionicons name="call" size={20} color="#16a34a" />
          <Text className="mt-1 text-xs font-medium text-green-700">Call</Text>
        </Pressable>

        <Pressable
          onPress={handleEmail}
          className="items-center rounded-xl bg-indigo-50 px-4 py-2 active:bg-indigo-100"
        >
          <Ionicons name="mail" size={20} color={Colors.brand[600]} />
          <Text className="mt-1 text-xs font-medium text-indigo-700">Email</Text>
        </Pressable>

        <Pressable
          onPress={handleMessage}
          className="items-center rounded-xl bg-purple-50 px-4 py-2 active:bg-purple-100"
        >
          <Ionicons name="chatbubble" size={20} color="#7c3aed" />
          <Text className="mt-1 text-xs font-medium text-purple-700">Message</Text>
        </Pressable>
      </View>
    </View>
  );
}
