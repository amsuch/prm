import { Platform } from "react-native";

export const Shadows = {
  none: {},

  xs: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: { boxShadow: "0 1px 2px rgba(0,0,0,0.03)" },
  }),

  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    default: {
      boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
    },
  }),

  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {
      boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)",
    },
  }),

  lg: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {
      boxShadow: "0 10px 15px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.03)",
    },
  }),
} as const;
