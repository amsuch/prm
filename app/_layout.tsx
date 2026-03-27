import { Stack } from "expo-router";
import { SessionProvider } from "@/lib/auth/ctx";
import "@/global.css";

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(app)" />
      </Stack>
    </SessionProvider>
  );
}
