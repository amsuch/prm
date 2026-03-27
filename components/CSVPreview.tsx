import { View, Text, ScrollView } from "react-native";

type CSVPreviewProps = {
  headers: string[];
  rows: Record<string, string>[];
  maxRows?: number;
};

export function CSVPreview({
  headers,
  rows,
  maxRows = 5,
}: CSVPreviewProps) {
  const previewRows = rows.slice(0, maxRows);

  return (
    <View className="rounded-xl border border-gray-200 bg-white">
      <View className="border-b border-gray-200 px-4 py-3">
        <Text className="text-sm font-semibold text-gray-900">
          Preview ({rows.length} rows total)
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header row */}
          <View className="flex-row border-b border-gray-200 bg-gray-50">
            {headers.map((header) => (
              <View
                key={header}
                className="w-36 border-r border-gray-200 px-3 py-2"
              >
                <Text
                  className="text-xs font-semibold text-gray-700"
                  numberOfLines={1}
                >
                  {header}
                </Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {previewRows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              className={`flex-row border-b border-gray-100 ${
                rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"
              }`}
            >
              {headers.map((header) => (
                <View
                  key={`${rowIndex}-${header}`}
                  className="w-36 border-r border-gray-100 px-3 py-2"
                >
                  <Text className="text-xs text-gray-600" numberOfLines={1}>
                    {row[header] || "-"}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {rows.length > maxRows && (
        <View className="border-t border-gray-200 px-4 py-2">
          <Text className="text-center text-xs text-gray-400">
            Showing {maxRows} of {rows.length} rows
          </Text>
        </View>
      )}
    </View>
  );
}
