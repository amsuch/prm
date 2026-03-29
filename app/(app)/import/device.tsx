import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSession } from "@/lib/auth/ctx";
import {
  isDeviceContactsAvailable,
  requestContactsPermission,
  checkContactsPermission,
  loadAllDeviceContacts,
  importDeviceContacts,
  type DeviceContact,
  type DeviceImportProgress,
} from "@/lib/contacts";
import { DeviceContactList } from "@/components/DeviceContactList";
import { ImportProgress } from "@/components/ImportProgress";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

type Step = "permission" | "loading" | "select" | "importing" | "complete";

export default function DeviceContactsScreen() {
  const { session } = useSession();
  const [step, setStep] = useState<Step>("permission");
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<DeviceImportProgress>({
    current: 0,
    total: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");

  // Check if we're on web
  if (!isDeviceContactsAvailable()) {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        <EmptyState
          icon="phone-portrait-outline"
          title="Mobile Only Feature"
          subtitle="Device contacts import is only available on iOS and Android devices. Use the LinkedIn CSV import to add contacts from a web browser."
          ctaLabel="Import CSV Instead"
          onCtaPress={() => router.replace("/(app)/import/csv")}
        />
      </View>
    );
  }

  // Check permission on mount
  useEffect(() => {
    checkInitialPermission();
  }, []);

  const checkInitialPermission = async () => {
    const status = await checkContactsPermission();
    setPermissionStatus(status);
    if (status === "granted") {
      loadContacts();
    }
  };

  const handleRequestPermission = useCallback(async () => {
    setError(null);
    const granted = await requestContactsPermission();
    if (granted) {
      setPermissionStatus("granted");
      loadContacts();
    } else {
      setPermissionStatus("denied");
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setStep("loading");
    setError(null);

    try {
      const deviceContacts = await loadAllDeviceContacts();
      setContacts(deviceContacts);
      // Select all by default
      setSelectedIds(new Set(deviceContacts.map((c) => c.id)));
      setStep("select");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load device contacts.",
      );
      setStep("permission");
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(contacts.map((c) => c.id)));
  }, [contacts]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleStartImport = useCallback(async () => {
    if (!session?.user?.id || selectedIds.size === 0) return;

    const selected = contacts.filter((c) => selectedIds.has(c.id));
    setStep("importing");
    setProgress({
      current: 0,
      total: selected.length,
      imported: 0,
      skipped: 0,
      errors: [],
    });

    try {
      const result = await importDeviceContacts(
        selected,
        session.user.id,
        (p) => setProgress({ ...p }),
      );

      setProgress({
        current: result.total,
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      });
      setStep("complete");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import failed unexpectedly.",
      );
      setStep("select");
    }
  }, [contacts, selectedIds, session?.user?.id]);

  const handleReset = useCallback(() => {
    setStep("select");
    setProgress({
      current: 0,
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
    });
    setError(null);
  }, []);

  // Permission request screen
  if (step === "permission" && permissionStatus !== "granted") {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-sm items-center">
            <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
              <Ionicons
                name="people-circle-outline"
                size={48}
                color="#2563eb"
              />
            </View>

            <Text className="text-center text-xl font-bold text-stone-900 dark:text-stone-100">
              Import Device Contacts
            </Text>

            <Text className="mt-2 text-center text-sm leading-5 text-stone-500 dark:text-stone-400">
              We need access to your contacts to import them into the app.
              You can select which contacts to import.
            </Text>

            {permissionStatus === "denied" ? (
              <>
                <View className="mt-6 w-full rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color="#d97706"
                    />
                    <Text className="flex-1 text-sm font-medium text-amber-800">
                      Permission Denied
                    </Text>
                  </View>
                  <Text className="mt-2 text-xs leading-4 text-amber-700">
                    Contact access was denied. Please enable it in your device
                    settings to use this feature.
                  </Text>
                </View>

                <Pressable
                  className="mt-6 w-full flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 active:bg-indigo-700"
                  onPress={() => Linking.openSettings()}
                >
                  <Ionicons name="settings-outline" size={20} color="white" />
                  <Text className="text-base font-semibold text-white">
                    Open Settings
                  </Text>
                </Pressable>

                <Pressable
                  className="mt-3 w-full flex-row items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-4 active:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:active:bg-stone-700"
                  onPress={handleRequestPermission}
                >
                  <Ionicons name="refresh-outline" size={20} color="#2563eb" />
                  <Text className="text-base font-semibold text-indigo-600">
                    Try Again
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View className="mt-6 w-full rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
                  <PermissionFeature
                    icon="shield-checkmark-outline"
                    title="Privacy First"
                    description="Your contacts never leave your device without your explicit selection"
                  />
                  <PermissionFeature
                    icon="checkmark-circle-outline"
                    title="Selective Import"
                    description="Choose exactly which contacts you want to import"
                  />
                  <PermissionFeature
                    icon="copy-outline"
                    title="Duplicate Detection"
                    description="We check for existing contacts to avoid duplicates"
                  />
                </View>

                <Pressable
                  className="mt-6 w-full flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 active:bg-indigo-700"
                  onPress={handleRequestPermission}
                >
                  <Ionicons name="lock-open-outline" size={20} color="white" />
                  <Text className="text-base font-semibold text-white">
                    Grant Access
                  </Text>
                </Pressable>
              </>
            )}

            {error && (
              <View className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
                <Text className="text-sm text-red-700 dark:text-red-400">{error}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Loading contacts
  if (step === "loading") {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        <LoadingSpinner message="Loading device contacts..." />
      </View>
    );
  }

  // Select contacts
  if (step === "select") {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        {error && (
          <View className="border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
            <Text className="text-sm text-red-700 dark:text-red-400">{error}</Text>
          </View>
        )}

        <DeviceContactList
          contacts={contacts}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />

        {/* Import button */}
        <View className="border-t border-stone-200 bg-white px-4 pb-8 pt-4 dark:border-stone-800 dark:bg-stone-900">
          <Pressable
            className={`flex-row items-center justify-center gap-2 rounded-xl py-4 ${
              selectedIds.size > 0
                ? "bg-indigo-600 active:bg-indigo-700"
                : "bg-stone-300 dark:bg-stone-700"
            }`}
            onPress={handleStartImport}
            disabled={selectedIds.size === 0}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="white" />
            <Text className="text-base font-semibold text-white">
              Import {selectedIds.size} Contact
              {selectedIds.size !== 1 ? "s" : ""}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Importing / Complete
  return (
    <View className="flex-1 bg-stone-50 dark:bg-stone-950">
      <View className="flex-1 p-4">
        <ImportProgress
          progress={progress}
          label="Importing device contacts..."
        />

        {step === "complete" && (
          <View className="mt-6 gap-3">
            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 active:bg-indigo-700"
              onPress={() => router.replace("/(app)/(tabs)/contacts")}
            >
              <Ionicons name="people-outline" size={20} color="white" />
              <Text className="text-base font-semibold text-white">
                View Contacts
              </Text>
            </Pressable>

            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-4 active:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:active:bg-stone-700"
              onPress={handleReset}
            >
              <Ionicons name="refresh-outline" size={20} color="#2563eb" />
              <Text className="text-base font-semibold text-indigo-600">
                Import More Contacts
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// --- Sub-components ---

function PermissionFeature({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View className="mb-3 flex-row last:mb-0">
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950">
        <Ionicons name={icon} size={18} color="#2563eb" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-stone-900 dark:text-stone-100">{title}</Text>
        <Text className="text-xs text-stone-500 dark:text-stone-400">{description}</Text>
      </View>
    </View>
  );
}
