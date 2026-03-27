import { View, Text, Pressable, ScrollView } from "react-native";
import { useState } from "react";
import type { ColumnMapping } from "@/lib/csv";

type ColumnMapperProps = {
  headers: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
};

const TARGET_FIELDS: { key: keyof ColumnMapping; label: string; description: string }[] = [
  { key: "first_name", label: "First Name", description: "Contact's first name (required)" },
  { key: "last_name", label: "Last Name", description: "Contact's last name" },
  { key: "email", label: "Email", description: "Email address" },
  { key: "company", label: "Company", description: "Company or organization" },
  { key: "job_title", label: "Job Title", description: "Position or role" },
  { key: "linkedin_url", label: "LinkedIn URL", description: "Profile URL (used for dedup)" },
  { key: "connected_on", label: "Connected On", description: "Date of connection" },
  { key: "phone", label: "Phone", description: "Phone number" },
  { key: "notes", label: "Notes", description: "Additional notes" },
];

export function ColumnMapper({
  headers,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  const [expandedField, setExpandedField] = useState<keyof ColumnMapping | null>(null);

  const handleSelect = (field: keyof ColumnMapping, header: string | null) => {
    onMappingChange({ ...mapping, [field]: header });
    setExpandedField(null);
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <View className="rounded-xl border border-gray-200 bg-white">
      <View className="border-b border-gray-200 px-4 py-3">
        <Text className="text-sm font-semibold text-gray-900">
          Column Mapping
        </Text>
        <Text className="mt-1 text-xs text-gray-500">
          {mappedCount} of {TARGET_FIELDS.length} fields mapped
        </Text>
      </View>

      <ScrollView className="max-h-96">
        {TARGET_FIELDS.map(({ key, label, description }) => {
          const currentMapping = mapping[key];
          const isExpanded = expandedField === key;
          const isMapped = currentMapping !== null;

          return (
            <View key={key} className="border-b border-gray-100">
              <Pressable
                className="flex-row items-center justify-between px-4 py-3 active:bg-gray-50"
                onPress={() =>
                  setExpandedField(isExpanded ? null : key)
                }
              >
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-medium text-gray-900">
                      {label}
                      {key === "first_name" && (
                        <Text className="text-red-500"> *</Text>
                      )}
                    </Text>
                    {isMapped && (
                      <View className="rounded-full bg-green-100 px-2 py-0.5">
                        <Text className="text-xs font-medium text-green-700">
                          Mapped
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    {description}
                  </Text>
                </View>

                <View className="ml-3 min-w-24 items-end">
                  <Text
                    className={`text-sm ${
                      isMapped ? "font-medium text-blue-600" : "text-gray-400"
                    }`}
                    numberOfLines={1}
                  >
                    {currentMapping ?? "Not mapped"}
                  </Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View className="border-t border-gray-100 bg-gray-50 px-4 py-2">
                  <Pressable
                    className="rounded-lg px-3 py-2 active:bg-gray-200"
                    onPress={() => handleSelect(key, null)}
                  >
                    <Text className="text-sm italic text-gray-400">
                      None (skip this field)
                    </Text>
                  </Pressable>

                  {headers.map((header) => {
                    const isSelected = currentMapping === header;
                    const isUsedElsewhere = Object.entries(mapping).some(
                      ([k, v]) => k !== key && v === header,
                    );

                    return (
                      <Pressable
                        key={header}
                        className={`rounded-lg px-3 py-2 ${
                          isSelected
                            ? "bg-blue-50"
                            : isUsedElsewhere
                              ? "opacity-40"
                              : "active:bg-gray-200"
                        }`}
                        onPress={() =>
                          !isUsedElsewhere && handleSelect(key, header)
                        }
                        disabled={isUsedElsewhere}
                      >
                        <Text
                          className={`text-sm ${
                            isSelected
                              ? "font-semibold text-blue-600"
                              : "text-gray-700"
                          }`}
                        >
                          {header}
                          {isUsedElsewhere && " (already used)"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
