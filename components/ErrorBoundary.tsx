import { Component, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

type ErrorFallbackProps = {
  error?: Error | null;
  message?: string;
  onRetry?: () => void;
};

export function ErrorFallback({
  error,
  message,
  onRetry,
}: ErrorFallbackProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
        <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
      </View>

      <Text className="text-center text-lg font-semibold text-stone-900 dark:text-stone-100">
        Something went wrong
      </Text>

      <Text className="mt-2 text-center text-sm leading-5 text-stone-500 dark:text-stone-400">
        {message ?? error?.message ?? "An unexpected error occurred. Please try again."}
      </Text>

      {onRetry && (
        <Pressable
          className="mt-6 flex-row items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 active:bg-indigo-700"
          onPress={onRetry}
        >
          <Ionicons name="refresh-outline" size={18} color="white" />
          <Text className="text-sm font-semibold text-white">Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}
