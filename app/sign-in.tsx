import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

type Mode = "sign_in" | "create_account";

export default function SignIn() {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "create_account" && !trimmedName) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "create_account") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: { full_name: trimmedName },
          },
        });

        if (signUpErr) throw signUpErr;

        // Check if user was auto-confirmed or needs email verification
        if (data.session) {
          // Auto-confirmed — we're in
          router.replace("/(app)/(tabs)");
        } else if (data.user && !data.user.confirmed_at) {
          // Needs email confirmation — try to sign in anyway
          // (some Supabase configs allow immediate sign-in)
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
          if (signInErr) {
            // Can't sign in yet — show confirmation message
            Alert.alert(
              "Check your email",
              `We sent a confirmation link to ${trimmedEmail}. Click it to activate your account, then come back and sign in.`,
              [{ text: "OK", onPress: () => setMode("sign_in") }],
            );
          } else {
            router.replace("/(app)/(tabs)");
          }
        } else {
          // User already exists
          setError("An account with this email already exists. Try signing in.");
          setMode("sign_in");
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInErr) throw signInErr;
        router.replace("/(app)/(tabs)");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (msg.includes("Invalid login")) {
        setError("Incorrect email or password.");
      } else if (msg.includes("already registered")) {
        setError("This email is already registered. Try signing in.");
        setMode("sign_in");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            Platform.OS === "web"
              ? window.location.origin
              : "prm-sc://auth/callback",
        },
      });
      if (oauthErr) throw oauthErr;
      if (data.url) {
        if (Platform.OS === "web") {
          window.location.href = data.url;
        } else {
          const WebBrowser = await import("expo-web-browser");
          await WebBrowser.openBrowserAsync(data.url);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Google sign-in failed";
      setError(msg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center px-6 py-12">
          <View className="w-full max-w-sm">
            {/* Logo */}
            <View className="mb-8 items-center">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
                <Text className="text-xl font-bold text-white">P</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                Personal RM
              </Text>
              <Text className="mt-1 text-sm text-gray-500">
                {mode === "create_account"
                  ? "Create your account"
                  : "Welcome back"}
              </Text>
            </View>

            {/* Form */}
            <View className="rounded-2xl bg-white p-5 shadow-sm">
              {/* Name field (create mode only) */}
              {mode === "create_account" && (
                <View className="mb-3">
                  <Text className="mb-1 text-xs font-medium text-gray-500">
                    Full Name
                  </Text>
                  <TextInput
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
                    placeholder="Jane Smith"
                    placeholderTextColor="#9ca3af"
                    value={fullName}
                    onChangeText={(t) => { setFullName(t); setError(""); }}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>
              )}

              {/* Email */}
              <View className="mb-3">
                <Text className="mb-1 text-xs font-medium text-gray-500">
                  Email
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(""); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoFocus={mode === "sign_in"}
                />
              </View>

              {/* Password */}
              <View className="mb-4">
                <Text className="mb-1 text-xs font-medium text-gray-500">
                  Password
                </Text>
                <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50">
                  <TextInput
                    className="flex-1 px-4 py-3 text-base text-gray-900"
                    placeholder={mode === "create_account" ? "At least 6 characters" : "Enter password"}
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(""); }}
                    secureTextEntry={!showPassword}
                    autoComplete={mode === "create_account" ? "new-password" : "current-password"}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    className="px-3 py-3"
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#9ca3af"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Error */}
              {error ? (
                <View className="mb-3 flex-row items-center rounded-lg bg-red-50 px-3 py-2">
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text className="ml-2 flex-1 text-sm text-red-600">
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className={`items-center rounded-xl py-3.5 ${
                  loading ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {mode === "create_account" ? "Create Account" : "Sign In"}
                  </Text>
                )}
              </Pressable>

              {/* Toggle mode */}
              <Pressable
                onPress={() => {
                  setMode(mode === "sign_in" ? "create_account" : "sign_in");
                  setError("");
                }}
                className="mt-3 py-2"
              >
                <Text className="text-center text-sm text-blue-600">
                  {mode === "sign_in"
                    ? "Don't have an account? Create one"
                    : "Already have an account? Sign in"}
                </Text>
              </Pressable>

              {/* Divider */}
              <View className="my-4 flex-row items-center">
                <View className="h-px flex-1 bg-gray-200" />
                <Text className="mx-3 text-xs text-gray-400">OR</Text>
                <View className="h-px flex-1 bg-gray-200" />
              </View>

              {/* Google */}
              <Pressable
                onPress={handleGoogleSignIn}
                className="flex-row items-center justify-center rounded-xl border border-gray-200 bg-white py-3.5 active:bg-gray-50"
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text className="ml-2 text-base font-medium text-gray-700">
                  Continue with Google
                </Text>
              </Pressable>

              {/* Dev quick sign-in */}
              {__DEV__ && (
                <Pressable
                  onPress={async () => {
                    setLoading(true);
                    setError("");
                    try {
                      const { error: devErr } =
                        await supabase.auth.signInWithPassword({
                          email: "dev@prm.local",
                          password: "password123",
                        });
                      if (devErr) throw devErr;
                      router.replace("/(app)/(tabs)");
                    } catch (e: unknown) {
                      setError(
                        e instanceof Error ? e.message : "Dev sign-in failed",
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="mt-3 flex-row items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-3 active:bg-gray-100"
                >
                  <Ionicons name="flash-outline" size={18} color="#6b7280" />
                  <Text className="ml-2 text-sm font-medium text-gray-500">
                    Dev Quick Sign In
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
