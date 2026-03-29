/**
 * LLM client for calling OpenAI and Anthropic APIs directly via fetch.
 * Runs client-side in React Native — no server SDK needed.
 */

export type LLMConfig = {
  provider: "openai" | "anthropic";
  model: string;
  apiKey: string;
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
  if (config.provider === "anthropic") {
    return callAnthropic(config, messages, safeContext);
  }
  return callOpenAI(config, messages, safeContext);
}

async function callOpenAI(
  config: LLMConfig,
  messages: LLMMessage[],
  context?: string,
): Promise<LLMResponse> {
  const systemContent = context
    ? `${config.systemPrompt}\n\n## Current Contact Data Context\n${context}`
    : config.systemPrompt;

  const apiMessages = [
    { role: "system" as const, content: systemContent },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: apiMessages,
      max_completion_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } })?.error?.message ?? `OpenAI API error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? "No response from model.",
    model: data.model ?? config.model,
    usage: data.usage
      ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens }
      : undefined,
  };
}

async function callAnthropic(
  config: LLMConfig,
  messages: LLMMessage[],
  context?: string,
): Promise<LLMResponse> {
  const systemContent = context
    ? `${config.systemPrompt}\n\n## Current Contact Data Context\n${context}`
    : config.systemPrompt;

  const apiMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

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
      system: systemContent,
      messages: apiMessages,
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } })?.error?.message ?? `Anthropic API error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

  return {
    content: textBlock?.text ?? "No response from model.",
    model: data.model ?? config.model,
    usage: data.usage
      ? { input_tokens: data.usage.input_tokens, output_tokens: data.usage.output_tokens }
      : undefined,
  };
}

/**
 * Extract LLM config from session user metadata.
 * Returns null if no API key is configured.
 */
export function getLLMConfigFromSession(session: {
  user?: { user_metadata?: Record<string, unknown> };
} | null): LLMConfig | null {
  const meta = session?.user?.user_metadata;
  if (!meta?.ai_api_key) return null;

  const provider = (meta.ai_provider as string) === "openai" ? "openai" : "anthropic";
  const defaultModel = provider === "openai" ? "gpt-5.4-2026-03-05" : "claude-sonnet-4-6";

  return {
    provider,
    model: (meta.ai_model as string) || defaultModel,
    apiKey: meta.ai_api_key as string,
    systemPrompt: (meta.ai_system_prompt as string) || DEFAULT_SYSTEM_PROMPT,
  };
}

const DEFAULT_SYSTEM_PROMPT = `You are a personal relationship manager assistant with access to tools that query and modify the user's contact database.

ALWAYS use tools to look up data — never guess or make up contacts, interactions, or relationships.

When the user asks a question, use the appropriate tool to find the answer. You can chain multiple tool calls if needed.

For any action that modifies data (creating contacts, tagging, archiving, linking), explain what you plan to do. These actions require user approval before executing.

Be concise and helpful. Format responses clearly — use bullet points for lists of contacts.`;
