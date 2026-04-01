import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

type EnrichmentData = {
  first_name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  department?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  bio?: string;
  profile_photo_url?: string;
  education?: string;
  previous_companies?: string[];
  skills?: string[];
};

const FIELD_CONFIG: {
  key: keyof EnrichmentData;
  label: string;
  icon: string;
}[] = [
  { key: "job_title", label: "Title", icon: "briefcase" },
  { key: "company", label: "Company", icon: "business" },
  { key: "department", label: "Department", icon: "layers" },
  { key: "email", label: "Email", icon: "mail" },
  { key: "phone", label: "Phone", icon: "call" },
  { key: "location", label: "Location", icon: "location" },
  { key: "linkedin_url", label: "LinkedIn", icon: "logo-linkedin" },
  { key: "education", label: "Education", icon: "school" },
];

export function EnrichmentResultCard({
  enrichment,
}: {
  enrichment: EnrichmentData;
}) {
  const fullName = [enrichment.first_name, enrichment.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <View className="mt-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 p-3">
      {/* Header */}
      <View className="mb-2 flex-row items-center">
        <Ionicons name="sparkles" size={16} color="#8b5cf6" />
        <Text className="ml-2 text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
          Enrichment Result
        </Text>
      </View>

      {/* Name */}
      {fullName ? (
        <Text className="mb-1 text-base font-semibold text-stone-800 dark:text-stone-200">
          {fullName}
        </Text>
      ) : null}

      {/* Bio */}
      {enrichment.bio ? (
        <Text className="mb-2 text-xs text-stone-500 dark:text-stone-400">
          {enrichment.bio}
        </Text>
      ) : null}

      {/* Fields */}
      <View className="rounded-lg bg-white dark:bg-stone-800 p-2">
        {FIELD_CONFIG.map(({ key, label, icon }) => {
          const value = enrichment[key];
          if (!value || (typeof value === "string" && !value.trim())) return null;

          return (
            <View key={key} className="flex-row items-center py-1">
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={13}
                color={Colors.gray[400]}
              />
              <Text className="ml-2 w-20 text-xs font-medium text-stone-400 dark:text-stone-500">
                {label}
              </Text>
              <Text
                className="flex-1 text-xs text-stone-700 dark:text-stone-300"
                numberOfLines={2}
              >
                {String(value)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Previous Companies */}
      {enrichment.previous_companies && enrichment.previous_companies.length > 0 ? (
        <View className="mt-2">
          <Text className="mb-1 text-xs font-medium text-stone-400 dark:text-stone-500">
            Previous Companies
          </Text>
          <View className="flex-row flex-wrap gap-1">
            {enrichment.previous_companies.map((company, i) => (
              <View
                key={i}
                className="rounded-md bg-white dark:bg-stone-800 px-2 py-0.5"
              >
                <Text className="text-xs text-stone-600 dark:text-stone-400">
                  {company}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Skills */}
      {enrichment.skills && enrichment.skills.length > 0 ? (
        <View className="mt-2">
          <Text className="mb-1 text-xs font-medium text-stone-400 dark:text-stone-500">
            Skills
          </Text>
          <View className="flex-row flex-wrap gap-1">
            {enrichment.skills.slice(0, 8).map((skill, i) => (
              <View
                key={i}
                className="rounded-full bg-purple-100 dark:bg-purple-900 px-2.5 py-0.5"
              >
                <Text className="text-xs text-purple-700 dark:text-purple-300">
                  {skill}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
