import { View, Text, ActivityIndicator } from "react-native";

type LoadingSpinnerProps = {
  message?: string;
  size?: "small" | "large";
};

export function LoadingSpinner({
  message,
  size = "large",
}: LoadingSpinnerProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <ActivityIndicator size={size} color="#2563eb" />
      {message && (
        <Text className="mt-4 text-center text-sm text-stone-500">
          {message}
        </Text>
      )}
    </View>
  );
}
