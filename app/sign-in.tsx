import { useState, useRef } from "react";
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

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState("");
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setStep("code");
      setCode(["", "", "", "", "", ""]);
      setCodeError("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (fullCode: string) => {
    if (fullCode.length !== 6) return;
    setLoading(true);
    setCodeError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: fullCode,
        type: "email",
      });
      if (error) throw error;
      router.replace("/(app)/(tabs)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid code";
      setCodeError(msg);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setCodeError("");

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    const fullCode = newCode.join("");
    if (fullCode.length === 6 && newCode.every((d) => d !== "")) {
      handleVerifyCode(fullCode);
    }
  };

  const handleCodeKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 6);
    if (digits.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < digits.length; i++) {
        newCode[i] = digits[i];
      }
      setCode(newCode);
      if (digits.length === 6) {
        handleVerifyCode(digits);
      } else {
        inputRefs.current[digits.length]?.focus();
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            Platform.OS === "web"
              ? window.location.origin
              : "prm-sc://auth/callback",
        },
      });
      if (error) throw error;
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
      Alert.alert("Error", msg);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setCodeError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setCode(["", "", "", "", "", ""]);
      Alert.alert("Sent", "A new code has been sent to your email.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to resend";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Enter verification code
  if (step === "code") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-gray-50"
      >
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-sm items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Ionicons name="shield-checkmark-outline" size={32} color="#2563eb" />
            </View>
            <Text className="text-xl font-bold text-gray-900">
              Enter verification code
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              We sent a 6-digit code to{"\n"}
              <Text className="font-medium text-gray-700">{email}</Text>
            </Text>

            {/* Code input */}
            <View className="mt-8 flex-row gap-2">
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  value={digit}
                  onChangeText={(value) => {
                    // Handle paste of full code
                    if (value.length > 1) {
                      handleCodePaste(value);
                    } else {
                      handleCodeChange(index, value);
                    }
                  }}
                  onKeyPress={({ nativeEvent }) =>
                    handleCodeKeyPress(index, nativeEvent.key)
                  }
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={index === 0}
                  selectTextOnFocus
                  className={`h-14 w-11 rounded-xl border-2 text-center text-xl font-bold ${
                    codeError
                      ? "border-red-300 bg-red-50 text-red-600"
                      : digit
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-900"
                  }`}
                />
              ))}
            </View>

            {/* Error */}
            {codeError ? (
              <View className="mt-3 flex-row items-center">
                <Ionicons name="alert-circle" size={14} color="#ef4444" />
                <Text className="ml-1 text-sm text-red-500">{codeError}</Text>
              </View>
            ) : null}

            {/* Loading */}
            {loading && (
              <View className="mt-4">
                <ActivityIndicator color="#2563eb" />
              </View>
            )}

            {/* Actions */}
            <View className="mt-8 items-center gap-3">
              <Pressable onPress={handleResendCode} disabled={loading}>
                <Text className="text-sm font-medium text-blue-600">
                  Resend code
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStep("email");
                  setCode(["", "", "", "", "", ""]);
                  setCodeError("");
                }}
              >
                <Text className="text-sm text-gray-500">
                  Use a different email
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Step 1: Enter email
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
    >
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-sm">
          {/* Logo */}
          <View className="mb-10 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
              <Text className="text-2xl font-bold text-white">P</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              Personal RM
            </Text>
            <Text className="mt-1 text-gray-500">
              Your relationship manager
            </Text>
          </View>

          {/* Form */}
          <View className="rounded-2xl bg-white p-6 shadow-sm">
            <TextInput
              className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base text-gray-900"
              placeholder="Enter your email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
            />

            <Pressable
              onPress={handleSendCode}
              disabled={loading}
              className="mb-3 items-center rounded-xl bg-blue-600 py-3.5 active:bg-blue-700"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  Continue with Email
                </Text>
              )}
            </Pressable>

            <Text className="text-center text-xs text-gray-400">
              We'll send you a verification code. No password needed.
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
              className="mb-3 flex-row items-center justify-center rounded-xl border border-gray-200 bg-white py-3.5 active:bg-gray-50"
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
                  try {
                    const { error } = await supabase.auth.signInWithPassword({
                      email: "dev@prm.local",
                      password: "password123",
                    });
                    if (error) throw error;
                    router.replace("/(app)/(tabs)");
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : "Failed";
                    Alert.alert("Error", msg);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex-row items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-3 active:bg-gray-100"
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
    </KeyboardAvoidingView>
  );
}
