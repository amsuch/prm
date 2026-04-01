import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { Avatar } from "@/components/Avatar";

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

type ExistingMatch = {
  contact_id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
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

const SKILLS_VISIBLE = 8;

export function EnrichmentResultCard({
  enrichment,
  existingMatches,
}: {
  enrichment: EnrichmentData;
  existingMatches?: ExistingMatch[];
}) {
  const fullName = [enrichment.first_name, enrichment.last_name]
    .filter(Boolean)
    .join(" ");

  const hasMatches = existingMatches && existingMatches.length > 0;
  const totalSkills = enrichment.skills?.length ?? 0;
  const hiddenSkills = Math.max(0, totalSkills - SKILLS_VISIBLE);

  return (
    <View className="mt-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 p-3">
      {/* Header */}
      <View className="mb-2 flex-row items-center">
        <Ionicons name="sparkles" size={16} color="#8b5cf6" />
        <Text className="ml-2 text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
          Enrichment Result
        </Text>
      </View>

      {/* Existing match banner */}
      {hasMatches && (
        <View className="mb-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-2.5">
          <View className="flex-row items-center">
            <Ionicons name="alert-circle" size={16} color="#d97706" />
            <Text className="ml-2 flex-1 text-xs font-medium text-amber-800 dark:text-amber-200">
              Possible match in your contacts
            </Text>
          </View>
          {existingMatches.map((match) => {
            const matchName = [match.first_name, match.last_name]
              .filter(Boolean)
              .join(" ");
            return (
              <View
                key={match.contact_id}
                className="mt-1.5 flex-row items-center"
              >
                <Avatar
                  firstName={match.first_name}
                  lastName={match.last_name}
                  size="xs"
                />
                <Text className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                  {matchName}
                  {match.company ? ` — ${match.company}` : ""}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Name + avatar */}
      <View className="mb-1 flex-row items-center">
        {enrichment.profile_photo_url ? (
          <View className="mr-2 h-8 w-8 overflow-hidden rounded-full bg-purple-200 dark:bg-purple-800">
            {/* RN Image would go here; fallback to initials */}
            <Avatar
              firstName={enrichment.first_name ?? ""}
              lastName={enrichment.last_name ?? ""}
              size="sm"
            />
          </View>
        ) : fullName ? (
          <View className="mr-2">
            <Avatar
              firstName={enrichment.first_name ?? ""}
              lastName={enrichment.last_name ?? ""}
              size="sm"
            />
          </View>
        ) : null}
        {fullName ? (
          <Text className="text-base font-semibold text-stone-800 dark:text-stone-200">
            {fullName}
          </Text>
        ) : null}
      </View>

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
          if (!value || (typeof value === "string" && !value.trim()))
            return null;

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
      {enrichment.previous_companies &&
      enrichment.previous_companies.length > 0 ? (
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
            {enrichment.skills.slice(0, SKILLS_VISIBLE).map((skill, i) => (
              <View
                key={i}
                className="rounded-full bg-purple-100 dark:bg-purple-900 px-2.5 py-0.5"
              >
                <Text className="text-xs text-purple-700 dark:text-purple-300">
                  {skill}
                </Text>
              </View>
            ))}
            {hiddenSkills > 0 && (
              <View className="rounded-full bg-purple-50 dark:bg-purple-950 px-2.5 py-0.5">
                <Text className="text-xs text-purple-400 dark:text-purple-500">
                  +{hiddenSkills} more
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
