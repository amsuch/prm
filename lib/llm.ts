/**
 * LLM client — calls the `llm-proxy` Supabase Edge Function.
 * The API key is stored server-side in Vault; the client never sees it.
 */

import { supabase } from "@/lib/supabase";

export type LLMConfig = {
  provider: "openai" | "anthropic";
  model: string;
  systemPrompt: string;
};

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMResponse = {
  content: string;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
};

/**
 * Sanitize database context before injecting into LLM prompts.
 * Strips sequences that could manipulate LLM behavior if present in contact data.
 */
function sanitizeContext(context: string): string {
  return context
    .replace(/\b(ignore|forget|disregard)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)\b/gi, "")
    .replace(/\b(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|you\s+are))\b/gi, "")
    .replace(/\b(system|assistant)\s*:/gi, "$1 -");
}

export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  context?: string,
): Promise<LLMResponse> {
  const safeContext = context ? sanitizeContext(context) : undefined;
  const systemContent = safeContext
    ? `${config.systemPrompt}\n\n## Current Contact Data Context\n${safeContext}`
    : config.systemPrompt;

  let apiMessages: unknown[];
  let system: string | undefined;

  if (config.provider === "openai") {
    apiMessages = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
  } else {
    system = systemContent;
    apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  }

  const { data, error } = await supabase.functions.invoke("llm-proxy", {
    body: {
      provider: config.provider,
      model: config.model,
      messages: apiMessages,
      system,
      max_tokens: 1024,
      temperature: 0.3,
    },
  });

  if (error) {
    throw new Error(error.message ?? "LLM proxy error");
  }

  if (config.provider === "openai") {
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content ?? "No response from model.",
      model: data.model ?? config.model,
      usage: data.usage
        ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens }
        : undefined,
    };
  } else {
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    return {
      content: textBlock?.text ?? "No response from model.",
      model: data.model ?? config.model,
      usage: data.usage
        ? { input_tokens: data.usage.input_tokens, output_tokens: data.usage.output_tokens }
        : undefined,
    };
  }
}

/**
 * Extract LLM config from session user metadata.
 * Returns null if no provider or API key is configured.
 */
export function getLLMConfigFromSession(session: {
  user?: { user_metadata?: Record<string, unknown> };
} | null): LLMConfig | null {
  const meta = session?.user?.user_metadata;
  if (!meta?.ai_provider && !meta?.ai_has_api_key) return null;

  const provider = (meta.ai_provider as string) === "openai" ? "openai" : "anthropic";
  const defaultModel = provider === "openai" ? "gpt-5.4-2026-03-05" : "claude-sonnet-4-6";

  return {
    provider,
    model: (meta.ai_model as string) || defaultModel,
    systemPrompt: (meta.ai_system_prompt as string) || DEFAULT_SYSTEM_PROMPT,
  };
}

const DEFAULT_SYSTEM_PROMPT = `You are a personal relationship manager assistant with access to tools that query and modify the user's contact database.

ALWAYS use tools to look up data — never guess or make up contacts, interactions, or relationships.

When the user asks a question, use the appropriate tool to find the answer. You can chain multiple tool calls if needed.

For any action that modifies data (creating contacts, tagging, archiving, linking), explain what you plan to do. These actions require user approval before executing.

Be concise and helpful. Format responses clearly — use bullet points for lists of contacts.`;
