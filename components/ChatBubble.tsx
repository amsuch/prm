import { View, Text } from "react-native";
import type { AgentResponse, PendingAction } from "@/lib/agent";
import type { ToolCall } from "@/lib/agentLoop";
import { Shadows } from "@/constants/shadows";
import { ContactCards } from "./chat/ContactResults";
import { InteractionCard } from "./chat/InteractionResult";
import { RelationshipCards } from "./chat/RelationshipResults";
import { StatsCard } from "./chat/StatsDisplay";
import { ToolProgressList, type ToolProgressItem } from "./chat/ToolProgress";
import { AgentApprovalCard, PendingActionCard } from "./chat/ApprovalCard";
import { EnrichmentResultCard } from "./chat/EnrichmentCard";
import { SQLResultCard } from "./chat/SQLResult";
import { ActionCard } from "./chat/ActionResult";
import { MarkdownText, markdownStyles } from "./MarkdownText";

type ChatBubbleProps = {
  role: "user" | "agent";
  text: string;
  response?: AgentResponse;
  isLoading?: boolean;
  toolProgress?: ToolProgressItem[];
  pendingApproval?: {
    toolCall: ToolCall;
    toolName: string;
    description: string;
    preview: unknown;
  };
  onApprove?: (pendingAction?: PendingAction) => void;
  onReject?: () => void;
};

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
        <View className="max-w-[80%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3">
          <Text className="text-base text-white">{text}</Text>
        </View>
      </View>
    );
  }

  // Agent message
  return (
    <View className="mb-3 px-4">
      <View className="max-w-[90%] rounded-2xl rounded-bl-md bg-white dark:bg-stone-900 px-4 py-3 shadow-sm" style={Shadows.xs}>
        {isLoading ? (
          <View>
            {/* Tool progress indicators */}
            {toolProgress && toolProgress.length > 0 ? (
              <ToolProgressList progress={toolProgress} />
            ) : (
              <View className="flex-row items-center">
                <View className="mr-2 h-2 w-2 rounded-full bg-stone-300" />
                <View className="mr-2 h-2 w-2 rounded-full bg-stone-400" />
                <View className="h-2 w-2 rounded-full bg-stone-500" />
                <Text className="ml-3 text-sm text-stone-400 dark:text-stone-500">
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
            {/* Show enrichment card if enrich_contact returned data */}
            {toolProgress?.map((tp, i) => {
              if (
                tp.name === "enrich_contact" &&
                tp.status === "done" &&
                tp.result &&
                typeof tp.result === "object" &&
                (tp.result as Record<string, unknown>).enrichment
              ) {
                const result = tp.result as Record<string, unknown>;
                return (
                  <EnrichmentResultCard
                    key={`enrich-${i}`}
                    enrichment={result.enrichment as Record<string, unknown>}
                    existingMatches={
                      result.existing_matches as
                        | { contact_id: string; first_name: string; last_name: string | null; company: string | null }[]
                        | undefined
                    }
                  />
                );
              }
              return null;
            })}
            <MarkdownText style={markdownStyles}>{text}</MarkdownText>
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
