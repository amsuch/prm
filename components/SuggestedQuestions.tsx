import { ScrollView, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";

type SuggestedQuestionsProps = {
  onSelect: (question: string) => void;
};

const SUGGESTIONS = [
  "How many contacts do I have?",
  "Add a new contact",
  "Who haven't I contacted in 30 days?",
  "Tag everyone at Google as tech",
  "Who do I know at Google?",
  "Show contacts tagged VIP",
  "Archive stale contacts",
  "When did I last talk to John?",
  "Link John and Jane as colleagues",
  "Enrich John's profile",
  "Who is connected to Sarah?",
  "Update John's company to Acme",
  "Who works at Apple?",
];

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
      }}
    >
      {SUGGESTIONS.map((question) => (
        <Pressable
          key={question}
          onPress={() => onSelect(question)}
          className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 active:bg-brand-100"
        >
          <Text className="text-sm font-medium text-brand-700">
            {question}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
