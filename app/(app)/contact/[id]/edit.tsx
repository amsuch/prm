import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ContactForm } from "@/components/ContactForm";
import { useContact } from "@/hooks/useContact";
import { Colors } from "@/constants/colors";

export default function EditContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { contact, isLoading, error } = useContact(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50">
        <ActivityIndicator size="large" color={Colors.brand[600]} />
        <Text className="mt-3 text-sm text-stone-400">Loading contact...</Text>
      </View>
    );
  }

  if (error || !contact) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50 px-8">
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text className="mt-3 text-center text-base font-medium text-stone-700">
          {error ?? "Contact not found"}
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

  return <ContactForm existingContact={contact} mode="edit" />;
}
