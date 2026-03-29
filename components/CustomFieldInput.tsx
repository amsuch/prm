import { View, Text, TextInput, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import type { Tables, Json } from "@/types/database";

type CustomFieldInputProps = {
  definition: Tables<"custom_field_definitions">;
  value: unknown;
  onChange: (value: unknown) => void;
};

export function CustomFieldInput({
  definition,
  value,
  onChange,
}: CustomFieldInputProps) {
  const { field_type, name, options, is_required } = definition;

  const optionsList: string[] =
    options && typeof options === "object" && !Array.isArray(options) && "values" in options
      ? (options as { values: string[] }).values ?? []
      : Array.isArray(options)
        ? (options as string[])
        : [];

  const renderInput = () => {
    switch (field_type) {
      case "text":
        return (
          <TextInput
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            placeholder={`Enter ${name.toLowerCase()}`}
            placeholderTextColor={Colors.gray[400]}
            value={typeof value === "string" ? value : ""}
            onChangeText={(text) => onChange(text)}
          />
        );

      case "number":
        return (
          <TextInput
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            placeholder={`Enter ${name.toLowerCase()}`}
            placeholderTextColor={Colors.gray[400]}
            value={value !== null && value !== undefined ? String(value) : ""}
            onChangeText={(text) => {
              const num = parseFloat(text);
              onChange(isNaN(num) ? text : num);
            }}
            keyboardType="numeric"
          />
        );

      case "url":
        return (
          <TextInput
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            placeholder="https://..."
            placeholderTextColor={Colors.gray[400]}
            value={typeof value === "string" ? value : ""}
            onChangeText={(text) => onChange(text)}
            keyboardType="url"
            autoCapitalize="none"
          />
        );

      case "date":
        return (
          <TextInput
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.gray[400]}
            value={typeof value === "string" ? value : ""}
            onChangeText={(text) => onChange(text)}
          />
        );

      case "boolean":
        return (
          <View className="flex-row items-center gap-2">
            <Switch
              value={!!value}
              onValueChange={(val) => onChange(val)}
              trackColor={{ false: Colors.gray[200], true: Colors.brand[400] }}
              thumbColor={value ? Colors.brand[600] : Colors.gray[50]}
            />
            <Text className="text-sm text-stone-600 dark:text-stone-400">
              {value ? "Yes" : "No"}
            </Text>
          </View>
        );

      case "select":
        return (
          <View className="flex-row flex-wrap gap-2">
            {optionsList.map((opt) => {
              const isSelected = value === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => onChange(isSelected ? null : opt)}
                  className={`rounded-full px-3 py-1.5 ${
                    isSelected
                      ? "bg-indigo-600"
                      : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected ? "text-white font-medium" : "text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );

      case "multi_select": {
        const selectedValues = Array.isArray(value) ? (value as string[]) : [];
        return (
          <View className="flex-row flex-wrap gap-2">
            {optionsList.map((opt) => {
              const isSelected = selectedValues.includes(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    if (isSelected) {
                      onChange(selectedValues.filter((v) => v !== opt));
                    } else {
                      onChange([...selectedValues, opt]);
                    }
                  }}
                  className={`flex-row items-center rounded-full px-3 py-1.5 ${
                    isSelected
                      ? "bg-indigo-600"
                      : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                  }`}
                >
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color="white"
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    className={`text-sm ${
                      isSelected ? "text-white font-medium" : "text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      }

      default:
        return (
          <TextInput
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            placeholder={`Enter ${name.toLowerCase()}`}
            placeholderTextColor={Colors.gray[400]}
            value={typeof value === "string" ? value : ""}
            onChangeText={(text) => onChange(text)}
          />
        );
    }
  };

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
        {name}
        {is_required && <Text className="text-red-500"> *</Text>}
      </Text>
      {renderInput()}
    </View>
  );
}
