import { useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

type DateTimePickerProps = {
  value: string; // ISO string
  onChange: (isoString: string) => void;
};

/**
 * Cross-platform date/time picker.
 * On web: uses native <input type="datetime-local" />.
 * On native: uses editable text inputs for date and time.
 */
export function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const date = new Date(value);

  if (Platform.OS === "web") {
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const localISO = toLocalDatetimeString(date);

    return (
      <View className="rounded-xl bg-white px-3 py-3 shadow-sm dark:bg-stone-900">
        <input
          type="datetime-local"
          value={localISO}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const newDate = new Date(e.target.value);
            if (!isNaN(newDate.getTime())) {
              onChange(newDate.toISOString());
            }
          }}
          style={{
            fontSize: 16,
            fontFamily: "inherit",
            color: "inherit",
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            width: "100%",
            padding: 0,
          }}
        />
      </View>
    );
  }

  // Native fallback: editable date and time text inputs
  return <NativeDateTimePicker date={date} onChange={onChange} />;
}

function NativeDateTimePicker({
  date,
  onChange,
}: {
  date: Date;
  onChange: (isoString: string) => void;
}) {
  const [dateText, setDateText] = useState(formatDateOnly(date));
  const [timeText, setTimeText] = useState(formatTimeOnly(date));
  const [dateError, setDateError] = useState(false);
  const [timeError, setTimeError] = useState(false);

  const handleDateBlur = () => {
    const parsed = parseDate(dateText);
    if (parsed) {
      setDateError(false);
      const newDate = new Date(date);
      newDate.setFullYear(parsed.year, parsed.month - 1, parsed.day);
      onChange(newDate.toISOString());
    } else {
      setDateError(true);
    }
  };

  const handleTimeBlur = () => {
    const parsed = parseTime(timeText);
    if (parsed) {
      setTimeError(false);
      const newDate = new Date(date);
      newDate.setHours(parsed.hours, parsed.minutes, 0, 0);
      onChange(newDate.toISOString());
    } else {
      setTimeError(true);
    }
  };

  const setToNow = () => {
    const now = new Date();
    setDateText(formatDateOnly(now));
    setTimeText(formatTimeOnly(now));
    onChange(now.toISOString());
    setDateError(false);
    setTimeError(false);
  };

  return (
    <View className="rounded-xl bg-white p-3 shadow-sm dark:bg-stone-900">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Text className="mb-1 text-xs text-stone-400 dark:text-stone-500">Date</Text>
          <TextInput
            className={`rounded-lg border px-3 py-2 text-sm text-stone-900 dark:text-stone-100 ${
              dateError
                ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                : "border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
            }`}
            value={dateText}
            onChangeText={setDateText}
            onBlur={handleDateBlur}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={Colors.gray[400]}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-xs text-stone-400 dark:text-stone-500">Time</Text>
          <TextInput
            className={`rounded-lg border px-3 py-2 text-sm text-stone-900 dark:text-stone-100 ${
              timeError
                ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                : "border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
            }`}
            value={timeText}
            onChangeText={setTimeText}
            onBlur={handleTimeBlur}
            placeholder="HH:MM AM"
            placeholderTextColor={Colors.gray[400]}
          />
        </View>
      </View>
      <Pressable
        onPress={setToNow}
        className="mt-2 flex-row items-center self-end rounded-lg bg-stone-100 px-2.5 py-1 active:bg-stone-200 dark:bg-stone-800 dark:active:bg-stone-700"
      >
        <Ionicons name="time-outline" size={14} color={Colors.gray[500]} />
        <Text className="ml-1 text-xs font-medium text-stone-500 dark:text-stone-400">
          Set to Now
        </Text>
      </Pressable>
    </View>
  );
}

// --- Helpers ---

function toLocalDatetimeString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function formatDateOnly(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTimeOnly(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function parseDate(text: string): { year: number; month: number; day: number } | null {
  // Try MM/DD/YYYY or M/D/YYYY
  const match = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  return { year, month, day };
}

function parseTime(text: string): { hours: number; minutes: number } | null {
  // Try "H:MM AM/PM" or "HH:MM" (24h)
  const match12 = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  }
  // Try 24h format
  const match24 = text.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }
  return null;
}
