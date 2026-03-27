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

export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  context?: string,
): Promise<LLMResponse> {
  if (config.provider === "anthropic") {
    return callAnthropic(config, messages, context);
  }
  return callOpenAI(config, messages, context);
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
      max_tokens: 1024,
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

const DEFAULT_SYSTEM_PROMPT = `You are a personal relationship manager assistant. You have access to the user's contact database including names, companies, job titles, emails, phones, tags, interaction history, and relationships between contacts.

Answer questions about the user's network concisely and helpfully. When listing contacts, include their name, company, and relevant details. When asked about interactions, include dates and context.

If you don't have enough information to answer, say so clearly. Never make up contacts or interactions that don't exist in the data provided.`;
