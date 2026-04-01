import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Json } from "@/types/database";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import { useCustomFieldDefinitions } from "@/hooks/useCustomFieldDefinitions";
import { useTags } from "@/hooks/useTags";
import { useCompanies } from "@/hooks/useCompanies";
import { Colors } from "@/constants/colors";
import { validateContactForm, type ContactFormData, type ValidationError } from "@/lib/validation";
import { CustomFieldInput } from "@/components/CustomFieldInput";
import { TagSelector } from "@/components/TagSelector";
import type { ContactFull } from "@/hooks/useContact";

// ---------------------------------------------------------------------------
// Enrichment progress phases shown during the ~30-45s wait
// ---------------------------------------------------------------------------
const ENRICH_PHASES = [
  "Searching the web...",
  "Finding profile details...",
  "Analyzing professional background...",
  "Extracting contact info...",
];

function useEnrichProgress(isEnriching: boolean) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isEnriching) {
      setPhaseIndex(0);
      return;
    }
    // Rotate through phases every 8 seconds
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % ENRICH_PHASES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [isEnriching]);

  useEffect(() => {
    if (!isEnriching) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isEnriching, pulseAnim]);

  return { phase: ENRICH_PHASES[phaseIndex], pulseAnim };
}

/**
 * Detect if a string looks like a LinkedIn URL.
 */
function isLinkedInUrl(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.includes("linkedin.com/in/") ||
    t.startsWith("/in/") ||
    /^https?:\/\/(www\.)?linkedin\.com/.test(t)
  );
}

/**
 * Normalize a LinkedIn URL input to a full URL.
 */
function normalizeLinkedInUrl(value: string): string {
  if (!value.startsWith("http")) {
    return value.startsWith("linkedin.com")
      ? `https://www.${value}`
      : value.startsWith("/in/")
        ? `https://www.linkedin.com${value}`
        : `https://www.linkedin.com/in/${value}`;
  }
  return value;
}

type ContactFormProps = {
  existingContact?: ContactFull | null;
  mode: "create" | "edit";
};

type EmailEntry = { id?: string; label: string; email: string; is_primary: boolean };
type PhoneEntry = { id?: string; label: string; phone: string; is_primary: boolean };
type UrlEntry = { id?: string; label: string; url: string };

const EMAIL_LABELS = ["personal", "work", "other"];
const PHONE_LABELS = ["mobile", "home", "work", "other"];
const URL_LABELS = ["linkedin", "twitter", "website", "github", "other"];

