import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import type { Json } from "@/types/database";

/** Keys stored in custom_fields by Parallel enrichment. */
const ENRICHMENT_FIELD_CONFIG: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "location", label: "Location", icon: "location-outline" },
  { key: "education", label: "Education", icon: "school-outline" },
  { key: "previous_companies", label: "Previous Companies", icon: "business-outline" },
];

type EnrichmentFieldsProps = {
  customFields: Json;
};

/**
 * Displays enrichment-specific fields (location, education, previous_companies)
 * that are stored in the contact's custom_fields JSONB by Parallel enrichment.
 */
export function EnrichmentFields({ customFields }: EnrichmentFieldsProps) {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return null;
  }

  const fields = customFields as Record<string, unknown>;

  // Only render if at least one enrichment field has a value
  const hasAnyField = ENRICHMENT_FIELD_CONFIG.some((cfg) => {
    const val = fields[cfg.key];
    if (val === null || val === undefined || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });

  if (!hasAnyField) return null;

  return (
    <View>
      {ENRICHMENT_FIELD_CONFIG.map(({ key, label, icon }) => {
        const value = fields[key];
        if (value === null || value === undefined || value === "") return null;
        if (Array.isArray(value) && value.length === 0) return null;

        return (
          <View
            key={key}
            className="mb-2 flex-row items-start rounded-lg bg-stone-50 px-3 py-2.5 dark:bg-stone-800"
          >
            <Ionicons
              name={icon}
              size={14}
              color={Colors.gray[400]}
              style={{ marginTop: 2 }}
            />
            <View className="ml-2 flex-1">
              <Text className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
                {label}
              </Text>
              {Array.isArray(value) ? (
                <View className="mt-1 flex-row flex-wrap gap-1">
                  {value.map((item, i) => (
                    <View
                      key={i}
                      className="rounded-md bg-stone-100 px-2 py-0.5 dark:bg-stone-700"
                    >
                      <Text className="text-xs text-stone-600 dark:text-stone-400">
                        {String(item)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="mt-0.5 text-sm text-stone-800 dark:text-stone-200">
                  {String(value)}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
