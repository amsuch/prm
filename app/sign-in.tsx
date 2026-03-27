import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type Step = "email" | "sent";

export default function SignIn() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // On web: check if we arrived here via a magic link redirect
  // (Supabase puts tokens in the URL hash — the client auto-detects them
  // when detectSessionInUrl=true, then onAuthStateChange fires)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          router.replace("/(app)/(tabs)");
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleSendLink = async () => {
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo =
        Platform.OS === "web"
          ? window.location.origin
          : "prm-sc://auth/callback";

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
      });
      if (otpErr) throw otpErr;
      setStep("sent");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (msg.includes("rate limit")) {
        setError("Too many attempts. Wait a minute and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError("");
    try {
      const redirectTo =
        Platform.OS === "web"
          ? window.location.origin
          : "prm-sc://auth/callback";

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
      });
      if (otpErr) throw otpErr;
      Alert.alert("Sent", "A new sign-in link has been sent to your email.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to resend";
      setError(msg);
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
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    }
  };

  // ============================================================
  // Sent state — waiting for user to click the link
  // ============================================================
  if (step === "sent") {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <View className="w-full max-w-sm items-center">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Ionicons name="mail-outline" size={32} color={Colors.brand[600]} />
          </View>

          <Text className="text-xl font-bold text-gray-900">
            Check your email
          </Text>

          <Text className="mt-3 text-center text-sm leading-5 text-gray-500">
            We sent a sign-in link to
          </Text>
          <Text className="mt-1 text-sm font-semibold text-gray-800">
            {email}
          </Text>

          <Text className="mt-5 text-center text-xs leading-5 text-gray-400">
            Click the link in the email and you'll be signed in automatically.
            {"\n"}New here? An account will be created for you.
          </Text>

          {/* Waiting indicator */}
          <View className="mt-6 flex-row items-center rounded-xl bg-blue-50 px-4 py-3">
            <ActivityIndicator size="small" color={Colors.brand[600]} />
            <Text className="ml-3 text-sm text-blue-700">
              Waiting for sign-in...
            </Text>
          </View>

          {error ? (
            <Text className="mt-3 text-center text-sm text-red-500">
              {error}
            </Text>
          ) : null}

          <View className="mt-8 items-center gap-4">
            <Pressable onPress={handleResend} disabled={loading}>
              <Text className={`text-sm font-medium ${loading ? "text-gray-400" : "text-blue-600"}`}>
                Resend link
              </Text>
            </Pressable>
            <Pressable onPress={() => { setStep("email"); setError(""); }}>
              <Text className="text-sm text-gray-500">
                Use a different email
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ============================================================
  // Email entry
  // ============================================================
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
    >
      <View className="flex-1 items-center justify-center px-6">
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
              Sign in or create an account
            </Text>
          </View>

          {/* Form */}
          <View className="rounded-2xl bg-white p-5 shadow-sm">
            <Text className="mb-1.5 text-xs font-medium text-gray-500">
              Email
            </Text>
            <TextInput
              className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
              placeholder="you@example.com"
              placeholderTextColor={Colors.gray[400]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              onSubmitEditing={handleSendLink}
              returnKeyType="go"
            />

            {error ? (
              <View className="mb-3 flex-row items-start rounded-lg bg-red-50 px-3 py-2">
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text className="ml-2 flex-1 text-sm text-red-600">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSendLink}
              disabled={loading}
              className={`items-center rounded-xl py-3.5 ${
                loading ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  Continue
                </Text>
              )}
            </Pressable>

            <Text className="mt-3 text-center text-xs text-gray-400">
              No password needed. We'll email you a sign-in link.
            </Text>

            {/* Divider */}
            <View className="my-5 flex-row items-center">
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
                    const { error: devErr } = await supabase.auth.signInWithPassword({
                      email: "dev@prm.local",
                      password: "password123",
                    });
                    if (devErr) throw devErr;
                    router.replace("/(app)/(tabs)");
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="mt-3 flex-row items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-2.5 active:bg-gray-100"
              >
                <Ionicons name="flash-outline" size={16} color={Colors.gray[500]} />
                <Text className="ml-1.5 text-sm font-medium text-gray-500">
                  Dev Quick Sign In
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
