import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { SessionProvider } from "@/lib/auth/ctx";
import "@/global.css";

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <SessionProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(app)" />
      </Stack>
    </SessionProvider>
  );
}