export function ContactForm({ existingContact, mode }: ContactFormProps) {
  const router = useRouter();
  const { session } = useSession();
  const { definitions } = useCustomFieldDefinitions();
  const { tags: allTags, createTag } = useTags();
  const { companies: allCompanies } = useCompanies();

  const userId = session?.user?.id;

  // Basic info
  const [firstName, setFirstName] = useState(existingContact?.first_name ?? "");
  const [lastName, setLastName] = useState(existingContact?.last_name ?? "");
  const [company, setCompany] = useState(existingContact?.company ?? "");
  const [jobTitle, setJobTitle] = useState(existingContact?.job_title ?? "");
  const [department, setDepartment] = useState(existingContact?.department ?? "");
  const [birthday, setBirthday] = useState(existingContact?.birthday ?? "");
  const [notes, setNotes] = useState(existingContact?.notes ?? "");

  // Multi-value fields
  const [emails, setEmails] = useState<EmailEntry[]>(() => {
    if (existingContact?.contact_emails?.length) {
      return existingContact.contact_emails.map((e) => ({
        id: e.id,
        label: e.label,
        email: e.email,
        is_primary: e.is_primary,
      }));
    }
    return [{ label: "personal", email: "", is_primary: true }];
  });

  const [phones, setPhones] = useState<PhoneEntry[]>(() => {
    if (existingContact?.contact_phones?.length) {
      return existingContact.contact_phones.map((p) => ({
        id: p.id,
        label: p.label,
        phone: p.phone,
        is_primary: p.is_primary,
      }));
    }
    return [{ label: "mobile", phone: "", is_primary: true }];
  });

  const [urls, setUrls] = useState<UrlEntry[]>(() => {
    if (existingContact?.contact_urls?.length) {
      return existingContact.contact_urls.map((u) => ({
        id: u.id,
        label: u.label,
        url: u.url,
      }));
    }
    return [];
  });

  // Tags
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => {
    return existingContact?.contact_tags?.map((ct) => ct.tag_id) ?? [];
  });

  // Custom fields
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(() => {
    const cf = existingContact?.custom_fields;
    if (cf && typeof cf === "object" && !Array.isArray(cf)) {
      return cf as Record<string, unknown>;
    }
    return {};
  });

  // LinkedIn enrichment
  const [linkedInInput, setLinkedInInput] = useState("");
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichedFrom, setEnrichedFrom] = useState<string | null>(null);
  const { phase: enrichPhase, pulseAnim } = useEnrichProgress(isEnriching);

  const handleEnrichFromUrl = useCallback(async () => {
    const url = linkedInInput.trim();
    if (!url) return;

    setIsEnriching(true);
    setEnrichError(null);

    try {
      const normalizedUrl = normalizeLinkedInUrl(url);

      const { data, error } = await supabase.functions.invoke("enrich-contact", {
        body: { type: "linkedin", value: normalizedUrl },
      });

      if (error) throw new Error(error.message ?? "Enrichment failed");
      if (!data?.success) throw new Error(data?.error ?? "No data returned");

      const e = data.enrichment as Record<string, unknown>;

      // Auto-fill form fields from enrichment
      if (e.first_name && typeof e.first_name === "string") setFirstName(e.first_name);
      if (e.last_name && typeof e.last_name === "string") setLastName(e.last_name);
      if (e.company && typeof e.company === "string") setCompany(e.company);
      if (e.job_title && typeof e.job_title === "string") setJobTitle(e.job_title);
      if (e.department && typeof e.department === "string") setDepartment(e.department);

      // Build notes from bio + location
      const notesParts: string[] = [];
      if (e.bio && typeof e.bio === "string") notesParts.push(e.bio);
      if (e.location && typeof e.location === "string") notesParts.push(`Location: ${e.location}`);
      if (notesParts.length > 0) setNotes(notesParts.join("\n"));

      // Fill email
      if (e.email && typeof e.email === "string") {
        setEmails([{ label: "work", email: e.email, is_primary: true }]);
      }

      // Fill phone
      if (e.phone && typeof e.phone === "string") {
        setPhones([{ label: "work", phone: e.phone, is_primary: true }]);
      }

      // Fill LinkedIn URL
      setUrls((prev) => {
        const hasLinkedin = prev.some((u) => u.label === "linkedin");
        if (hasLinkedin) {
          return prev.map((u) => u.label === "linkedin" ? { ...u, url: normalizedUrl } : u);
        }
        return [...prev, { label: "linkedin", url: normalizedUrl }];
      });

      // Fill custom fields (education, skills, previous companies)
      const newCustom: Record<string, unknown> = { ...customFields };
      if (e.education && typeof e.education === "string") newCustom.education = e.education;
      if (Array.isArray(e.previous_companies) && e.previous_companies.length > 0) {
        newCustom.previous_companies = e.previous_companies;
      }
      if (Array.isArray(e.skills) && e.skills.length > 0) {
        newCustom.skills = e.skills;
      }
      if (e.location && typeof e.location === "string") newCustom.location = e.location;
      setCustomFields(newCustom);

      setEnrichedFrom(normalizedUrl);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setIsEnriching(false);
    }
  }, [linkedInInput, customFields]);

  // Company autocomplete
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const filteredCompanies = useMemo(() => {
    if (!company.trim()) return [];
    const query = company.toLowerCase();
    return allCompanies.filter(
      (c) => c.toLowerCase().includes(query) && c.toLowerCase() !== query,
    );
  }, [company, allCompanies]);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleAddEmail = () => {
    setEmails((prev) => [...prev, { label: "work", email: "", is_primary: false }]);
  };

  const handleRemoveEmail = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateEmail = (index: number, field: keyof EmailEntry, value: string | boolean) => {
    setEmails((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  };

  const handleAddPhone = () => {
    setPhones((prev) => [...prev, { label: "work", phone: "", is_primary: false }]);
  };

  const handleRemovePhone = (index: number) => {
    setPhones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePhone = (index: number, field: keyof PhoneEntry, value: string | boolean) => {
    setPhones((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  };

  const handleAddUrl = () => {
    setUrls((prev) => [...prev, { label: "website", url: "" }]);
  };

  const handleRemoveUrl = (index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateUrl = (index: number, field: keyof UrlEntry, value: string) => {
    setUrls((prev) =>
      prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)),
    );
  };

  const handleCustomFieldChange = (fieldKey: string, value: unknown) => {
    setCustomFields((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  const handleSave = async () => {
    if (!userId) return;

    // Build form data for validation
    const formData: ContactFormData = {
      first_name: firstName,
      last_name: lastName,
      company,
      job_title: jobTitle,
      department,
      birthday,
      notes,
      emails: emails.filter((e) => e.email.trim()),
      phones: phones.filter((p) => p.phone.trim()),
      urls: urls.filter((u) => u.url.trim()),
      tagIds: selectedTagIds,
      custom_fields: customFields,
    };

    const validationErrors = validateContactForm(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSaving(true);

    try {
      let contactId: string;

      if (mode === "edit" && existingContact) {
        // Update existing contact
        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            company: company.trim() || null,
            job_title: jobTitle.trim() || null,
            department: department.trim() || null,
            birthday: birthday.trim() || null,
            notes: notes.trim() || null,
            custom_fields: customFields as Json,
          })
          .eq("id", existingContact.id);

        if (updateError) throw updateError;
        contactId = existingContact.id;
      } else {
        // Create new contact
        const { data, error: insertError } = await supabase
          .from("contacts")
          .insert({
            user_id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            company: company.trim() || null,
            job_title: jobTitle.trim() || null,
            department: department.trim() || null,
            birthday: birthday.trim() || null,
            notes: notes.trim() || null,
            custom_fields: customFields as Json,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        contactId = data.id;
      }

      // Handle emails: delete existing (for edit), then insert non-empty
      if (mode === "edit") {
        await supabase.from("contact_emails").delete().eq("contact_id", contactId);
      }
      const validEmails = emails.filter((e) => e.email.trim());
      if (validEmails.length > 0) {
        const { error: emailError } = await supabase
          .from("contact_emails")
          .insert(
            validEmails.map((e) => ({
              contact_id: contactId,
              label: e.label,
              email: e.email.trim(),
              is_primary: e.is_primary,
            })),
          );
        if (emailError) throw emailError;
      }

      // Handle phones
      if (mode === "edit") {
        await supabase.from("contact_phones").delete().eq("contact_id", contactId);
      }
      const validPhones = phones.filter((p) => p.phone.trim());
      if (validPhones.length > 0) {
        const { error: phoneError } = await supabase
          .from("contact_phones")
          .insert(
            validPhones.map((p) => ({
              contact_id: contactId,
              label: p.label,
              phone: p.phone.trim(),
              is_primary: p.is_primary,
            })),
          );
        if (phoneError) throw phoneError;
      }

      // Handle URLs
      if (mode === "edit") {
        await supabase.from("contact_urls").delete().eq("contact_id", contactId);
      }
      const validUrls = urls.filter((u) => u.url.trim());
      if (validUrls.length > 0) {
        const { error: urlError } = await supabase
          .from("contact_urls")
          .insert(
            validUrls.map((u) => ({
              contact_id: contactId,
              label: u.label,
              url: u.url.trim(),
            })),
          );
        if (urlError) throw urlError;
      }

      // Handle tags: delete existing, then insert
      if (mode === "edit") {
        await supabase.from("contact_tags").delete().eq("contact_id", contactId);
      }
      if (selectedTagIds.length > 0) {
        const { error: tagError } = await supabase
          .from("contact_tags")
          .insert(
            selectedTagIds.map((tagId) => ({
              contact_id: contactId,
              tag_id: tagId,
            })),
          );
        if (tagError) throw tagError;
      }

      // Navigate back
      if (mode === "create") {
        router.replace(`/contact/${contactId}`);
      } else {
        router.back();
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save contact",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-stone-50 dark:bg-stone-950"
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* LinkedIn Enrichment — only in create mode */}
        {mode === "create" && (
          <View className="mx-4 mt-5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 p-5 shadow-sm">
            <View className="mb-3 flex-row items-center">
              <Ionicons name="sparkles" size={16} color="#8b5cf6" />
              <Text className="ml-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
                Auto-fill from LinkedIn
              </Text>
            </View>

            {enrichedFrom ? (
              <View className="flex-row items-center rounded-lg bg-green-50 dark:bg-green-950 p-3">
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text className="ml-2 flex-1 text-xs text-green-700 dark:text-green-300" numberOfLines={1}>
                  Filled from {enrichedFrom}
                </Text>
                <Pressable
                  onPress={() => {
                    setEnrichedFrom(null);
                    setLinkedInInput("");
                  }}
                >
                  <Text className="text-xs font-medium text-green-600 dark:text-green-400">
                    Clear
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    className="flex-1 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
                    placeholder="linkedin.com/in/johndoe"
                    placeholderTextColor={Colors.gray[400]}
                    value={linkedInInput}
                    onChangeText={setLinkedInInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEnriching}
                    onSubmitEditing={handleEnrichFromUrl}
                  />
                  <Pressable
                    onPress={handleEnrichFromUrl}
                    disabled={isEnriching || !linkedInInput.trim()}
                    className="items-center justify-center rounded-lg bg-purple-600 px-4 py-2.5 active:bg-purple-700 disabled:opacity-50"
                  >
                    {isEnriching ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Ionicons name="search" size={18} color="white" />
                    )}
                  </Pressable>
                </View>

                {isEnriching && (
                  <Animated.View
                    className="mt-3 flex-row items-center"
                    style={{ opacity: pulseAnim }}
                  >
                    <Ionicons name="globe-outline" size={14} color="#8b5cf6" />
                    <Text className="ml-2 text-xs text-purple-600 dark:text-purple-400">
                      {enrichPhase}
                    </Text>
                  </Animated.View>
                )}

                {enrichError && (
                  <View className="mt-2 flex-row items-center">
                    <Ionicons name="alert-circle" size={14} color={Colors.error} />
                    <Text className="ml-1 text-xs text-red-500 dark:text-red-400">
                      {enrichError}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Basic Info Section */}
        <View className="mx-4 mt-5 rounded-xl bg-white dark:bg-stone-900 p-5 shadow-sm">
          <Text className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
            Basic Information
          </Text>

          {/* First Name */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              First Name <Text className="text-red-500 dark:text-red-400">*</Text>
            </Text>
            <TextInput
              className={`rounded-lg border bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 ${
                getFieldError("first_name") ? "border-red-400" : "border-stone-200 dark:border-stone-700"
              }`}
              placeholder="First name"
              placeholderTextColor={Colors.gray[400]}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            {getFieldError("first_name") && (
              <Text className="mt-1 text-xs text-red-500 dark:text-red-400">
                {getFieldError("first_name")}
              </Text>
            )}
          </View>

          {/* Last Name */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Last Name</Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
              placeholder="Last name"
              placeholderTextColor={Colors.gray[400]}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>

          {/* Company with autocomplete */}
          <View className="mb-4" style={{ zIndex: 10 }}>
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Company</Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
              placeholder="Company"
              placeholderTextColor={Colors.gray[400]}
              value={company}
              onChangeText={(text) => {
                setCompany(text);
                setShowCompanySuggestions(true);
              }}
              onFocus={() => setShowCompanySuggestions(true)}
              onBlur={() => {
                // Delay hide to allow tap on suggestion
                setTimeout(() => setShowCompanySuggestions(false), 200);
              }}
              autoCapitalize="words"
            />
            {showCompanySuggestions && filteredCompanies.length > 0 && (
              <View
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-md"
                style={{
                  position: Platform.OS === "web" ? ("absolute" as const) : ("relative" as const),
                  top: Platform.OS === "web" ? 68 : 0,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  maxHeight: 160,
                }}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={{ maxHeight: 160 }}
                >
                  {filteredCompanies.map((c, idx) => (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setCompany(c);
                        setShowCompanySuggestions(false);
                      }}
                      className={`px-3 py-2.5 active:bg-indigo-50 ${
                        idx > 0 ? "border-t border-stone-100 dark:border-stone-800" : ""
                      }`}
                    >
                      <Text className="text-sm text-stone-900 dark:text-stone-100">{c}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Job Title */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Job Title</Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
              placeholder="Job title"
              placeholderTextColor={Colors.gray[400]}
              value={jobTitle}
              onChangeText={setJobTitle}
              autoCapitalize="words"
            />
          </View>

          {/* Department */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Department</Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
              placeholder="Department"
              placeholderTextColor={Colors.gray[400]}
              value={department}
              onChangeText={setDepartment}
              autoCapitalize="words"
            />
          </View>

          {/* Birthday */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Birthday</Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.gray[400]}
              value={birthday}
              onChangeText={setBirthday}
            />
          </View>

          {/* Notes */}
          <View>
            <Text className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">Notes</Text>
            <TextInput
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
              placeholder="Add notes..."
              placeholderTextColor={Colors.gray[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 72 }}
            />
          </View>
        </View>

        {/* Emails Section */}
        <View className="mx-4 mt-5 rounded-xl bg-white dark:bg-stone-900 p-5 shadow-sm">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              Email Addresses
            </Text>
            <Pressable
              onPress={handleAddEmail}
              className="flex-row items-center rounded-lg bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1"
            >
              <Ionicons name="add" size={14} color={Colors.brand[600]} />
              <Text className="ml-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">Add</Text>
            </Pressable>
          </View>

          {emails.map((entry, index) => (
            <View key={index} className="mb-2">
              <View className="flex-row items-center gap-2">
                {/* Label picker */}
                <View className="flex-row">
                  {EMAIL_LABELS.map((label) => (
                    <Pressable
                      key={label}
                      onPress={() => handleUpdateEmail(index, "label", label)}
                      className={`rounded-l-none rounded-r-none border-b-2 px-2 py-1 ${
                        entry.label === label
                          ? "border-indigo-600"
                          : "border-transparent"
                      }`}
                    >
                      <Text
                        className={`text-xs capitalize ${
                          entry.label === label
                            ? "font-semibold text-indigo-600 dark:text-indigo-400"
                            : "text-stone-400 dark:text-stone-500"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {emails.length > 1 && (
                  <Pressable
                    onPress={() => handleRemoveEmail(index)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </Pressable>
                )}
              </View>
              <TextInput
                className={`mt-1 rounded-lg border bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 ${
                  getFieldError(`email_${index}`)
                    ? "border-red-400"
                    : "border-stone-200"
                }`}
                placeholder="email@example.com"
                placeholderTextColor={Colors.gray[400]}
                value={entry.email}
                onChangeText={(text) => handleUpdateEmail(index, "email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {getFieldError(`email_${index}`) && (
                <Text className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {getFieldError(`email_${index}`)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Phones Section */}
        <View className="mx-4 mt-5 rounded-xl bg-white dark:bg-stone-900 p-5 shadow-sm">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              Phone Numbers
            </Text>
            <Pressable
              onPress={handleAddPhone}
              className="flex-row items-center rounded-lg bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1"
            >
              <Ionicons name="add" size={14} color={Colors.brand[600]} />
              <Text className="ml-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">Add</Text>
            </Pressable>
          </View>

          {phones.map((entry, index) => (
            <View key={index} className="mb-2">
              <View className="flex-row items-center gap-2">
                <View className="flex-row">
                  {PHONE_LABELS.map((label) => (
                    <Pressable
                      key={label}
                      onPress={() => handleUpdatePhone(index, "label", label)}
                      className={`rounded-l-none rounded-r-none border-b-2 px-2 py-1 ${
                        entry.label === label
                          ? "border-indigo-600"
                          : "border-transparent"
                      }`}
                    >
                      <Text
                        className={`text-xs capitalize ${
                          entry.label === label
                            ? "font-semibold text-indigo-600 dark:text-indigo-400"
                            : "text-stone-400 dark:text-stone-500"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {phones.length > 1 && (
                  <Pressable
                    onPress={() => handleRemovePhone(index)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </Pressable>
                )}
              </View>
              <TextInput
                className={`mt-1 rounded-lg border bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 ${
                  getFieldError(`phone_${index}`)
                    ? "border-red-400"
                    : "border-stone-200"
                }`}
                placeholder="+1 (555) 123-4567"
                placeholderTextColor={Colors.gray[400]}
                value={entry.phone}
                onChangeText={(text) => handleUpdatePhone(index, "phone", text)}
                keyboardType="phone-pad"
              />
              {getFieldError(`phone_${index}`) && (
                <Text className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {getFieldError(`phone_${index}`)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* URLs Section */}
        <View className="mx-4 mt-5 rounded-xl bg-white dark:bg-stone-900 p-5 shadow-sm">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              URLs
            </Text>
            <Pressable
              onPress={handleAddUrl}
              className="flex-row items-center rounded-lg bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1"
            >
              <Ionicons name="add" size={14} color={Colors.brand[600]} />
              <Text className="ml-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">Add</Text>
            </Pressable>
          </View>

          {urls.length === 0 && (
            <Text className="py-2 text-center text-sm text-stone-400 dark:text-stone-500">
              No URLs added
            </Text>
          )}

          {urls.map((entry, index) => (
            <View key={index} className="mb-2">
              <View className="flex-row items-center gap-2">
                <View className="flex-row">
                  {URL_LABELS.map((label) => (
                    <Pressable
                      key={label}
                      onPress={() => handleUpdateUrl(index, "label", label)}
                      className={`rounded-l-none rounded-r-none border-b-2 px-2 py-1 ${
                        entry.label === label
                          ? "border-indigo-600"
                          : "border-transparent"
                      }`}
                    >
                      <Text
                        className={`text-xs capitalize ${
                          entry.label === label
                            ? "font-semibold text-indigo-600 dark:text-indigo-400"
                            : "text-stone-400 dark:text-stone-500"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable onPress={() => handleRemoveUrl(index)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </Pressable>
              </View>
              <TextInput
                className={`mt-1 rounded-lg border bg-white dark:bg-stone-800 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 ${
                  getFieldError(`url_${index}`)
                    ? "border-red-400"
                    : "border-stone-200"
                }`}
                placeholder="https://..."
                placeholderTextColor={Colors.gray[400]}
                value={entry.url}
                onChangeText={(text) => handleUpdateUrl(index, "url", text)}
                keyboardType="url"
                autoCapitalize="none"
              />
              {getFieldError(`url_${index}`) && (
                <Text className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {getFieldError(`url_${index}`)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Tags Section */}
        <View className="mx-4 mt-5 rounded-xl bg-white dark:bg-stone-900 p-5 shadow-sm">
          <Text className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
            Tags
          </Text>
          <TagSelector
            allTags={allTags}
            selectedTagIds={selectedTagIds}
            onToggleTag={handleToggleTag}
            onCreateTag={createTag}
          />
        </View>

        {/* Custom Fields Section */}
        {definitions.length > 0 && (
          <View className="mx-4 mt-5 rounded-xl bg-white dark:bg-stone-900 p-5 shadow-sm">
            <Text className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              Custom Fields
            </Text>
            {definitions.map((def) => (
              <CustomFieldInput
                key={def.id}
                definition={def}
                value={customFields[def.field_key]}
                onChange={(val) => handleCustomFieldChange(def.field_key, val)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 pb-8 pt-3">
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className="items-center rounded-xl bg-indigo-600 py-3.5 active:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {mode === "create" ? "Create Contact" : "Save Changes"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
