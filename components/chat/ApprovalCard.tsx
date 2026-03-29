import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { Avatar } from "@/components/Avatar";
import type { ActionType, PendingAction } from "@/lib/agent";
import { TOOL_ICONS } from "./ToolProgress";

export function AgentApprovalCard({
  description,
  toolName,
  preview,
  onApprove,
  onReject,
}: {
  description: string;
  toolName: string;
  preview: unknown;
  onApprove: () => void;
  onReject: () => void;
}) {
  const toolInfo = TOOL_ICONS[toolName] ?? {
    icon: "alert-circle",
    label: toolName,
  };

  return (
    <View className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3">
      {/* Header */}
      <View className="mb-2 flex-row items-center">
        <Ionicons
          name={toolInfo.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color="#d97706"
        />
        <Text className="ml-2 text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
          Pending Action
        </Text>
      </View>

      {/* Description */}
      <Text className="mb-1 text-sm font-medium text-stone-800 dark:text-stone-200">
        {description}
      </Text>

      {/* Preview details */}
      {preview != null && typeof preview === "object" ? (
        <View className="mb-2 rounded-lg bg-white dark:bg-stone-800 p-2">
          {Object.entries(preview as Record<string, unknown>)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .slice(0, 6)
            .map(([key, value]) => (
              <View key={key} className="flex-row py-0.5">
                <Text className="w-24 text-xs font-medium text-stone-400 dark:text-stone-500">
                  {key.replace(/_/g, " ")}:
                </Text>
                <Text className="flex-1 text-xs text-stone-700 dark:text-stone-300" numberOfLines={1}>
                  {String(value)}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      {/* Approve / Cancel buttons */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={onApprove}
          className="flex-1 flex-row items-center justify-center rounded-lg bg-green-600 py-2.5 active:bg-green-700"
        >
          <Ionicons name="checkmark" size={16} color="white" />
          <Text className="ml-1 text-sm font-semibold text-white">
            Approve
          </Text>
        </Pressable>
        <Pressable
          onPress={onReject}
          className="flex-1 flex-row items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 py-2.5 active:bg-stone-50 dark:active:bg-stone-700"
        >
          <Ionicons name="close" size={16} color={Colors.gray[500]} />
          <Text className="ml-1 text-sm font-semibold text-stone-600 dark:text-stone-400">
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PendingActionCard({
  pendingAction,
  onApprove,
  onReject,
}: {
  pendingAction: PendingAction;
  onApprove?: (pendingAction: PendingAction) => void;
  onReject?: () => void;
}) {
  const { preview } = pendingAction;

  const iconMap: Record<ActionType, { icon: string; color: string; bg: string; border: string }> = {
    add: { icon: "add-circle", color: "#10b981", bg: "bg-green-50 dark:bg-green-950", border: "border-green-200 dark:border-green-800" },
    update: { icon: "create", color: "#3b82f6", bg: "bg-indigo-50 dark:bg-indigo-950", border: "border-indigo-200 dark:border-indigo-800" },
    bulk_tag: { icon: "pricetag", color: "#3b82f6", bg: "bg-indigo-50 dark:bg-indigo-950", border: "border-indigo-200 dark:border-indigo-800" },
    bulk_update: { icon: "create", color: "#3b82f6", bg: "bg-indigo-50 dark:bg-indigo-950", border: "border-indigo-200 dark:border-indigo-800" },
    archive: { icon: "archive", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950", border: "border-amber-200 dark:border-amber-800" },
    enrich: { icon: "search", color: "#8b5cf6", bg: "bg-purple-50 dark:bg-purple-950", border: "border-purple-200 dark:border-purple-800" },
    link: { icon: "link", color: "#0891b2", bg: "bg-cyan-50 dark:bg-cyan-950", border: "border-cyan-200 dark:border-cyan-800" },
    create_entity: { icon: "business", color: "#10b981", bg: "bg-green-50 dark:bg-green-950", border: "border-green-200 dark:border-green-800" },
    add_entity_person: { icon: "person-add", color: "#3b82f6", bg: "bg-indigo-50 dark:bg-indigo-950", border: "border-indigo-200 dark:border-indigo-800" },
    promote_person: { icon: "arrow-up-circle", color: "#8b5cf6", bg: "bg-purple-50 dark:bg-purple-950", border: "border-purple-200 dark:border-purple-800" },
  };

  const config = iconMap[preview.actionType];

  return (
    <View className={`mt-3 rounded-xl border ${config.border} ${config.bg} p-3`}>
      {/* Header */}
      <View className="mb-2 flex-row items-center">
        <Ionicons
          name={config.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={config.color}
        />
        <Text className="ml-2 text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
          Pending Action
        </Text>
      </View>

      {/* Description */}
      <Text className="mb-1 text-sm font-medium text-stone-800 dark:text-stone-200">
        {preview.description}
      </Text>
      {preview.details && (
        <Text className="mb-2 text-xs text-stone-500 dark:text-stone-400">{preview.details}</Text>
      )}

      {/* Total count -- prominent for large sets */}
      {preview.totalCount > 5 && (
        <View className="mb-2 flex-row items-center rounded-lg bg-white dark:bg-stone-800 px-3 py-2">
          <Ionicons name="alert-circle" size={16} color={config.color} />
          <Text className="ml-2 text-sm font-bold text-stone-800 dark:text-stone-200">
            {preview.totalCount.toLocaleString()} contacts
          </Text>
          <Text className="ml-1 text-sm text-stone-500 dark:text-stone-400">will be affected</Text>
        </View>
      )}

      {/* Affected contacts preview */}
      {preview.affectedContacts.length > 0 && (
        <View className="mb-3 rounded-lg bg-white dark:bg-stone-800 p-2">
          <Text className="mb-1 text-xs font-medium text-stone-400 dark:text-stone-500">
            {preview.totalCount <= 5
              ? `${preview.totalCount} contact${preview.totalCount === 1 ? "" : "s"} affected:`
              : `Showing ${Math.min(preview.affectedContacts.length, 5)} of ${preview.totalCount.toLocaleString()}:`}
          </Text>
          {preview.affectedContacts.slice(0, 5).map((contact) => {
            const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
            return (
              <View key={contact.id} className="mt-1 flex-row items-center py-1">
                <Avatar
                  firstName={contact.first_name}
                  lastName={contact.last_name}
                  size="xs"
                />
                <Text className="ml-2 text-xs text-stone-700 dark:text-stone-300" numberOfLines={1}>
                  {fullName}
                  {contact.company ? ` - ${contact.company}` : ""}
                </Text>
              </View>
            );
          })}
          {preview.totalCount > 5 && (
            <Text className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              +{(preview.totalCount - 5).toLocaleString()} more
            </Text>
          )}
        </View>
      )}

      {/* Approve / Cancel buttons */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => onApprove?.(pendingAction)}
          className="flex-1 flex-row items-center justify-center rounded-lg bg-green-600 py-2.5 active:bg-green-700"
        >
          <Ionicons name="checkmark" size={16} color="white" />
          <Text className="ml-1 text-sm font-semibold text-white">Approve</Text>
        </Pressable>
        <Pressable
          onPress={() => onReject?.()}
          className="flex-1 flex-row items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 py-2.5 active:bg-stone-50 dark:active:bg-stone-700"
        >
          <Ionicons name="close" size={16} color={Colors.gray[500]} />
          <Text className="ml-1 text-sm font-semibold text-stone-600 dark:text-stone-400">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
