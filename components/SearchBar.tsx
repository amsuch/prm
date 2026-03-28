import { View, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search contacts...",
}: SearchBarProps) {
  return (
    <View className="mx-4 mt-3 mb-2 flex-row items-center rounded-xl bg-white px-3 py-2 shadow-sm">
      <Ionicons name="search" size={18} color={Colors.gray[400]} />
      <TextInput
        className="ml-2 flex-1 text-base text-stone-900"
        placeholder={placeholder}
        placeholderTextColor={Colors.gray[400]}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          className="ml-1 rounded-full bg-stone-100 p-1 active:bg-stone-200"
          hitSlop={8}
        >
          <Ionicons name="close" size={14} color={Colors.gray[500]} />
        </Pressable>
      )}
    </View>
  );
}
