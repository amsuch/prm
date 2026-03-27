import { Redirect, Stack } from "expo-router";
import { useSession } from "@/lib/auth/ctx";
import { ActivityIndicator, View } from "react-native";

export default function AppLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="contact/[id]"
        options={{ headerShown: true, title: "Contact" }}
      />
      <Stack.Screen
        name="contact/[id]/edit"
        options={{ headerShown: true, title: "Edit Contact", presentation: "modal" }}
      />
      <Stack.Screen
        name="contact/new"
        options={{ headerShown: true, title: "New Contact", presentation: "modal" }}
      />
      <Stack.Screen
        name="import/csv"
        options={{ headerShown: true, title: "Import CSV" }}
      />
      <Stack.Screen
        name="import/device"
        options={{ headerShown: true, title: "Device Contacts" }}
      />
      <Stack.Screen
        name="bulk-link"
        options={{ headerShown: true, title: "Bulk Link Contacts" }}
      />
      <Stack.Screen
        name="entity/[id]"
        options={{ headerShown: true, title: "Entity" }}
      />
      <Stack.Screen
        name="entity/new"
        options={{ headerShown: true, title: "New Entity", presentation: "modal" }}
      />
      <Stack.Screen
        name="entity/[id]/edit"
        options={{ headerShown: true, title: "Edit Entity", presentation: "modal" }}
      />
    </Stack>
  );
}
