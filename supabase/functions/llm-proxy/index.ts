import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { readSecret } from "../_shared/vault.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    const body = await req.json();
    const { provider, model, messages, tools, system, max_tokens, temperature } = body as {
      provider: "openai" | "anthropic";
      model: string;
      messages: unknown[];
      tools?: unknown[];
      system?: string;
      max_tokens?: number;
      temperature?: number;
    };

    if (!provider || !model || !messages) {
      return Response.json(
        { error: "Missing required fields: provider, model, messages" },
        { status: 400, headers: corsHeaders },
      );
    }

    const apiKey = await readSecret(userId, "ai_api_key");
    if (!apiKey) {
      return Response.json(
        { error: "No API key configured. Go to Settings to add your API key." },
        { status: 400, headers: corsHeaders },
      );
    }

    let apiUrl: string;
    let apiHeaders: Record<string, string>;
    let apiBody: Record<string, unknown>;

    if (provider === "openai") {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      apiBody = {
        model,
        messages,
        max_completion_tokens: max_tokens ?? 4096,
        temperature: temperature ?? 0.3,
      };
      if (tools && tools.length > 0) {
        apiBody.tools = tools;
      }
    } else {
      apiUrl = "https://api.anthropic.com/v1/messages";
      apiHeaders = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };
      apiBody = {
        model,
        messages,
        max_tokens: max_tokens ?? 4096,
        temperature: temperature ?? 0.3,
      };
      if (system) {
        apiBody.system = system;
      }
      if (tools && tools.length > 0) {
        apiBody.tools = tools;
      }
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(apiBody),
    });

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", res.headers.get("Content-Type") ?? "application/json");

    return new Response(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Missing Authorization header" || message === "Invalid JWT" ? 401 : 500;
    return Response.json({ error: message }, { status, headers: corsHeaders });
  }
});
