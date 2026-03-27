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

type ChatBubbleProps = {
  role: "user" | "agent";
  text: string;
  response?: AgentResponse;
  isLoading?: boolean;
  onApprove?: (pendingAction: PendingAction) => void;
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

export function ChatBubble({ role, text, response, isLoading, onApprove, onReject }: ChatBubbleProps) {
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
          <View className="flex-row items-center">
            <View className="mr-2 h-2 w-2 rounded-full bg-gray-300" />
            <View className="mr-2 h-2 w-2 rounded-full bg-gray-400" />
            <View className="h-2 w-2 rounded-full bg-gray-500" />
            <Text className="ml-3 text-sm text-gray-400">Thinking...</Text>
          </View>
        ) : (
          <>
            <Text className="text-base text-gray-900">{text}</Text>
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
    case "text":
    case "error":
      return null;
  }
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
      <Text className="mb-2 text-sm font-medium text-gray-800">
        {preview.description}
      </Text>
      {preview.details && (
        <Text className="mb-2 text-xs text-gray-500">{preview.details}</Text>
      )}

      {/* Affected contacts preview */}
      {preview.affectedContacts.length > 0 && (
        <View className="mb-3 rounded-lg bg-white p-2">
          <Text className="mb-1 text-xs font-medium text-gray-400">
            {preview.affectedContacts.length} contact{preview.affectedContacts.length === 1 ? "" : "s"} affected:
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
          {preview.affectedContacts.length > 5 && (
            <Text className="mt-1 text-xs text-gray-400">
              +{preview.affectedContacts.length - 5} more
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
