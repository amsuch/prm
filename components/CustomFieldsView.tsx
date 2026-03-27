import { View, Text, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import type { Tables, Json } from "@/types/database";

type CustomFieldsViewProps = {
  customFields: Json;
  definitions: Tables<"custom_field_definitions">[];
};

function renderFieldValue(
  value: unknown,
  fieldType: string,
): { display: string; isUrl: boolean } {
  if (value === null || value === undefined || value === "") {
    return { display: "--", isUrl: false };
  }

  switch (fieldType) {
    case "boolean":
      return { display: value ? "Yes" : "No", isUrl: false };
    case "date":
      return {
        display: new Date(String(value)).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        isUrl: false,
      };
    case "url":
      return { display: String(value), isUrl: true };
    case "multi_select":
      if (Array.isArray(value)) {
        return { display: value.join(", "), isUrl: false };
      }
      return { display: String(value), isUrl: false };
    default:
      return { display: String(value), isUrl: false };
  }
}

const FIELD_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  text: "text",
  number: "calculator",
  date: "calendar",
  boolean: "toggle",
  select: "list",
  multi_select: "pricetags",
  url: "link",
};

export function CustomFieldsView({
  customFields,
  definitions,
}: CustomFieldsViewProps) {
  if (definitions.length === 0) return null;

  const fields = (customFields && typeof customFields === "object" && !Array.isArray(customFields))
    ? (customFields as Record<string, unknown>)
    : {};

  // Only show fields that have a value or are required
  const visibleDefs = definitions.filter(
    (def) => fields[def.field_key] !== undefined && fields[def.field_key] !== null && fields[def.field_key] !== "",
  );

  if (visibleDefs.length === 0) return null;

  return (
    <View>
      {visibleDefs.map((def) => {
        const { display, isUrl } = renderFieldValue(
          fields[def.field_key],
          def.field_type,
        );
        const iconName = FIELD_TYPE_ICONS[def.field_type] ?? "ellipse";

        return (
          <View
            key={def.id}
            className="mb-2 flex-row items-start rounded-lg bg-gray-50 px-3 py-2.5"
          >
            <Ionicons
              name={iconName}
              size={14}
              color={Colors.gray[400]}
              style={{ marginTop: 2 }}
            />
            <View className="ml-2 flex-1">
              <Text className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {def.name}
              </Text>
              {isUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(display)}
                >
                  <Text className="mt-0.5 text-sm text-blue-600 underline">
                    {display}
                  </Text>
                </Pressable>
              ) : (
                <Text className="mt-0.5 text-sm text-gray-800">{display}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
