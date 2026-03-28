import { useState } from "react";
import { View, Text, Image } from "react-native";
import { getInitials } from "@/lib/utils";
import { AvatarColors } from "@/constants/colors";

type AvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
};

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AvatarColors[Math.abs(hash) % AvatarColors.length];
}

const SIZE_CONFIG = {
  xs: { container: "h-7 w-7", text: "text-xs", image: "h-7 w-7" },
  sm: { container: "h-9 w-9", text: "text-sm", image: "h-9 w-9" },
  md: { container: "h-10 w-10", text: "text-sm", image: "h-10 w-10" },
  lg: { container: "h-14 w-14", text: "text-lg", image: "h-14 w-14" },
  xl: { container: "h-20 w-20", text: "text-2xl", image: "h-20 w-20" },
} as const;

export function Avatar({
  firstName,
  lastName,
  imageUrl,
  size = "md",
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "?";
  const initials = getInitials(firstName, lastName);
  const avatarBg = getAvatarColor(fullName);
  const config = SIZE_CONFIG[size];
  const showImage = !!imageUrl && !imageError;

  if (showImage) {
    return (
      <Image
        source={{ uri: imageUrl! }}
        className={`${config.image} rounded-full`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      className={`${config.container} items-center justify-center rounded-full`}
      style={{ backgroundColor: avatarBg }}
    >
      <Text className={`${config.text} font-bold text-white`}>{initials}</Text>
    </View>
  );
}

export { getAvatarColor };
