import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

export type ToolProgressItem = {
  name: string;
  status: "running" | "done" | "error";
  arguments?: Record<string, unknown>;
  result?: unknown;
};

export const TOOL_ICONS: Record<string, { icon: string; label: string }> = {
  search_contacts: { icon: "search", label: "Searching contacts" },
  get_contact_details: { icon: "person", label: "Getting contact details" },
  get_interactions: { icon: "chatbubbles", label: "Looking up interactions" },
  get_network_stats: { icon: "stats-chart", label: "Calculating stats" },
  get_relationships: { icon: "git-network", label: "Finding relationships" },
  list_tags: { icon: "pricetags", label: "Listing tags" },
  list_entities: { icon: "business", label: "Listing entities" },
  run_sql_query: { icon: "code-slash", label: "Running query" },
  create_contact: { icon: "person-add", label: "Creating contact" },
  update_contact: { icon: "create", label: "Updating contact" },
  bulk_tag_contacts: { icon: "pricetag", label: "Tagging contacts" },
  archive_contacts: { icon: "archive", label: "Archiving contacts" },
  link_contacts: { icon: "link", label: "Linking contacts" },
  create_entity: { icon: "business", label: "Creating entity" },
  add_entity_person: { icon: "person-add", label: "Adding person" },
  log_interaction: { icon: "chatbubble", label: "Logging interaction" },
};

export function ToolProgressList({
  progress,
}: {
  progress: ToolProgressItem[];
}) {
  return (
    <View className="mb-2">
      {progress.map((tp, index) => {
        const toolInfo = TOOL_ICONS[tp.name] ?? {
          icon: "ellipse",
          label: tp.name,
        };
        const statusIcon =
          tp.status === "done"
            ? "checkmark-circle"
            : tp.status === "error"
              ? "alert-circle"
              : "ellipsis-horizontal-circle";
        const statusColor =
          tp.status === "done"
            ? Colors.success
            : tp.status === "error"
              ? Colors.error
              : Colors.gray[400];

        // Extract a summary from arguments for context
        let detail = "";
        if (tp.arguments) {
          if (tp.arguments.query)
            detail = ` "${tp.arguments.query}"`;
          else if (tp.arguments.first_name)
            detail = ` ${tp.arguments.first_name}`;
          else if (tp.arguments.tag)
            detail = ` "${tp.arguments.tag}"`;
          else if (tp.arguments.name)
            detail = ` "${tp.arguments.name}"`;
        }

        return (
          <View key={`${tp.name}-${index}`} className="mt-1 flex-row items-center">
            <Ionicons
              name={statusIcon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={statusColor}
            />
            <Ionicons
              name={toolInfo.icon as keyof typeof Ionicons.glyphMap}
              size={13}
              color={Colors.gray[500]}
              style={{ marginLeft: 4 }}
            />
            <Text className="ml-1.5 text-xs text-stone-500 dark:text-stone-400" numberOfLines={1}>
              {toolInfo.label}
              {detail}
              {tp.status === "running" ? "..." : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
