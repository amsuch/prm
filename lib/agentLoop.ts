/**
 * Agentic loop: sends user messages to the LLM with tool definitions,
 * executes tool calls, feeds results back, and repeats until the LLM
 * produces a final text response.
 *
 * Uses an async generator to yield events as they happen, enabling
 * real-time streaming of tool progress in the UI.
 */

import type { LLMConfig } from "@/lib/llm";
import { callLLMWithTools, type ToolMessage, type ToolCallResult } from "@/lib/llmTools";
import { getToolDefinitions, type ToolDefinition } from "@/lib/tools";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AgentEvent =
  | { type: "thinking"; text: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | {
      type: "approval_needed";
      toolCall: ToolCall;
      toolName: string;
      description: string;
      preview: unknown;
    }
  | { type: "text"; text: string }
  | { type: "error"; text: string }
  | { type: "done"; finalText: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ITERATIONS = 10;

// Tools that ALWAYS require approval, even in Auto mode.
// These perform bulk/destructive operations that are hard to reverse.
const ALWAYS_REQUIRE_APPROVAL = new Set([
  "archive_contacts",
  "bulk_tag_contacts",
  "bulk_update_contacts",
  "create_contact_from_enrichment",
  "queue_enrichment",
]);

const DEFAULT_SYSTEM_PROMPT = `You are a personal relationship manager assistant with access to tools that query and modify the user's contact database.

ALWAYS use tools to look up data — never guess or make up contacts, interactions, or relationships.

When the user asks a question, use the appropriate tool to find the answer. You can chain multiple tool calls if needed.

For any action that modifies data (creating contacts, tagging, archiving, linking), explain what you plan to do. These actions require user approval before executing.

Be concise and helpful. Format responses clearly — use bullet points for lists of contacts.`;

// ---------------------------------------------------------------------------
// Tool description helpers (for approval previews)
// ---------------------------------------------------------------------------

function getToolDescription(toolCall: ToolCall): string {
  const args = toolCall.arguments;
  switch (toolCall.name) {
    case "create_contact":
      return `Create contact: ${args.first_name}${args.last_name ? " " + args.last_name : ""}${args.company ? " at " + args.company : ""}`;
    case "update_contact":
      return `Update ${args.field} to "${args.value}" on contact`;
    case "bulk_tag_contacts":
      return `Tag contacts${args.company ? ` at ${args.company}` : ""}${args.source ? ` from ${args.source}` : ""} as "${args.tag}"`;
    case "archive_contacts":
      return `Archive contacts${args.days_inactive ? ` inactive for ${args.days_inactive}+ days` : ""}${args.company ? ` at ${args.company}` : ""}${args.tag ? ` tagged "${args.tag}"` : ""}`;
    case "link_contacts":
      return `Link two contacts${args.relationship ? ` as ${args.relationship}` : ""}`;
    case "create_entity":
      return `Create entity: ${args.name}${args.category ? ` (${args.category})` : ""}`;
    case "add_entity_person":
      return `Add ${args.first_name} to entity${args.role ? ` as ${args.role}` : ""}`;
    case "log_interaction":
      return `Log ${args.type} interaction with contact`;
    case "create_contact_from_enrichment":
      return `Create contact from enrichment: ${args.first_name}${args.last_name ? " " + args.last_name : ""}${args.company ? " at " + args.company : ""}`;
    case "queue_enrichment": {
      const queueItems = args.items as { identifier: string }[] | undefined;
      return `Queue ${queueItems?.length ?? 0} enrichment job(s) to run in background`;
    }
    default:
      return `Execute ${toolCall.name}`;
  }
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

export async function* runAgentLoop(
  userMessage: string,
  config: LLMConfig,
  userId: string,
  history?: ToolMessage[],
  autoApprove?: boolean,
): AsyncGenerator<AgentEvent, void, undefined> {
  const tools = getToolDefinitions();
  const toolMap = new Map<string, ToolDefinition>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  // Build conversation messages
  const messages: ToolMessage[] = [
    {
      role: "system",
      content: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    },
    ...(history ?? []),
    { role: "user", content: userMessage },
  ];

  console.log("[AgentLoop] Starting:", {
    provider: config.provider,
    model: config.model,
    historyLength: history?.length ?? 0,
    toolCount: tools.length,
    messageCount: messages.length,
  });

  yield { type: "thinking", text: "Thinking..." };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let response;
    try {
      console.log("[AgentLoop] Iteration", iteration, "- calling LLM with", messages.length, "messages");
      response = await callLLMWithTools(config, messages, tools);
      console.log("[AgentLoop] LLM response:", {
        hasContent: !!response.content,
        contentLength: response.content?.length ?? 0,
        toolCallCount: response.toolCalls.length,
        model: response.model,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LLM request failed";
      console.error("[AgentLoop] LLM error:", msg);
      yield { type: "error", text: msg };
      return;
    }

    // If LLM returned text with no tool calls, we're done
    if (response.toolCalls.length === 0) {
      const finalText = response.content ?? "I couldn't generate a response.";
      yield { type: "text", text: finalText };
      yield { type: "done", finalText };
      return;
    }

    // LLM wants to call tools
    // Add the assistant message to conversation
    messages.push({
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // If there's text content alongside tool calls, emit it
    if (response.content) {
      yield { type: "text", text: response.content };
    }

    // Process each tool call
    for (const tc of response.toolCalls) {
      const tool = toolMap.get(tc.name);

      if (!tool) {
        // Unknown tool — tell the LLM
        yield {
          type: "tool_result",
          name: tc.name,
          result: { error: `Unknown tool: ${tc.name}` },
        };
        messages.push({
          role: "tool",
          toolCallId: tc.id,
          content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
        });
        continue;
      }

      // Check if tool requires approval.
      // Bulk/destructive tools always require approval, even in Auto mode.
      const forceApproval = ALWAYS_REQUIRE_APPROVAL.has(tc.name);
      if (tool.requiresApproval && (!autoApprove || forceApproval)) {
        const description = getToolDescription(tc);
        yield {
          type: "approval_needed",
          toolCall: { id: tc.id, name: tc.name, arguments: tc.arguments },
          toolName: tc.name,
          description,
          preview: tc.arguments,
        };
        // Stop the loop — caller must call resumeAfterApproval
        return;
      }

      // Execute the tool
      yield { type: "tool_call", name: tc.name, arguments: tc.arguments };

      try {
        const result = await tool.execute(tc.arguments, userId);
        yield { type: "tool_result", name: tc.name, result };

        // Add tool result to conversation
        const resultStr = JSON.stringify(result, null, 2);
        // Truncate very large results to avoid token limits
        const truncated =
          resultStr.length > 8000
            ? resultStr.slice(0, 8000) + "\n...(truncated)"
            : resultStr;

        messages.push({
          role: "tool",
          toolCallId: tc.id,
          content: truncated,
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Tool execution failed";
        yield {
          type: "tool_result",
          name: tc.name,
          result: { error: errorMsg },
        };
        messages.push({
          role: "tool",
          toolCallId: tc.id,
          content: JSON.stringify({ error: errorMsg }),
        });
      }
    }

    // Continue the loop — LLM will see tool results and decide what to do next
  }

  // Max iterations reached
  yield {
    type: "error",
    text: "Reached maximum number of tool calls. Please try a simpler question.",
  };
}

// ---------------------------------------------------------------------------
// Resume after approval
// ---------------------------------------------------------------------------

export async function* resumeAfterApproval(
  approved: boolean,
  toolCall: ToolCall,
  config: LLMConfig,
  userId: string,
  history: ToolMessage[],
): AsyncGenerator<AgentEvent, void, undefined> {
  if (!approved) {
    yield { type: "text", text: "Action cancelled." };
    yield { type: "done", finalText: "Action cancelled." };
    return;
  }

  const tools = getToolDefinitions();
  const toolMap = new Map<string, ToolDefinition>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  const tool = toolMap.get(toolCall.name);
  if (!tool) {
    yield { type: "error", text: `Unknown tool: ${toolCall.name}` };
    return;
  }

  // Execute the approved tool
  yield { type: "tool_call", name: toolCall.name, arguments: toolCall.arguments };

  let result: unknown;
  try {
    result = await tool.execute(toolCall.arguments, userId);
    yield { type: "tool_result", name: toolCall.name, result };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Tool execution failed";
    yield { type: "error", text: errorMsg };
    return;
  }

  // Feed the result back to the LLM for a final summary
  const messages: ToolMessage[] = [
    {
      role: "system",
      content: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    },
    ...history,
    {
      role: "tool",
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
    },
  ];

  try {
    const response = await callLLMWithTools(config, messages, tools);
    const finalText =
      response.content ?? "Action completed successfully.";
    yield { type: "text", text: finalText };
    yield { type: "done", finalText };
  } catch {
    // If LLM fails for the summary, still report success
    const resultObj = result as Record<string, unknown>;
    const fallbackText =
      (resultObj?.message as string) ?? "Action completed successfully.";
    yield { type: "text", text: fallbackText };
    yield { type: "done", finalText: fallbackText };
  }
}

// ---------------------------------------------------------------------------
// Export the messages type alias for the UI
// ---------------------------------------------------------------------------

export type { ToolMessage };
