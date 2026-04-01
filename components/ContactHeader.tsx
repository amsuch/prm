import { useState, useCallback } from "react";
import { View, Text, Pressable, Linking, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { isLinkedInUrl } from "@/lib/linkedin";
import { fetchContactPhoto } from "@/lib/photoSearch";
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
  const hasAvatar = !!contact.avatar_url;

  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);

  const handleFetchPhoto = useCallback(async () => {
    setIsFetchingPhoto(true);
    console.log("[PhotoSearch] Button pressed for:", fullName);
    try {
      const photoUrl = await fetchContactPhoto(
        fullName,
        contact.company,
        linkedInUrl,
      );

      if (!photoUrl) {
        console.log("[PhotoSearch] All strategies failed for:", fullName);
        Alert.alert(
          "No Photo Found",
          "Could not find a photo. Check console for details.",
        );
        return;
      }

      console.log("[PhotoSearch] Saving photo URL to contact:", photoUrl);

      // Save to contact record
      const { error } = await supabase
        .from("contacts")
        .update({ avatar_url: photoUrl } as never)
        .eq("id", contact.id);

      if (error) throw error;

      console.log("[PhotoSearch] Photo saved successfully");
      onPhotoUpdated?.();
    } catch (err) {
      console.log("[PhotoSearch] Error saving photo:", err);
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to fetch photo",
      );
    } finally {
      setIsFetchingPhoto(false);
    }
  }, [fullName, contact.company, contact.id, linkedInUrl, onPhotoUpdated]);

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
    <View className="items-center bg-white dark:bg-stone-900 px-6 pb-6 pt-4">
      {/* Large Avatar */}
      <View className="mb-3">
        <Avatar
          firstName={contact.first_name}
          lastName={contact.last_name}
          imageUrl={contact.avatar_url}
          size="xl"
        />
      </View>

      {/* Fetch / Update Photo button */}
      <Pressable
        onPress={handleFetchPhoto}
        disabled={isFetchingPhoto}
        className="mb-2 flex-row items-center rounded-lg bg-indigo-50 dark:bg-indigo-950 px-3 py-1.5 active:bg-indigo-100"
      >
        {isFetchingPhoto ? (
          <>
            <ActivityIndicator size="small" color={Colors.brand[600]} />
            <Text className="ml-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              Fetching...
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="camera-outline" size={14} color={Colors.brand[600]} />
            <Text className="ml-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {hasAvatar ? "Update Photo" : "Fetch Photo"}
            </Text>
          </>
        )}
      </Pressable>

      {/* Name */}
      <Text className="text-xl font-bold text-stone-900 dark:text-stone-100">{fullName}</Text>

      {/* Subtitle */}
      {subtitle ? (
        <Text className="mt-1 text-sm text-stone-500 dark:text-stone-400">{subtitle}</Text>
      ) : null}

      {contact.department ? (
        <Text className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{contact.department}</Text>
      ) : null}

      {/* Quick Action Icons */}
      <View className="mt-4 flex-row gap-6">
        <Pressable
          onPress={handleCall}
          className="items-center rounded-xl bg-green-50 dark:bg-green-950 px-4 py-2 active:bg-green-100"
        >
          <Ionicons name="call" size={20} color="#16a34a" />
          <Text className="mt-1 text-xs font-medium text-green-700 dark:text-green-300">Call</Text>
        </Pressable>

        <Pressable
          onPress={handleEmail}
          className="items-center rounded-xl bg-indigo-50 dark:bg-indigo-950 px-4 py-2 active:bg-indigo-100"
        >
          <Ionicons name="mail" size={20} color={Colors.brand[600]} />
          <Text className="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">Email</Text>
        </Pressable>

        <Pressable
          onPress={handleMessage}
          className="items-center rounded-xl bg-purple-50 dark:bg-purple-950 px-4 py-2 active:bg-purple-100"
        >
          <Ionicons name="chatbubble" size={20} color="#7c3aed" />
          <Text className="mt-1 text-xs font-medium text-purple-700 dark:text-purple-300">Message</Text>
        </Pressable>
      </View>
    </View>
  );
}
