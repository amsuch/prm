import { View, Text, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";

export default function ImportScreen() {
  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-4 pt-5 pb-24"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6 pt-2">
        <Text className="text-2xl font-bold text-gray-900">
          Import Contacts
        </Text>
        <Text className="mt-1 text-sm text-gray-500">
          Bring your network into one place. Choose an import method below.
        </Text>
      </View>

      {/* LinkedIn CSV Card */}
      <ImportCard
        icon="document-text-outline"
        iconBgColor="bg-blue-100"
        iconColor={Colors.brand[600]}
        title="LinkedIn CSV"
        description="Export your LinkedIn connections and import them here. We automatically map columns and detect duplicates."
        features={[
          "Auto-detects LinkedIn column format",
          "Skips duplicates on re-import",
          "Imports name, email, company, title",
        ]}
        ctaLabel="Import CSV"
        onPress={() => router.push("/(app)/import/csv")}
      />

      {/* Device Contacts Card */}
      <ImportCard
        icon="people-outline"
        iconBgColor="bg-purple-100"
        iconColor="#7c3aed"
        title="Device Contacts"
        description="Import contacts from your phone. Browse and select which contacts to add with full duplicate detection."
        features={[
          "Selective import with checkboxes",
          "Cross-source duplicate detection",
          "Imports name, email, phone, company",
        ]}
        ctaLabel="Import from Device"
        onPress={() => router.push("/(app)/import/device")}
      />

      {/* Info section */}
      <View className="mt-2 rounded-xl border border-gray-200 bg-white p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={Colors.gray[500]}
          />
          <Text className="text-sm font-medium text-gray-700">
            About Importing
          </Text>
        </View>
        <Text className="mt-2 text-xs leading-4 text-gray-500">
          Imported contacts are merged with your existing data. Duplicate
          detection uses LinkedIn profile URLs for CSV imports and email/phone
          matching for device contacts. You can always edit imported contacts
          afterwards.
        </Text>
      </View>
    </ScrollView>
  );
}

// --- Sub-components ---

type ImportCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor: string;
  title: string;
  description: string;
  features: string[];
  ctaLabel: string;
  onPress: () => void;
};

function ImportCard({
  icon,
  iconBgColor,
  iconColor,
  title,
  description,
  features,
  ctaLabel,
  onPress,
}: ImportCardProps) {
  return (
    <Pressable
      className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm active:bg-gray-50"
      onPress={onPress}
    >
      <View className="p-5">
        {/* Header row */}
        <View className="flex-row items-center gap-3">
          <View
            className={`h-12 w-12 items-center justify-center rounded-xl ${iconBgColor}`}
          >
            <Ionicons name={icon} size={26} color={iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">
              {title}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
        </View>

        {/* Description */}
        <Text className="mt-3 text-sm leading-5 text-gray-500">
          {description}
        </Text>

        {/* Features */}
        <View className="mt-3">
          {features.map((feature, idx) => (
            <View key={idx} className="mb-1.5 flex-row items-center gap-2">
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Colors.success}
              />
              <Text className="flex-1 text-xs text-gray-600">{feature}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View className="mt-4 flex-row items-center justify-center rounded-lg bg-blue-50 py-2.5">
          <Text className="text-sm font-semibold text-blue-600">
            {ctaLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
