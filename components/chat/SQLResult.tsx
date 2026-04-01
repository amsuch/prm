import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

export function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "\u2014";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (val instanceof Date) return val.toLocaleDateString();
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return new Date(val).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function SQLResultCard({
  sql,
  rows,
  rowCount,
}: {
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
}) {
  const [showSQL, setShowSQL] = useState(false);

  if (rowCount === 0) return null;

  // Get column headers from first row
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const displayRows = rows.slice(0, 20);

  return (
    <View className="mt-3">
      {/* SQL toggle */}
      <Pressable
        onPress={() => setShowSQL(!showSQL)}
        className="mb-2 flex-row items-center"
      >
        <Ionicons
          name="code-slash"
          size={13}
          color={Colors.gray[400]}
        />
        <Text className="ml-1 text-xs text-stone-400 dark:text-stone-500">
          {showSQL ? "Hide SQL" : "Show SQL"} ({rowCount} row{rowCount === 1 ? "" : "s"})
        </Text>
        <Ionicons
          name={showSQL ? "chevron-up" : "chevron-down"}
          size={12}
          color={Colors.gray[400]}
          style={{ marginLeft: 2 }}
        />
      </Pressable>

      {showSQL && (
        <View className="mb-2 rounded-lg bg-stone-800 p-3">
          <Text className="font-mono text-xs text-green-400">{sql}</Text>
        </View>
      )}

      {/* Results table */}
      <View className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700">
        {/* Header */}
        <View className="flex-row bg-stone-100 dark:bg-stone-800 px-2 py-1.5">
          {columns.map((col) => (
            <View key={col} className="flex-1 px-1">
              <Text className="text-xs font-semibold text-stone-500 dark:text-stone-400" numberOfLines={1}>
                {col.replace(/_/g, " ")}
              </Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {displayRows.map((row, i) => (
          <View
            key={i}
            className={`flex-row border-t border-stone-100 dark:border-stone-800 px-2 py-1.5 ${
              i % 2 === 0 ? "bg-white dark:bg-stone-900" : "bg-stone-50 dark:bg-stone-800"
            }`}
          >
            {columns.map((col) => (
              <View key={col} className="flex-1 px-1">
                <Text className="text-xs text-stone-700 dark:text-stone-300" numberOfLines={2}>
                  {formatCellValue(row[col])}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {rowCount > 20 && (
          <View className="border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-1.5">
            <Text className="text-xs text-stone-400 dark:text-stone-500">
              +{rowCount - 20} more rows
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
