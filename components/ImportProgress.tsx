import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ImportProgress as ImportProgressType } from "@/lib/csv";
import type { DeviceImportProgress } from "@/lib/contacts";

type ImportProgressProps = {
  progress: ImportProgressType | DeviceImportProgress;
  label?: string;
};

export function ImportProgress({ progress, label }: ImportProgressProps) {
  const percentage =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;
  const isComplete = progress.current >= progress.total;

  return (
    <View className="rounded-xl border border-stone-200 bg-white p-5">
      {/* Header */}
      <View className="mb-4 flex-row items-center gap-3">
        {isComplete ? (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          </View>
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
            <Ionicons name="cloud-upload-outline" size={24} color="#2563eb" />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-base font-semibold text-stone-900">
            {isComplete
              ? "Import Complete"
              : label ?? "Importing contacts..."}
          </Text>
          <Text className="text-sm text-stone-500">
            {progress.current} of {progress.total} processed
          </Text>
        </View>
        <Text className="text-lg font-bold text-indigo-600">{percentage}%</Text>
      </View>

      {/* Progress bar */}
      <View className="mb-4 h-2.5 overflow-hidden rounded-full bg-stone-100">
        <View
          className={`h-full rounded-full ${
            isComplete ? "bg-green-500" : "bg-indigo-600"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </View>

      {/* Stats */}
      <View className="flex-row gap-4">
        <View className="flex-1 items-center rounded-lg bg-green-50 py-2.5">
          <Text className="text-lg font-bold text-green-700">
            {progress.imported}
          </Text>
          <Text className="text-xs text-green-600">Imported</Text>
        </View>
        <View className="flex-1 items-center rounded-lg bg-amber-50 py-2.5">
          <Text className="text-lg font-bold text-amber-700">
            {progress.skipped}
          </Text>
          <Text className="text-xs text-amber-600">Skipped</Text>
        </View>
        <View className="flex-1 items-center rounded-lg bg-red-50 py-2.5">
          <Text className="text-lg font-bold text-red-700">
            {progress.errors.length}
          </Text>
          <Text className="text-xs text-red-600">Errors</Text>
        </View>
      </View>

      {/* Errors list */}
      {progress.errors.length > 0 && (
        <View className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <Text className="mb-1 text-xs font-semibold text-red-700">
            Errors:
          </Text>
          {progress.errors.slice(0, 5).map((error, idx) => (
            <Text key={idx} className="text-xs text-red-600">
              {error}
            </Text>
          ))}
          {progress.errors.length > 5 && (
            <Text className="mt-1 text-xs italic text-red-400">
              ...and {progress.errors.length - 5} more
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
