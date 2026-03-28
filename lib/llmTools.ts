/**
 * Unified LLM tool-calling client.
 *
 * Handles both OpenAI and Anthropic tool calling formats,
 * normalizing them into a common interface for the agent loop.
 */

import type { LLMConfig } from "@/lib/llm";
import type { ToolDefinition } from "@/lib/tools";
import { toolsToOpenAIFormat, toolsToAnthropicFormat } from "@/lib/tools";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolCallResult = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LLMToolResponse = {
  content: string | null;
  toolCalls: ToolCallResult[];
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
};

/**
 * Messages in the conversation. These are in a normalized format
 * that gets translated to provider-specific formats before sending.
 */
export type ToolMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCallResult[] }
  | { role: "tool"; toolCallId: string; content: string };

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

export async function callLLMWithTools(
  config: LLMConfig,
  messages: ToolMessage[],
  tools: ToolDefinition[],
): Promise<LLMToolResponse> {
  if (config.provider === "anthropic") {
    return callAnthropicWithTools(config, messages, tools);
  }
  return callOpenAIWithTools(config, messages, tools);
}

// ---------------------------------------------------------------------------
// OpenAI implementation
// ---------------------------------------------------------------------------

async function callOpenAIWithTools(
  config: LLMConfig,
  messages: ToolMessage[],
  tools: ToolDefinition[],
): Promise<LLMToolResponse> {
  const openAIMessages = convertMessagesToOpenAI(messages);
  const openAITools = toolsToOpenAIFormat(tools);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: openAIMessages,
      tools: openAITools,
      max_completion_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { error?: { message?: string } })?.error?.message ??
      `OpenAI API error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const message = choice?.message;

  const toolCalls: ToolCallResult[] = [];
  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParseJSON(tc.function.arguments),
      });
    }
  }

  return {
    content: message?.content ?? null,
    toolCalls,
    model: data.model ?? config.model,
    usage: data.usage
      ? {
          input_tokens: data.usage.prompt_tokens,
          output_tokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

function convertMessagesToOpenAI(
  messages: ToolMessage[],
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        result.push({ role: "system", content: msg.content });
        break;
      case "user":
        result.push({ role: "user", content: msg.content });
        break;
      case "assistant": {
        const assistantMsg: Record<string, unknown> = {
          role: "assistant",
          content: msg.content,
        };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        result.push(assistantMsg);
        break;
      }
      case "tool":
        result.push({
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: msg.content,
        });
        break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Anthropic implementation
// ---------------------------------------------------------------------------

async function callAnthropicWithTools(
  config: LLMConfig,
  messages: ToolMessage[],
  tools: ToolDefinition[],
): Promise<LLMToolResponse> {
  const { systemPrompt, apiMessages } = convertMessagesToAnthropic(messages);
  const anthropicTools = toolsToAnthropicFormat(tools);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt || config.systemPrompt,
      messages: apiMessages,
      tools: anthropicTools,
      max_completion_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { error?: { message?: string } })?.error?.message ??
      `Anthropic API error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();

  let content: string | null = null;
  const toolCalls: ToolCallResult[] = [];

  for (const block of data.content ?? []) {
    if (block.type === "text") {
      content = (content ?? "") + block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      });
    }
  }

  return {
    content,
    toolCalls,
    model: data.model ?? config.model,
    usage: data.usage
      ? {
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
        }
      : undefined,
  };
}

function convertMessagesToAnthropic(messages: ToolMessage[]): {
  systemPrompt: string;
  apiMessages: Record<string, unknown>[];
} {
  let systemPrompt = "";
  const apiMessages: Record<string, unknown>[] = [];

  // Collect pending tool results to batch into a single user message
  let pendingToolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

  function flushToolResults() {
    if (pendingToolResults.length > 0) {
      apiMessages.push({
        role: "user",
        content: [...pendingToolResults],
      });
      pendingToolResults = [];
    }
  }

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        systemPrompt = msg.content;
        break;
      case "user":
        flushToolResults();
        apiMessages.push({ role: "user", content: msg.content });
        break;
      case "assistant": {
        flushToolResults();
        const contentBlocks: Record<string, unknown>[] = [];
        if (msg.content) {
          contentBlocks.push({ type: "text", text: msg.content });
        }
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            contentBlocks.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }
        if (contentBlocks.length > 0) {
          apiMessages.push({ role: "assistant", content: contentBlocks });
        }
        break;
      }
      case "tool":
        pendingToolResults.push({
          type: "tool_result",
          tool_use_id: msg.toolCallId,
          content: msg.content,
        });
        break;
    }
  }

  // Flush any remaining tool results
  flushToolResults();

  return { systemPrompt, apiMessages };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}
