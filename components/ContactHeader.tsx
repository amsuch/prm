import { useState, useCallback } from "react";
import { View, Text, Pressable, Linking, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { fetchLinkedInPhoto, isLinkedInUrl } from "@/lib/linkedin";
import { Avatar } from "@/components/Avatar";
import type { ContactFull } from "@/hooks/useContact";

type ContactHeaderProps = {
  contact: ContactFull;
  onPhotoUpdated?: () => void;
};

export function ContactHeader({ contact, onPhotoUpdated }: ContactHeaderProps) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const subtitle = [contact.job_title, contact.company].filter(Boolean).join(" at ");

  const primaryEmail = contact.contact_emails.find((e) => e.is_primary)?.email ??
    contact.contact_emails[0]?.email;
  const primaryPhone = contact.contact_phones.find((p) => p.is_primary)?.phone ??
    contact.contact_phones[0]?.phone;

  // Find LinkedIn URL from contact_urls
  const linkedInUrl = contact.contact_urls?.find((u) => isLinkedInUrl(u.url))?.url;
  const hasLinkedIn = !!linkedInUrl;
  const hasAvatar = !!contact.avatar_url;

  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);

  const handleFetchLinkedInPhoto = useCallback(async () => {
    if (!linkedInUrl) return;

    setIsFetchingPhoto(true);
    try {
      const photoUrl = await fetchLinkedInPhoto(linkedInUrl);
      if (!photoUrl) {
        Alert.alert(
          "No Photo Found",
          "Could not extract a photo from this LinkedIn profile. This may be due to privacy settings or network restrictions.",
        );
        return;
      }

      // Save to contact record
      const { error } = await supabase
        .from("contacts")
        .update({ avatar_url: photoUrl } as never)
        .eq("id", contact.id);

      if (error) throw error;

      onPhotoUpdated?.();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to fetch LinkedIn photo",
      );
    } finally {
      setIsFetchingPhoto(false);
    }
  }, [linkedInUrl, contact.id, onPhotoUpdated]);

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
      <View className="mb-3">
        <Avatar
          firstName={contact.first_name}
          lastName={contact.last_name}
          imageUrl={contact.avatar_url}
          size="xl"
        />
      </View>

      {/* Fetch LinkedIn Photo button */}
      {hasLinkedIn && !hasAvatar && (
        <Pressable
          onPress={handleFetchLinkedInPhoto}
          disabled={isFetchingPhoto}
          className="mb-2 flex-row items-center rounded-lg bg-indigo-50 px-3 py-1.5 active:bg-indigo-100"
        >
          {isFetchingPhoto ? (
            <>
              <ActivityIndicator size="small" color={Colors.brand[600]} />
              <Text className="ml-1.5 text-xs font-medium text-indigo-600">
                Fetching...
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="camera-outline" size={14} color={Colors.brand[600]} />
              <Text className="ml-1 text-xs font-medium text-indigo-600">
                Fetch Photo
              </Text>
            </>
          )}
        </Pressable>
      )}

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
