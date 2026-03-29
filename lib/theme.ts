/**
 * Theme management — dark mode toggle with AsyncStorage persistence.
 *
 * Uses NativeWind's useColorScheme for the actual dark: class toggling.
 * Stores the user's preference ("light" | "dark" | "system") in AsyncStorage.
 */

import { useEffect, useState } from "react";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "prm_theme_preference";

export type ThemePreference = "light" | "dark" | "system";

/**
 * Hook for reading and setting the theme.
 *
 * Returns the current preference ("light" | "dark" | "system"),
 * the resolved scheme ("light" | "dark"), and a setter.
 */
export function useTheme() {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
        setColorScheme(stored);
      }
      setLoaded(true);
    });
  }, [setColorScheme]);

  const setTheme = (pref: ThemePreference) => {
    setPreferenceState(pref);
    setColorScheme(pref);
    AsyncStorage.setItem(THEME_KEY, pref);
  };

  return {
    /** The user's chosen preference */
    preference,
    /** The resolved color scheme ("light" or "dark") */
    colorScheme: colorScheme ?? "light",
    /** Whether the stored preference has been loaded */
    loaded,
    /** Set the theme preference and persist it */
    setTheme,
  };
}
