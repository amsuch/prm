import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getInitials, formatRelativeTime, formatDate } from "@/lib/utils";
import { Colors } from "@/constants/colors";
import type {
  AgentResponse,
  AgentResultContact,
  ActionType,
  PendingAction,
  InteractionResult,
  RelationshipResult,
  StatsResult,
} from "@/lib/agent";
import type { ToolCall } from "@/lib/agentLoop";

type ToolProgress = {
  name: string;
  status: "running" | "done" | "error";
  arguments?: Record<string, unknown>;
  result?: unknown;
};

type ChatBubbleProps = {
  role: "user" | "agent";
  text: string;
  response?: AgentResponse;
  isLoading?: boolean;
  toolProgress?: ToolProgress[];
  pendingApproval?: {
    toolCall: ToolCall;
    toolName: string;
    description: string;
    preview: unknown;
  };
  onApprove?: (pendingAction?: PendingAction) => void;
  onReject?: () => void;
};

const AVATAR_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#16a34a", "#0891b2", "#4f46e5", "#c026d3",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ChatBubble({
  role,
  text,
  response,
  isLoading,
  toolProgress,
  pendingApproval,
  onApprove,
  onReject,
}: ChatBubbleProps) {
  if (role === "user") {
    return (
      <View className="mb-3 flex-row justify-end px-4">
        <View className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3">
          <Text className="text-base text-white">{text}</Text>
        </View>
      </View>
    );
  }

  // Agent message
  return (
    <View className="mb-3 px-4">
      <View className="max-w-[90%] rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
        {isLoading ? (
          <View>
            {/* Tool progress indicators */}
            {toolProgress && toolProgress.length > 0 ? (
              <ToolProgressList progress={toolProgress} />
            ) : (
              <View className="flex-row items-center">
                <View className="mr-2 h-2 w-2 rounded-full bg-gray-300" />
                <View className="mr-2 h-2 w-2 rounded-full bg-gray-400" />
                <View className="h-2 w-2 rounded-full bg-gray-500" />
                <Text className="ml-3 text-sm text-gray-400">
                  Thinking...
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Show completed tool progress above the final text */}
            {toolProgress && toolProgress.length > 0 && !pendingApproval && (
              <ToolProgressList progress={toolProgress} />
            )}
            <Text className="text-base text-gray-900">{text}</Text>
            {/* Pending approval card from the agent loop */}
            {pendingApproval && (
              <AgentApprovalCard
                description={pendingApproval.description}
                toolName={pendingApproval.toolName}
                preview={pendingApproval.preview}
                onApprove={() => onApprove?.()}
                onReject={() => onReject?.()}
              />
            )}
            {/* Legacy response content rendering */}
            {response && (
              <ResponseContent
                response={response}
                onApprove={onApprove}
                onReject={onReject}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tool progress list — shows tool calls as they happen
// ---------------------------------------------------------------------------

const TOOL_ICONS: Record<string, { icon: string; label: string }> = {
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

function ToolProgressList({ progress }: { progress: ToolProgress[] }) {
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
            ? "#10b981"
            : tp.status === "error"
              ? "#ef4444"
              : "#9ca3af";

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
              color="#6b7280"
              style={{ marginLeft: 4 }}
            />
            <Text className="ml-1.5 text-xs text-gray-500" numberOfLines={1}>
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

// ---------------------------------------------------------------------------
// Agent approval card — for LLM tool-calling approval flow
// ---------------------------------------------------------------------------

function AgentApprovalCard({
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
    <View className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      {/* Header */}
      <View className="mb-2 flex-row items-center">
        <Ionicons
          name={toolInfo.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color="#d97706"
        />
        <Text className="ml-2 text-xs font-semibold uppercase text-gray-500">
          Pending Action
        </Text>
      </View>

      {/* Description */}
      <Text className="mb-1 text-sm font-medium text-gray-800">
        {description}
      </Text>

      {/* Preview details */}
      {preview != null && typeof preview === "object" ? (
        <View className="mb-2 rounded-lg bg-white p-2">
          {Object.entries(preview as Record<string, unknown>)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .slice(0, 6)
            .map(([key, value]) => (
              <View key={key} className="flex-row py-0.5">
                <Text className="text-xs font-medium text-gray-400 w-24">
                  {key.replace(/_/g, " ")}:
                </Text>
                <Text className="flex-1 text-xs text-gray-700" numberOfLines={1}>
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
          className="flex-1 flex-row items-center justify-center rounded-lg border border-gray-200 bg-white py-2.5 active:bg-gray-50"
        >
          <Ionicons name="close" size={16} color="#6b7280" />
          <Text className="ml-1 text-sm font-semibold text-gray-600">
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResponseContent({
  response,
  onApprove,
  onReject,
}: {
  response: AgentResponse;
  onApprove?: (pendingAction: PendingAction) => void;
  onReject?: () => void;
}) {
  switch (response.type) {
    case "contacts":
      return <ContactCards contacts={response.contacts} />;
    case "interaction":
      return response.interaction ? (
        <InteractionCard interaction={response.interaction} />
      ) : null;
    case "relationships":
      return <RelationshipCards relationships={response.relationships} />;
    case "stats":
      return <StatsCard stats={response.stats} />;
    case "action":
      return (
        <ActionCard
          actionType={response.actionType}
          count={response.count}
          contact={response.contact}
        />
      );
    case "pending_action":
      return (
        <PendingActionCard
          pendingAction={response.pendingAction}
          onApprove={onApprove}
          onReject={onReject}
        />
      );
    case "sql_result":
      return (
        <SQLResultCard
          sql={response.sql}
          rows={response.rows}
          rowCount={response.rowCount}
        />
      );
    case "text":
    case "error":
      return null;
  }
}

function SQLResultCard({
  sql,
  rows,
  rowCount,
}: {
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
}) {
  const [showSQL, setShowSQL] = useState(false);

  if (rowCount === 0) return null;

  // Get column headers from first row
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const displayRows = rows.slice(0, 20);

  return (
    <View className="mt-3">
      {/* SQL toggle */}
      <Pressable
        onPress={() => setShowSQL(!showSQL)}
        className="mb-2 flex-row items-center"
      >
        <Ionicons
          name="code-slash"
          size={13}
          color="#9ca3af"
        />
        <Text className="ml-1 text-xs text-gray-400">
          {showSQL ? "Hide SQL" : "Show SQL"} ({rowCount} row{rowCount === 1 ? "" : "s"})
        </Text>
        <Ionicons
          name={showSQL ? "chevron-up" : "chevron-down"}
          size={12}
          color="#9ca3af"
          style={{ marginLeft: 2 }}
        />
      </Pressable>

      {showSQL && (
        <View className="mb-2 rounded-lg bg-gray-800 p-3">
          <Text className="font-mono text-xs text-green-400">{sql}</Text>
        </View>
      )}

      {/* Results table */}
      <View className="overflow-hidden rounded-xl border border-gray-200">
        {/* Header */}
        <View className="flex-row bg-gray-100 px-2 py-1.5">
          {columns.map((col) => (
            <View key={col} className="flex-1 px-1">
              <Text className="text-xs font-semibold text-gray-500" numberOfLines={1}>
                {col.replace(/_/g, " ")}
              </Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {displayRows.map((row, i) => (
          <View
            key={i}
            className={`flex-row border-t border-gray-100 px-2 py-1.5 ${
              i % 2 === 0 ? "bg-white" : "bg-gray-50"
            }`}
          >
            {columns.map((col) => (
              <View key={col} className="flex-1 px-1">
                <Text className="text-xs text-gray-700" numberOfLines={2}>
                  {formatCellValue(row[col])}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {rowCount > 20 && (
          <View className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
            <Text className="text-xs text-gray-400">
              +{rowCount - 20} more rows
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (val instanceof Date) return val.toLocaleDateString();
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return new Date(val).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function ContactCards({ contacts }: { contacts: AgentResultContact[] }) {
  const router = useRouter();

  if (contacts.length === 0) return null;

  return (
    <View className="mt-3">
      {contacts.map((contact) => {
        const fullName = [contact.first_name, contact.last_name]
          .filter(Boolean)
          .join(" ");
        const initials = getInitials(contact.first_name, contact.last_name);
        const avatarBg = getAvatarColor(fullName);
        const subtitle = [contact.job_title, contact.company]
          .filter(Boolean)
          .join(" at ");

        return (
          <Pressable
            key={contact.id}
            onPress={() => router.push(`/contact/${contact.id}`)}
            className="mt-2 flex-row items-center rounded-xl border border-gray-100 bg-gray-50 p-2.5 active:bg-gray-100"
          >
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: avatarBg }}
            >
              <Text className="text-sm font-bold text-white">{initials}</Text>
            </View>
            <View className="ml-2.5 flex-1">
              <Text
                className="text-sm font-semibold text-gray-900"
                numberOfLines={1}
              >
                {fullName}
              </Text>
              {subtitle ? (
                <Text
                  className="text-xs text-gray-500"
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={Colors.gray[300]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function InteractionCard({ interaction }: { interaction: InteractionResult }) {
  const typeIcons: Record<string, string> = {
    call: "call-outline",
    email: "mail-outline",
    meeting: "people-outline",
    text: "chatbubble-outline",
    social: "share-social-outline",
    note: "document-text-outline",
    gift: "gift-outline",
    other: "ellipsis-horizontal",
  };

  const iconName = typeIcons[interaction.type] ?? "ellipsis-horizontal";
  const directionLabel =
    interaction.direction === "inbound"
      ? "Incoming"
      : interaction.direction === "outbound"
        ? "Outgoing"
        : "";

  return (
    <View className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <View className="flex-row items-center">
        <Ionicons
          name={iconName as keyof typeof Ionicons.glyphMap}
          size={18}
          color={Colors.brand[600]}
        />
        <Text className="ml-2 text-sm font-semibold capitalize text-gray-900">
          {interaction.type}
        </Text>
        {directionLabel ? (
          <Text className="ml-2 text-xs text-gray-400">
            ({directionLabel})
          </Text>
        ) : null}
        <Text className="ml-auto text-xs text-gray-400">
          {formatDate(interaction.occurred_at)}
        </Text>
      </View>
      {interaction.title ? (
        <Text className="mt-1.5 text-sm font-medium text-gray-800">
          {interaction.title}
        </Text>
      ) : null}
      {interaction.body ? (
        <Text className="mt-1 text-sm text-gray-600" numberOfLines={3}>
          {interaction.body}
        </Text>
      ) : null}
    </View>
  );
}

function RelationshipCards({
  relationships,
}: {
  relationships: RelationshipResult[];
}) {
  const router = useRouter();

  if (relationships.length === 0) return null;

  return (
    <View className="mt-3">
      {relationships.map((rel, index) => {
        const fullName = [rel.related_first_name, rel.related_last_name]
          .filter(Boolean)
          .join(" ");
        const initials = getInitials(
          rel.related_first_name,
          rel.related_last_name,
        );
        const avatarBg = getAvatarColor(fullName);

        return (
          <Pressable
            key={`${rel.related_contact_id}-${index}`}
            onPress={() =>
              router.push(`/contact/${rel.related_contact_id}`)
            }
            className="mt-2 flex-row items-center rounded-xl border border-gray-100 bg-gray-50 p-2.5 active:bg-gray-100"
          >
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: avatarBg }}
            >
              <Text className="text-sm font-bold text-white">{initials}</Text>
            </View>
            <View className="ml-2.5 flex-1">
              <Text
                className="text-sm font-semibold text-gray-900"
                numberOfLines={1}
              >
                {fullName}
              </Text>
              <Text className="text-xs text-gray-500">
                {rel.relationship_name}
                {rel.related_company ? ` - ${rel.related_company}` : ""}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={Colors.gray[300]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function StatsCard({ stats }: { stats: StatsResult }) {
  return (
    <View className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
      {/* Stat Rows */}
      <View className="flex-row justify-between">
        <StatItem
          icon="people"
          label="Total Contacts"
          value={stats.totalContacts.toString()}
          color={Colors.brand[600]}
        />
        <StatItem
          icon="chatbubbles"
          label="This Week"
          value={stats.contactedThisWeek.toString()}
          color={Colors.success}
        />
        <StatItem
          icon="time"
          label="Need Follow-up"
          value={stats.staleContacts.toString()}
          color={Colors.warning}
        />
      </View>

      {/* Top Companies */}
      {stats.topCompanies.length > 0 && (
        <View className="mt-3 border-t border-gray-200 pt-3">
          <Text className="mb-1.5 text-xs font-semibold uppercase text-gray-400">
            Top Companies
          </Text>
          {stats.topCompanies.map((c) => (
            <View
              key={c.company}
              className="flex-row items-center justify-between py-0.5"
            >
              <Text className="text-sm text-gray-700" numberOfLines={1}>
                {c.company}
              </Text>
              <Text className="text-sm font-medium text-gray-900">
                {c.count}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Source Breakdown */}
      {stats.sourceBreakdown.length > 0 && (
        <View className="mt-3 border-t border-gray-200 pt-3">
          <Text className="mb-1.5 text-xs font-semibold uppercase text-gray-400">
            Sources
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {stats.sourceBreakdown.map((s) => (
              <View
                key={s.source}
                className="rounded-full bg-white px-2.5 py-1"
              >
                <Text className="text-xs text-gray-600">
                  {s.source}: {s.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function ActionCard({
  actionType,
  count,
  contact,
}: {
  actionType: ActionType;
  count?: number;
  contact?: AgentResultContact;
}) {
  const router = useRouter();

  // Action type configuration
  const actionConfig: Record<
    ActionType,
    { icon: string; bgClass: string; borderClass: string; iconColor: string; label: string }
  > = {
    add: {
      icon: "checkmark-circle",
      bgClass: "bg-green-50",
      borderClass: "border-green-200",
      iconColor: "#10b981",
      label: "Contact Created",
    },
    bulk_tag: {
      icon: "pricetag",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
      iconColor: "#3b82f6",
      label: "Contacts Tagged",
    },
    bulk_update: {
      icon: "create",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
      iconColor: "#3b82f6",
      label: "Contacts Updated",
    },
    archive: {
      icon: "archive",
      bgClass: "bg-amber-50",
      borderClass: "border-amber-200",
      iconColor: "#f59e0b",
      label: "Contacts Archived",
    },
    enrich: {
      icon: "search",
      bgClass: "bg-purple-50",
      borderClass: "border-purple-200",
      iconColor: "#8b5cf6",
      label: "Contact Enrichment",
    },
    update: {
      icon: "create",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
      iconColor: "#3b82f6",
      label: "Contact Updated",
    },
    link: {
      icon: "link",
      bgClass: "bg-cyan-50",
      borderClass: "border-cyan-200",
      iconColor: "#0891b2",
      label: "Contacts Linked",
    },
    create_entity: {
      icon: "business",
      bgClass: "bg-green-50",
      borderClass: "border-green-200",
      iconColor: "#10b981",
      label: "Entity Created",
    },
    add_entity_person: {
      icon: "person-add",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
      iconColor: "#3b82f6",
      label: "Person Added",
    },
    promote_person: {
      icon: "arrow-up-circle",
      bgClass: "bg-purple-50",
      borderClass: "border-purple-200",
      iconColor: "#8b5cf6",
      label: "Person Promoted",
    },
  };

  const config = actionConfig[actionType];

  // For "add" and "enrich", show the contact card
  if ((actionType === "add" || actionType === "enrich") && contact) {
    const fullName = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");
    const initials = getInitials(contact.first_name, contact.last_name);
    const avatarBg = getAvatarColor(fullName);
    const subtitle = [contact.job_title, contact.company]
      .filter(Boolean)
      .join(" at ");

    return (
      <View className={`mt-3 rounded-xl border ${config.borderClass} ${config.bgClass} p-3`}>
        <View className="mb-2 flex-row items-center">
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={18}
            color={config.iconColor}
          />
          <Text className="ml-2 text-xs font-semibold uppercase text-gray-500">
            {config.label}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/contact/${contact.id}`)}
          className="flex-row items-center rounded-lg bg-white p-2.5 active:bg-gray-50"
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: avatarBg }}
          >
            <Text className="text-sm font-bold text-white">{initials}</Text>
          </View>
          <View className="ml-2.5 flex-1">
            <Text
              className="text-sm font-semibold text-gray-900"
              numberOfLines={1}
            >
              {fullName}
            </Text>
            {subtitle ? (
              <Text className="text-xs text-gray-500" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={Colors.gray[300]}
          />
        </Pressable>
      </View>
    );
  }

  // For bulk actions (bulk_tag, bulk_update, archive), show a summary card
  return (
    <View className={`mt-3 rounded-xl border ${config.borderClass} ${config.bgClass} p-3`}>
      <View className="flex-row items-center">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: config.iconColor + "20" }}
        >
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={config.iconColor}
          />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase text-gray-500">
            {config.label}
          </Text>
          {count !== undefined && (
            <Text className="text-2xl font-bold text-gray-900">
              {count}
            </Text>
          )}
        </View>
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={config.iconColor}
        />
      </View>
    </View>
  );
}

function PendingActionCard({
  pendingAction,
  onApprove,
  onReject,
}: {
  pendingAction: PendingAction;
  onApprove?: (pendingAction: PendingAction) => void;
  onReject?: () => void;
}) {
  const router = useRouter();
  const { preview } = pendingAction;

  const iconMap: Record<ActionType, { icon: string; color: string; bg: string; border: string }> = {
    add: { icon: "add-circle", color: "#10b981", bg: "bg-green-50", border: "border-green-200" },
    update: { icon: "create", color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-200" },
    bulk_tag: { icon: "pricetag", color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-200" },
    bulk_update: { icon: "create", color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-200" },
    archive: { icon: "archive", color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-200" },
    enrich: { icon: "search", color: "#8b5cf6", bg: "bg-purple-50", border: "border-purple-200" },
    link: { icon: "link", color: "#0891b2", bg: "bg-cyan-50", border: "border-cyan-200" },
    create_entity: { icon: "business", color: "#10b981", bg: "bg-green-50", border: "border-green-200" },
    add_entity_person: { icon: "person-add", color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-200" },
    promote_person: { icon: "arrow-up-circle", color: "#8b5cf6", bg: "bg-purple-50", border: "border-purple-200" },
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
        <Text className="ml-2 text-xs font-semibold uppercase text-gray-500">
          Pending Action
        </Text>
      </View>

      {/* Description */}
      <Text className="mb-1 text-sm font-medium text-gray-800">
        {preview.description}
      </Text>
      {preview.details && (
        <Text className="mb-2 text-xs text-gray-500">{preview.details}</Text>
      )}

      {/* Total count — prominent for large sets */}
      {preview.totalCount > 5 && (
        <View className="mb-2 flex-row items-center rounded-lg bg-white px-3 py-2">
          <Ionicons name="alert-circle" size={16} color={config.color} />
          <Text className="ml-2 text-sm font-bold text-gray-800">
            {preview.totalCount.toLocaleString()} contacts
          </Text>
          <Text className="ml-1 text-sm text-gray-500">will be affected</Text>
        </View>
      )}

      {/* Affected contacts preview */}
      {preview.affectedContacts.length > 0 && (
        <View className="mb-3 rounded-lg bg-white p-2">
          <Text className="mb-1 text-xs font-medium text-gray-400">
            {preview.totalCount <= 5
              ? `${preview.totalCount} contact${preview.totalCount === 1 ? "" : "s"} affected:`
              : `Showing ${Math.min(preview.affectedContacts.length, 5)} of ${preview.totalCount.toLocaleString()}:`}
          </Text>
          {preview.affectedContacts.slice(0, 5).map((contact) => {
            const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
            const initials = getInitials(contact.first_name, contact.last_name);
            const avatarBg = getAvatarColor(fullName);
            return (
              <View key={contact.id} className="mt-1 flex-row items-center py-1">
                <View
                  className="h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: avatarBg }}
                >
                  <Text className="text-xs font-bold text-white">{initials}</Text>
                </View>
                <Text className="ml-2 text-xs text-gray-700" numberOfLines={1}>
                  {fullName}
                  {contact.company ? ` - ${contact.company}` : ""}
                </Text>
              </View>
            );
          })}
          {preview.totalCount > 5 && (
            <Text className="mt-1 text-xs text-gray-400">
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
          className="flex-1 flex-row items-center justify-center rounded-lg border border-gray-200 bg-white py-2.5 active:bg-gray-50"
        >
          <Ionicons name="close" size={16} color="#6b7280" />
          <Text className="ml-1 text-sm font-semibold text-gray-600">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="items-center">
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={color}
      />
      <Text className="mt-1 text-lg font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  );
}
