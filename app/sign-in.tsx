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
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // On web: check if we arrived here via a magic link redirect
  // (Supabase puts tokens in the URL hash — the client auto-detects them
  // when detectSessionInUrl=true, then onAuthStateChange fires)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          router.replace("/");
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

  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    if (code.length !== 6) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (verifyErr) throw verifyErr;
      router.replace("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      if (msg.includes("expired")) {
        setError("Code expired. Tap 'Resend' to get a new one.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Sent state — enter OTP code or wait for magic link
  // ============================================================
  if (step === "sent") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-stone-50 dark:bg-stone-950"
      >
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-sm items-center">
            <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
              <Ionicons name="mail-outline" size={32} color={Colors.brand[600]} />
            </View>

            <Text className="text-xl font-bold text-stone-900 dark:text-stone-100">
              Check your email
            </Text>

            <Text className="mt-2 text-center text-sm text-stone-500 dark:text-stone-400">
              We sent a 6-digit code to
            </Text>
            <Text className="mt-1 text-sm font-semibold text-stone-800 dark:text-stone-200">
              {email}
            </Text>

            {/* OTP Code Input */}
            <View className="mt-6 w-full rounded-2xl bg-white p-5 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
              <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                Enter code from email
              </Text>
              <TextInput
                className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center text-2xl font-bold tracking-[12px] text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                placeholder="000000"
                placeholderTextColor={Colors.gray[300]}
                value={otpCode}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(digits);
                  setError("");
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                onSubmitEditing={handleVerifyOtp}
                returnKeyType="go"
              />

              {error ? (
                <View className="mb-3 flex-row items-start rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950">
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text className="ml-2 flex-1 text-sm text-red-600 dark:text-red-400">{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                className={`items-center rounded-xl py-3.5 ${
                  loading || otpCode.length !== 6
                    ? "bg-indigo-400"
                    : "bg-indigo-600 active:bg-indigo-700"
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    Sign In
                  </Text>
                )}
              </Pressable>

              <Text className="mt-3 text-center text-xs text-stone-400 dark:text-stone-500">
                Or click the sign-in link in the email
              </Text>
            </View>

            <View className="mt-6 flex-row items-center gap-4">
              <Pressable onPress={handleResend} disabled={loading}>
                <Text className={`text-sm font-medium ${loading ? "text-stone-400 dark:text-stone-500" : "text-indigo-600 dark:text-indigo-400"}`}>
                  Resend code
                </Text>
              </Pressable>
              <View className="h-4 w-px bg-stone-200 dark:bg-stone-700" />
              <Pressable onPress={() => { setStep("email"); setError(""); setOtpCode(""); }}>
                <Text className="text-sm text-stone-500 dark:text-stone-400">
                  Different email
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ============================================================
  // Email entry
  // ============================================================
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-stone-50 dark:bg-stone-950"
    >
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-sm">
          {/* Logo */}
          <View className="mb-8 items-center">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600">
              <Text className="text-xl font-bold text-white">P</Text>
            </View>
            <Text className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              PRM
            </Text>
            <Text className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Sign in or create an account
            </Text>
          </View>

          {/* Form */}
          <View className="rounded-2xl bg-white p-5 shadow-sm dark:border dark:border-stone-800 dark:bg-stone-900">
            <Text className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
              Email
            </Text>
            <TextInput
              className="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
              <View className="mb-3 flex-row items-start rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950">
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text className="ml-2 flex-1 text-sm text-red-600 dark:text-red-400">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSendLink}
              disabled={loading}
              className={`items-center rounded-xl py-3.5 ${
                loading ? "bg-indigo-400" : "bg-indigo-600 active:bg-indigo-700"
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

            <Text className="mt-3 text-center text-xs text-stone-400 dark:text-stone-500">
              No password needed. We'll email you a sign-in link.
            </Text>

            {/* Divider */}
            <View className="my-5 flex-row items-center">
              <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
              <Text className="mx-3 text-xs text-stone-400 dark:text-stone-500">OR</Text>
              <View className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            </View>

            {/* Google */}
            <Pressable
              onPress={handleGoogleSignIn}
              className="flex-row items-center justify-center rounded-xl border border-stone-200 bg-white py-3.5 active:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:active:bg-stone-700"
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text className="ml-2 text-base font-medium text-stone-700 dark:text-stone-300">
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
                    router.replace("/");
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="mt-3 flex-row items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 py-2.5 active:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:active:bg-stone-700"
              >
                <Ionicons name="flash-outline" size={16} color={Colors.gray[500]} />
                <Text className="ml-1.5 text-sm font-medium text-stone-500 dark:text-stone-400">
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
