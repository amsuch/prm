import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import { useSession } from "@/lib/auth/ctx";
import {
  parseCSV,
  autoMapColumns,
  importContacts,
  readFileWeb,
  type ParsedCSV,
  type ColumnMapping,
  type ImportProgress as ImportProgressType,
} from "@/lib/csv";
import { CSVPreview } from "@/components/CSVPreview";
import { ColumnMapper } from "@/components/ColumnMapper";
import { ImportProgress } from "@/components/ImportProgress";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorFallback } from "@/components/ErrorBoundary";

type Step = "pick" | "preview" | "importing" | "complete";

export default function CSVImportScreen() {
  const { session } = useSession();
  const [step, setStep] = useState<Step>("pick");
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    first_name: null,
    last_name: null,
    email: null,
    company: null,
    job_title: null,
    connected_on: null,
    linkedin_url: null,
    phone: null,
    notes: null,
  });
  const [progress, setProgress] = useState<ImportProgressType>({
    current: 0,
    total: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const handlePickFile = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      let csvText: string;
      let pickedFileName: string;

      if (Platform.OS === "web") {
        // Web: use native file input
        const result = await pickFileWeb();
        if (!result) {
          setIsLoading(false);
          return;
        }
        csvText = result.text;
        pickedFileName = result.name;
      } else {
        // Native: use expo-document-picker
        const result = await DocumentPicker.getDocumentAsync({
          type: ["text/csv", "text/comma-separated-values", "application/csv", "*/*"],
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets?.[0]) {
          setIsLoading(false);
          return;
        }

        const asset = result.assets[0];
        pickedFileName = asset.name;

        // Read file content
        const content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        csvText = content;
      }

      // Parse CSV
      const parsed = parseCSV(csvText);

      if (parsed.totalRows === 0) {
        setError("The CSV file appears to be empty.");
        setIsLoading(false);
        return;
      }

      if (parsed.headers.length === 0) {
        setError("No column headers found in the CSV file.");
        setIsLoading(false);
        return;
      }

      // Auto-map columns
      const autoMapped = autoMapColumns(parsed.headers);

      setParsedData(parsed);
      setMapping(autoMapped);
      setFileName(pickedFileName);
      setStep("preview");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to read the CSV file.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStartImport = useCallback(async () => {
    if (!parsedData || !session?.user?.id) return;

    if (!mapping.first_name) {
      Alert.alert(
        "Missing Required Mapping",
        "Please map the First Name column before importing.",
      );
      return;
    }

    setStep("importing");
    setProgress({
      current: 0,
      total: parsedData.totalRows,
      imported: 0,
      skipped: 0,
      errors: [],
    });

    try {
      const result = await importContacts(
        parsedData.rows,
        mapping,
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
      setStep("preview");
    }
  }, [parsedData, mapping, session?.user?.id]);

  const handleReset = useCallback(() => {
    setStep("pick");
    setParsedData(null);
    setMapping({
      first_name: null,
      last_name: null,
      email: null,
      company: null,
      job_title: null,
      connected_on: null,
      linkedin_url: null,
      phone: null,
      notes: null,
    });
    setProgress({
      current: 0,
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
    });
    setError(null);
    setFileName("");
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        <LoadingSpinner message="Reading file..." />
      </View>
    );
  }

  if (error && step === "pick") {
    return (
      <View className="flex-1 bg-stone-50 dark:bg-stone-950">
        <ErrorFallback message={error} onRetry={handleReset} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-stone-50 dark:bg-stone-950">
      {/* Step indicator */}
      <View className="border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
        <StepIndicator
          currentStep={step}
          steps={[
            { key: "pick", label: "Select File" },
            { key: "preview", label: "Map Columns" },
            { key: "importing", label: "Import" },
            { key: "complete", label: "Done" },
          ]}
        />
      </View>

      {step === "pick" && (
        <PickFileStep onPickFile={handlePickFile} />
      )}

      {step === "preview" && parsedData && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-32"
          showsVerticalScrollIndicator={false}
        >
          {/* File info */}
          <View className="mb-4 flex-row items-center rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-900">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Ionicons name="document-text" size={22} color="#10b981" />
            </View>
            <View className="flex-1">
              <Text
                className="text-sm font-medium text-stone-900 dark:text-stone-100"
                numberOfLines={1}
              >
                {fileName}
              </Text>
              <Text className="text-xs text-stone-500 dark:text-stone-400">
                {parsedData.totalRows} rows, {parsedData.headers.length} columns
              </Text>
            </View>
            <Pressable
              className="rounded-md p-2 active:bg-stone-100 dark:active:bg-stone-700"
              onPress={handleReset}
            >
              <Ionicons name="close-circle-outline" size={22} color="#9ca3af" />
            </Pressable>
          </View>

          {/* Error banner */}
          {error && (
            <View className="mb-4 flex-row items-center rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text className="ml-2 flex-1 text-sm text-red-700 dark:text-red-400">{error}</Text>
            </View>
          )}

          {/* Preview */}
          <View className="mb-4">
            <CSVPreview
              headers={parsedData.headers}
              rows={parsedData.rows}
              maxRows={5}
            />
          </View>

          {/* Column mapper */}
          <View className="mb-4">
            <ColumnMapper
              headers={parsedData.headers}
              mapping={mapping}
              onMappingChange={setMapping}
            />
          </View>

          {/* Import button */}
          <Pressable
            className={`flex-row items-center justify-center gap-2 rounded-xl py-4 ${
              mapping.first_name
                ? "bg-indigo-600 active:bg-indigo-700"
                : "bg-stone-300 dark:bg-stone-700"
            }`}
            onPress={handleStartImport}
            disabled={!mapping.first_name}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="white" />
            <Text className="text-base font-semibold text-white">
              Import {parsedData.totalRows} Contacts
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {(step === "importing" || step === "complete") && (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-32"
          showsVerticalScrollIndicator={false}
        >
          <ImportProgress progress={progress} label="Importing CSV contacts..." />

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
                <Ionicons name="cloud-upload-outline" size={20} color="#2563eb" />
                <Text className="text-base font-semibold text-indigo-600">
                  Import Another File
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// --- Sub-components ---

function PickFileStep({ onPickFile }: { onPickFile: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="w-full max-w-sm items-center">
        {/* Icon */}
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
          <Ionicons name="document-text-outline" size={48} color="#2563eb" />
        </View>

        <Text className="text-center text-xl font-bold text-stone-900 dark:text-stone-100">
          Import LinkedIn CSV
        </Text>
        <Text className="mt-2 text-center text-sm leading-5 text-stone-500 dark:text-stone-400">
          Export your connections from LinkedIn, then upload the CSV file here.
          We will automatically detect and map the columns.
        </Text>

        {/* Steps */}
        <View className="mt-6 w-full rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
          <InstructionStep
            number={1}
            text='Go to LinkedIn > My Network > Connections > "Export connections"'
          />
          <InstructionStep
            number={2}
            text="Download the CSV file to your device"
          />
          <InstructionStep
            number={3}
            text="Tap the button below to select the file"
          />
        </View>

        {/* Pick button */}
        <Pressable
          className="mt-6 w-full flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 active:bg-indigo-700"
          onPress={onPickFile}
        >
          <Ionicons name="folder-open-outline" size={20} color="white" />
          <Text className="text-base font-semibold text-white">
            Select CSV File
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InstructionStep({ number, text }: { number: number; text: string }) {
  return (
    <View className="mb-3 flex-row last:mb-0">
      <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-indigo-600">
        <Text className="text-xs font-bold text-white">{number}</Text>
      </View>
      <Text className="flex-1 text-sm leading-5 text-stone-600 dark:text-stone-400">{text}</Text>
    </View>
  );
}

type StepConfig = { key: string; label: string };

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: string;
  steps: StepConfig[];
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <View className="flex-row items-center justify-between">
      {steps.map((s, idx) => {
        const isActive = idx === currentIndex;
        const isComplete = idx < currentIndex;

        return (
          <View key={s.key} className="flex-1 items-center">
            <View className="flex-row items-center">
              {idx > 0 && (
                <View
                  className={`h-0.5 w-full flex-1 ${
                    isComplete || isActive ? "bg-indigo-600" : "bg-stone-200 dark:bg-stone-700"
                  }`}
                />
              )}
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  isComplete
                    ? "bg-indigo-600"
                    : isActive
                      ? "border-2 border-indigo-600 bg-white dark:bg-stone-900"
                      : "border-2 border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
                }`}
              >
                {isComplete ? (
                  <Ionicons name="checkmark" size={14} color="white" />
                ) : (
                  <Text
                    className={`text-xs font-bold ${
                      isActive ? "text-indigo-600" : "text-stone-400 dark:text-stone-500"
                    }`}
                  >
                    {idx + 1}
                  </Text>
                )}
              </View>
              {idx < steps.length - 1 && (
                <View
                  className={`h-0.5 w-full flex-1 ${
                    isComplete ? "bg-indigo-600" : "bg-stone-200 dark:bg-stone-700"
                  }`}
                />
              )}
            </View>
            <Text
              className={`mt-1 text-center text-xs ${
                isActive ? "font-semibold text-indigo-600" : "text-stone-400 dark:text-stone-500"
              }`}
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Web file picker helper
function pickFileWeb(): Promise<{ text: string; name: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv,text/comma-separated-values";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await readFileWeb(file);
        resolve({ text, name: file.name });
      } catch {
        resolve(null);
      }
    };

    // Handle cancel
    input.addEventListener("cancel", () => resolve(null));

    input.click();
  });
}
