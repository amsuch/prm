# Vault + Edge Function Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move AI API keys and Google OAuth tokens out of client-accessible storage into Supabase Vault, proxied through Edge Functions.

**Architecture:** Two Edge Functions — `llm-proxy` (proxies OpenAI/Anthropic calls) and `calendar-proxy` (proxies Google Calendar calls). Both read secrets from Vault at invocation time with per-user caching. The client sends requests to these Edge Functions instead of directly to third-party APIs. Settings UI writes keys to Vault via an `upsert-secret` Edge Function. The `search_contacts` RPC is switched from SECURITY DEFINER to SECURITY INVOKER.

**Tech Stack:** Supabase Edge Functions (Deno), Supabase Vault (`vault.create_secret`), Supabase CLI, TypeScript

---

## File Structure

**New files:**
- `supabase/functions/llm-proxy/index.ts` — Edge Function: proxies LLM API calls, reads API key from Vault
- `supabase/functions/calendar-proxy/index.ts` — Edge Function: proxies Google Calendar API calls, reads tokens from Vault
- `supabase/functions/upsert-secret/index.ts` — Edge Function: stores/updates user secrets in Vault
- `supabase/functions/_shared/auth.ts` — Shared: JWT validation + user ID extraction
- `supabase/functions/_shared/vault.ts` — Shared: read/write Vault secrets for a user
- `supabase/functions/_shared/cors.ts` — Shared: CORS headers for browser requests

**Modified files:**
- `lib/llm.ts` — Replace direct fetch with `supabase.functions.invoke("llm-proxy", ...)`
- `lib/llmTools.ts` — Same: replace direct fetch with Edge Function invocation
- `lib/calendarSync.ts` — Replace direct Google Calendar fetch with `supabase.functions.invoke("calendar-proxy", ...)`
- `lib/auth/ctx.tsx` — Stop capturing `provider_token` client-side; send it to `upsert-secret` instead
- `app/(app)/(tabs)/settings.tsx` — Save API key via `upsert-secret` Edge Function instead of `user_metadata`
- `supabase/schema.sql` — Add `user_secrets` table, update `search_contacts` to SECURITY INVOKER

---

## Task 1: Create the `user_secrets` table and Vault infrastructure

**Files:**
- Modify: `supabase/schema.sql`

This task creates the database infrastructure. The `user_secrets` table maps user IDs to Vault secret IDs, allowing per-user secret lookup. Actual secret values live encrypted in `vault.secrets`.

- [ ] **Step 1: Create the `user_secrets` table via session pooler**

Run this in the devcontainer (requires DB access):

```sql
-- Table to map user secrets to Vault secret IDs
CREATE TABLE IF NOT EXISTS user_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  secret_name TEXT NOT NULL,  -- e.g. 'ai_api_key', 'google_provider_token', 'google_refresh_token'
  vault_secret_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, secret_name)
);

ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own secrets"
  ON user_secrets FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX user_secrets_user_idx ON user_secrets(user_id);
```

- [ ] **Step 2: Enable the Vault extension (if not already enabled)**

```sql
CREATE EXTENSION IF NOT EXISTS supabase_vault;
```

- [ ] **Step 3: Create helper functions for Vault operations**

These DB functions let Edge Functions read/write Vault secrets per user. They run as SECURITY DEFINER because `vault.secrets` is not accessible via RLS to regular users.

```sql
-- Upsert a secret for a user (creates or updates)
CREATE OR REPLACE FUNCTION upsert_user_secret(
  p_user_id UUID,
  p_secret_name TEXT,
  p_secret_value TEXT
) RETURNS VOID AS $$
DECLARE
  v_vault_id UUID;
  v_existing_vault_id UUID;
BEGIN
  -- Check if user already has this secret
  SELECT vault_secret_id INTO v_existing_vault_id
    FROM user_secrets
    WHERE user_id = p_user_id AND secret_name = p_secret_name;

  IF v_existing_vault_id IS NOT NULL THEN
    -- Update existing vault secret
    UPDATE vault.secrets
      SET secret = p_secret_value, updated_at = now()
      WHERE id = v_existing_vault_id;
  ELSE
    -- Create new vault secret
    INSERT INTO vault.secrets (secret, name, description)
      VALUES (
        p_secret_value,
        p_user_id || '/' || p_secret_name,
        'User secret: ' || p_secret_name
      )
      RETURNING id INTO v_vault_id;

    -- Map it to the user
    INSERT INTO user_secrets (user_id, secret_name, vault_secret_id)
      VALUES (p_user_id, p_secret_name, v_vault_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Read a decrypted secret for a user
CREATE OR REPLACE FUNCTION read_user_secret(
  p_user_id UUID,
  p_secret_name TEXT
) RETURNS TEXT AS $$
DECLARE
  v_vault_id UUID;
  v_decrypted TEXT;
BEGIN
  SELECT vault_secret_id INTO v_vault_id
    FROM user_secrets
    WHERE user_id = p_user_id AND secret_name = p_secret_name;

  IF v_vault_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_decrypted
    FROM vault.decrypted_secrets
    WHERE id = v_vault_id;

  RETURN v_decrypted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a secret for a user
CREATE OR REPLACE FUNCTION delete_user_secret(
  p_user_id UUID,
  p_secret_name TEXT
) RETURNS VOID AS $$
DECLARE
  v_vault_id UUID;
BEGIN
  SELECT vault_secret_id INTO v_vault_id
    FROM user_secrets
    WHERE user_id = p_user_id AND secret_name = p_secret_name;

  IF v_vault_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_vault_id;
    DELETE FROM user_secrets WHERE user_id = p_user_id AND secret_name = p_secret_name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 4: Switch `search_contacts` from SECURITY DEFINER to SECURITY INVOKER**

```sql
-- Replace the existing function with SECURITY INVOKER
CREATE OR REPLACE FUNCTION search_contacts(
  search_query TEXT,
  p_user_id UUID
) RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  avatar_url TEXT,
  source TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  email TEXT,
  phone TEXT,
  custom_fields JSONB,
  is_archived BOOLEAN,
  rank REAL
) AS $$
BEGIN
  -- Copy the existing function body from schema.sql lines 338-394
  -- but change the final line from SECURITY DEFINER to SECURITY INVOKER
  RETURN QUERY
  SELECT
    c.id, c.first_name, c.last_name, c.company, c.job_title,
    c.avatar_url, c.source, c.last_contacted_at, c.created_at, c.updated_at,
    ce.email, cp.phone, c.custom_fields, c.is_archived,
    ts_rank(
      to_tsvector('english',
        coalesce(c.first_name, '') || ' ' ||
        coalesce(c.last_name, '') || ' ' ||
        coalesce(c.company, '') || ' ' ||
        coalesce(c.job_title, '') || ' ' ||
        coalesce(c.notes, '') || ' ' ||
        coalesce(ce.email, '') || ' ' ||
        coalesce(cp.phone, '')
      ),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT ce2.email FROM contact_emails ce2
    WHERE ce2.contact_id = c.id ORDER BY ce2.is_primary DESC LIMIT 1
  ) ce ON true
  LEFT JOIN LATERAL (
    SELECT cp2.phone FROM contact_phones cp2
    WHERE cp2.contact_id = c.id ORDER BY cp2.is_primary DESC LIMIT 1
  ) cp ON true
  WHERE c.user_id = p_user_id
    AND c.is_archived = false
    AND (
      c.first_name ILIKE '%' || search_query || '%'
      OR c.last_name ILIKE '%' || search_query || '%'
      OR c.company ILIKE '%' || search_query || '%'
      OR c.job_title ILIKE '%' || search_query || '%'
      OR c.notes ILIKE '%' || search_query || '%'
      OR ce.email ILIKE '%' || search_query || '%'
      OR cp.phone ILIKE '%' || search_query || '%'
    )
  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
```

- [ ] **Step 5: Update `supabase/schema.sql` with all new DDL**

Add the `user_secrets` table, the three Vault helper functions, and the updated `search_contacts` function to `supabase/schema.sql`.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: Add user_secrets table, Vault helpers, switch search_contacts to SECURITY INVOKER"
```

---

## Task 2: Create shared Edge Function utilities

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/vault.ts`

- [ ] **Step 1: Create the Supabase functions directory**

```bash
mkdir -p supabase/functions/_shared
```

- [ ] **Step 2: Create `cors.ts`**

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

- [ ] **Step 3: Create `auth.ts`**

```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Validate the JWT from the Authorization header and return the user ID.
 * Throws if the token is invalid or missing.
 */
export async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid JWT");
  }

  return data.user.id;
}
```

- [ ] **Step 4: Create `vault.ts`**

```typescript
// supabase/functions/_shared/vault.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// Module-level cache: userId -> { secretName -> { value, fetchedAt } }
const secretCache = new Map<string, Map<string, { value: string | null; fetchedAt: number }>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Read a decrypted secret for a user. Cached for 5 minutes in-memory
 * (survives across warm invocations on Deno Deploy).
 */
export async function readSecret(userId: string, secretName: string): Promise<string | null> {
  // Check cache
  const userCache = secretCache.get(userId);
  if (userCache) {
    const cached = userCache.get(secretName);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const client = getServiceClient();
  const { data, error } = await client.rpc("read_user_secret", {
    p_user_id: userId,
    p_secret_name: secretName,
  });

  if (error) {
    throw new Error(`Failed to read secret: ${error.message}`);
  }

  const value = (data as string) ?? null;

  // Update cache
  if (!secretCache.has(userId)) {
    secretCache.set(userId, new Map());
  }
  secretCache.get(userId)!.set(secretName, { value, fetchedAt: Date.now() });

  return value;
}

/**
 * Write a secret for a user. Invalidates the cache entry.
 */
export async function upsertSecret(userId: string, secretName: string, secretValue: string): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.rpc("upsert_user_secret", {
    p_user_id: userId,
    p_secret_name: secretName,
    p_secret_value: secretValue,
  });

  if (error) {
    throw new Error(`Failed to upsert secret: ${error.message}`);
  }

  // Invalidate cache
  secretCache.get(userId)?.delete(secretName);
}

/**
 * Delete a secret for a user. Invalidates the cache entry.
 */
export async function deleteSecret(userId: string, secretName: string): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.rpc("delete_user_secret", {
    p_user_id: userId,
    p_secret_name: secretName,
  });

  if (error) {
    throw new Error(`Failed to delete secret: ${error.message}`);
  }

  // Invalidate cache
  secretCache.get(userId)?.delete(secretName);
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/
git commit -m "feat: Add shared Edge Function utilities (auth, vault, cors)"
```

---

## Task 3: Create the `upsert-secret` Edge Function

**Files:**
- Create: `supabase/functions/upsert-secret/index.ts`

This function lets the client store API keys and OAuth tokens in Vault without the client ever having direct Vault access.

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/upsert-secret/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { upsertSecret, deleteSecret } from "../_shared/vault.ts";

const ALLOWED_SECRETS = new Set([
  "ai_api_key",
  "google_provider_token",
  "google_refresh_token",
]);

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    const body = await req.json();
    const { secret_name, secret_value } = body as {
      secret_name: string;
      secret_value: string | null;
    };

    if (!secret_name || !ALLOWED_SECRETS.has(secret_name)) {
      return Response.json(
        { error: `Invalid secret_name. Allowed: ${[...ALLOWED_SECRETS].join(", ")}` },
        { status: 400, headers: corsHeaders },
      );
    }

    if (secret_value === null || secret_value === "") {
      await deleteSecret(userId, secret_name);
    } else {
      await upsertSecret(userId, secret_name, secret_value);
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Missing Authorization header" || message === "Invalid JWT" ? 401 : 500;
    return Response.json({ error: message }, { status, headers: corsHeaders });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/upsert-secret/
git commit -m "feat: Add upsert-secret Edge Function for Vault storage"
```

---

## Task 4: Create the `llm-proxy` Edge Function

**Files:**
- Create: `supabase/functions/llm-proxy/index.ts`

This is the core function. It reads the user's AI config from Vault, forwards the request to OpenAI or Anthropic, and streams the response back.

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/llm-proxy/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { readSecret } from "../_shared/vault.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);

    // Read the request body — contains provider, model, messages, tools, etc.
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

    // Read API key from Vault
    const apiKey = await readSecret(userId, "ai_api_key");
    if (!apiKey) {
      return Response.json(
        { error: "No API key configured. Go to Settings to add your API key." },
        { status: 400, headers: corsHeaders },
      );
    }

    // Forward to the appropriate provider
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

    // Forward the request
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(apiBody),
    });

    // Pass through the response (status, headers, body)
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/llm-proxy/
git commit -m "feat: Add llm-proxy Edge Function — proxies OpenAI/Anthropic via Vault"
```

---

## Task 5: Create the `calendar-proxy` Edge Function

**Files:**
- Create: `supabase/functions/calendar-proxy/index.ts`

Proxies Google Calendar API calls. Reads the user's `google_provider_token` from Vault.

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/calendar-proxy/index.ts
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
    const { action, params } = body as {
      action: "fetch_events" | "check_connection";
      params?: Record<string, string>;
    };

    // Read Google token from Vault
    const providerToken = await readSecret(userId, "google_provider_token");

    if (action === "check_connection") {
      return Response.json(
        { connected: !!providerToken },
        { headers: corsHeaders },
      );
    }

    if (!providerToken) {
      return Response.json(
        { error: "Google Calendar not connected" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (action === "fetch_events") {
      const { timeMin, timeMax, syncToken, pageToken } = params ?? {};

      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      if (syncToken) {
        url.searchParams.set("syncToken", syncToken);
      } else {
        if (timeMin) url.searchParams.set("timeMin", timeMin);
        if (timeMax) url.searchParams.set("timeMax", timeMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
      }
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      url.searchParams.set("maxResults", "250");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${providerToken}` },
      });

      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "application/json");

      return new Response(res.body, {
        status: res.status,
        headers: responseHeaders,
      });
    }

    return Response.json(
      { error: `Unknown action: ${action}` },
      { status: 400, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Missing Authorization header" || message === "Invalid JWT" ? 401 : 500;
    return Response.json({ error: message }, { status, headers: corsHeaders });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/calendar-proxy/
git commit -m "feat: Add calendar-proxy Edge Function — proxies Google Calendar via Vault"
```

---

## Task 6: Update `lib/llm.ts` to use the Edge Function

**Files:**
- Modify: `lib/llm.ts`

Replace direct `fetch()` calls to OpenAI/Anthropic with `supabase.functions.invoke("llm-proxy", ...)`.

- [ ] **Step 1: Rewrite `lib/llm.ts`**

```typescript
// lib/llm.ts
/**
 * LLM client — calls OpenAI/Anthropic via the llm-proxy Edge Function.
 * API keys never leave the server. The Edge Function reads them from Vault.
 */

import { supabase } from "@/lib/supabase";

export type LLMConfig = {
  provider: "openai" | "anthropic";
  model: string;
  systemPrompt: string;
  // apiKey removed — it's now in Vault
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

  // Build provider-specific message format
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

  // Parse the provider-specific response
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
 * Returns null if no provider/model is configured.
 * Note: apiKey is no longer in the config — it's read server-side from Vault.
 */
export function getLLMConfigFromSession(session: {
  user?: { user_metadata?: Record<string, unknown> };
} | null): LLMConfig | null {
  const meta = session?.user?.user_metadata;
  // We no longer check for ai_api_key here — its presence in Vault
  // is checked by the Edge Function. We just need provider/model.
  if (!meta?.ai_provider) return null;

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
```

- [ ] **Step 2: Commit**

```bash
git add lib/llm.ts
git commit -m "refactor: llm.ts calls Edge Function instead of direct API — keys stay server-side"
```

---

## Task 7: Update `lib/llmTools.ts` to use the Edge Function

**Files:**
- Modify: `lib/llmTools.ts`

Same pattern as Task 6 but for tool-calling requests.

- [ ] **Step 1: Rewrite `lib/llmTools.ts`**

Replace both `callOpenAIWithTools` and `callAnthropicWithTools` to go through the Edge Function. The key insight: the Edge Function passes through the response body, so the client still parses the provider-specific response format.

```typescript
// lib/llmTools.ts
/**
 * Unified LLM tool-calling client.
 * Calls the llm-proxy Edge Function instead of direct API calls.
 */

import { supabase } from "@/lib/supabase";
import type { LLMConfig } from "@/lib/llm";
import type { ToolDefinition } from "@/lib/tools";
import { toolsToOpenAIFormat, toolsToAnthropicFormat } from "@/lib/tools";

// ---------------------------------------------------------------------------
// Types (unchanged)
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
// OpenAI
// ---------------------------------------------------------------------------

async function callOpenAIWithTools(
  config: LLMConfig,
  messages: ToolMessage[],
  tools: ToolDefinition[],
): Promise<LLMToolResponse> {
  const openAIMessages = convertMessagesToOpenAI(messages);
  const openAITools = toolsToOpenAIFormat(tools);

  const { data, error } = await supabase.functions.invoke("llm-proxy", {
    body: {
      provider: "openai",
      model: config.model,
      messages: openAIMessages,
      tools: openAITools,
      max_tokens: 4096,
      temperature: 0.3,
    },
  });

  if (error) {
    throw new Error(error.message ?? "LLM proxy error");
  }

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
      ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropicWithTools(
  config: LLMConfig,
  messages: ToolMessage[],
  tools: ToolDefinition[],
): Promise<LLMToolResponse> {
  const { systemPrompt, apiMessages } = convertMessagesToAnthropic(messages);
  const anthropicTools = toolsToAnthropicFormat(tools);

  const { data, error } = await supabase.functions.invoke("llm-proxy", {
    body: {
      provider: "anthropic",
      model: config.model,
      messages: apiMessages,
      tools: anthropicTools,
      system: systemPrompt || config.systemPrompt,
      max_tokens: 4096,
      temperature: 0.3,
    },
  });

  if (error) {
    throw new Error(error.message ?? "LLM proxy error");
  }

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
      ? { input_tokens: data.usage.input_tokens, output_tokens: data.usage.output_tokens }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Message conversion (unchanged from original)
// ---------------------------------------------------------------------------

function convertMessagesToOpenAI(messages: ToolMessage[]): Record<string, unknown>[] {
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
        const assistantMsg: Record<string, unknown> = { role: "assistant", content: msg.content };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id, type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          }));
        }
        result.push(assistantMsg);
        break;
      }
      case "tool":
        result.push({ role: "tool", tool_call_id: msg.toolCallId, content: msg.content });
        break;
    }
  }
  return result;
}

function convertMessagesToAnthropic(messages: ToolMessage[]): {
  systemPrompt: string;
  apiMessages: Record<string, unknown>[];
} {
  let systemPrompt = "";
  const apiMessages: Record<string, unknown>[] = [];
  let pendingToolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

  function flushToolResults() {
    if (pendingToolResults.length > 0) {
      apiMessages.push({ role: "user", content: [...pendingToolResults] });
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
        if (msg.content) contentBlocks.push({ type: "text", text: msg.content });
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            contentBlocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
          }
        }
        if (contentBlocks.length > 0) apiMessages.push({ role: "assistant", content: contentBlocks });
        break;
      }
      case "tool":
        pendingToolResults.push({ type: "tool_result", tool_use_id: msg.toolCallId, content: msg.content });
        break;
    }
  }
  flushToolResults();
  return { systemPrompt, apiMessages };
}

function safeParseJSON(str: string): Record<string, unknown> {
  try { return JSON.parse(str) as Record<string, unknown>; }
  catch { return {}; }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/llmTools.ts
git commit -m "refactor: llmTools.ts calls Edge Function instead of direct API"
```

---

## Task 8: Update Settings UI to save API key via Edge Function

**Files:**
- Modify: `app/(app)/(tabs)/settings.tsx`

The settings page currently saves the API key to `user_metadata`. Change it to call `upsert-secret` for the key, while keeping provider/model/prompt in `user_metadata` (those aren't secrets).

- [ ] **Step 1: Update `handleSave` in `AIKeyManager`**

Find the `handleSave` callback (around line 960) and replace:

```typescript
// OLD:
const { error } = await supabase.auth.updateUser({
  data: {
    ai_provider: provider,
    ai_model: model,
    ai_api_key: apiKey.trim(),
    ai_system_prompt: systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
  },
});
```

With:

```typescript
// NEW: Save API key to Vault, config to user_metadata
const { error: secretError } = await supabase.functions.invoke("upsert-secret", {
  body: { secret_name: "ai_api_key", secret_value: apiKey.trim() },
});
if (secretError) throw new Error(secretError.message ?? "Failed to save API key");

const { error } = await supabase.auth.updateUser({
  data: {
    ai_provider: provider,
    ai_model: model,
    ai_system_prompt: systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
    // ai_api_key removed — now in Vault
    ai_has_api_key: true, // flag so UI knows a key exists
  },
});
```

- [ ] **Step 2: Update initial state to use `ai_has_api_key` flag**

Change the `saved` state initialization:

```typescript
// OLD:
const [saved, setSaved] = useState(!!session?.user?.user_metadata?.ai_api_key);

// NEW:
const [saved, setSaved] = useState(!!session?.user?.user_metadata?.ai_has_api_key);
```

And remove the API key from the initial state (don't pre-populate from `user_metadata`):

```typescript
// OLD:
const [apiKey, setApiKey] = useState(
  (session?.user?.user_metadata?.ai_api_key as string) || "",
);

// NEW: Key is in Vault, not readable from client. Show placeholder if saved.
const [apiKey, setApiKey] = useState("");
```

- [ ] **Step 3: Update `getLLMConfigFromSession` check**

In `lib/llm.ts`, ensure `getLLMConfigFromSession` checks `ai_has_api_key` instead of `ai_api_key`:

```typescript
// Already updated in Task 6, but verify this line:
if (!meta?.ai_provider) return null;
// Should also check: if (!meta?.ai_has_api_key) return null;
```

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/\(tabs\)/settings.tsx lib/llm.ts
git commit -m "refactor: Settings saves API key to Vault, not user_metadata"
```

---

## Task 9: Update `lib/calendarSync.ts` and `lib/auth/ctx.tsx`

**Files:**
- Modify: `lib/calendarSync.ts`
- Modify: `lib/auth/ctx.tsx`

- [ ] **Step 1: Update `connectCalendar` to save tokens to Vault**

In `lib/calendarSync.ts`, replace `connectCalendar`:

```typescript
export async function connectCalendar(
  userId: string,
  providerToken: string,
  refreshToken?: string,
): Promise<void> {
  // Save tokens to Vault via Edge Function
  const { error: tokenErr } = await supabase.functions.invoke("upsert-secret", {
    body: { secret_name: "google_provider_token", secret_value: providerToken },
  });
  if (tokenErr) throw new Error(tokenErr.message ?? "Failed to save Google token");

  if (refreshToken) {
    const { error: refreshErr } = await supabase.functions.invoke("upsert-secret", {
      body: { secret_name: "google_refresh_token", secret_value: refreshToken },
    });
    if (refreshErr) throw new Error(refreshErr.message ?? "Failed to save refresh token");
  }

  // Update connection state (without tokens — those are in Vault now)
  const { data: existing } = await supabase
    .from("calendar_sync_state")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await supabase
      .from("calendar_sync_state")
      .update({ is_connected: true } as never)
      .eq("user_id", userId);
  } else {
    await supabase.from("calendar_sync_state").insert({
      user_id: userId,
      is_connected: true,
    } as never);
  }
}
```

- [ ] **Step 2: Update `disconnectCalendar` to delete tokens from Vault**

```typescript
export async function disconnectCalendar(userId: string): Promise<void> {
  // Delete tokens from Vault
  await supabase.functions.invoke("upsert-secret", {
    body: { secret_name: "google_provider_token", secret_value: null },
  });
  await supabase.functions.invoke("upsert-secret", {
    body: { secret_name: "google_refresh_token", secret_value: null },
  });

  // Update connection state
  await supabase
    .from("calendar_sync_state")
    .update({
      is_connected: false,
      sync_token: null,
    } as never)
    .eq("user_id", userId);
}
```

- [ ] **Step 3: Update `fetchCalendarEvents` to go through Edge Function**

Replace the direct Google API fetch in `fetchCalendarEvents` with:

```typescript
export async function fetchCalendarEvents(
  timeMin: string,
  timeMax: string,
  syncToken?: string,
): Promise<{ events: CalendarEvent[]; nextSyncToken: string | null }> {
  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params: Record<string, string> = {};
    if (syncToken) params.syncToken = syncToken;
    else {
      params.timeMin = timeMin;
      params.timeMax = timeMax;
    }
    if (pageToken) params.pageToken = pageToken;

    const { data, error } = await supabase.functions.invoke("calendar-proxy", {
      body: { action: "fetch_events", params },
    });

    if (error) throw new Error(error.message ?? "Calendar sync failed");

    const items = data.items ?? [];
    for (const item of items) {
      if (item.status === "cancelled") continue;
      allEvents.push({
        id: item.id,
        summary: item.summary ?? "(no title)",
        start: item.start?.dateTime ?? item.start?.date ?? "",
        end: item.end?.dateTime ?? item.end?.date ?? "",
        attendees: item.attendees ?? [],
      });
    }

    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken ?? null;
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}
```

Note: The `accessToken` parameter is removed from the function signature since the Edge Function handles token retrieval.

- [ ] **Step 4: Update callers of `fetchCalendarEvents`**

Find all callers in `calendarSync.ts` that pass `accessToken` and remove that argument. The `syncCalendar` function will need updating — it currently reads `provider_token` from `calendar_sync_state`. Remove that read and use the new signature.

- [ ] **Step 5: Remove `provider_token` and `provider_refresh_token` columns**

After confirming everything works, drop these columns from `calendar_sync_state`:

```sql
ALTER TABLE calendar_sync_state DROP COLUMN IF EXISTS provider_token;
ALTER TABLE calendar_sync_state DROP COLUMN IF EXISTS provider_refresh_token;
```

- [ ] **Step 6: Commit**

```bash
git add lib/calendarSync.ts lib/auth/ctx.tsx supabase/schema.sql
git commit -m "refactor: Calendar sync uses Edge Function proxy — tokens in Vault"
```

---

## Task 10: Deploy Edge Functions and clean up `user_metadata`

**Files:**
- No code changes — deployment and migration steps

- [ ] **Step 1: Deploy all Edge Functions**

```bash
supabase functions deploy upsert-secret
supabase functions deploy llm-proxy
supabase functions deploy calendar-proxy
```

- [ ] **Step 2: Set Edge Function secrets**

The Edge Functions need `SUPABASE_SERVICE_ROLE_KEY` to call the Vault RPC functions:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Note: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are automatically available in Edge Functions.

- [ ] **Step 3: Test the flow end-to-end**

1. Open Settings, enter an API key, save — verify it calls `upsert-secret`
2. Go to Ask tab, send a message — verify it calls `llm-proxy` and gets a response
3. Connect Google Calendar — verify tokens are stored in Vault
4. Sync calendar — verify events come through `calendar-proxy`

- [ ] **Step 4: Migrate existing `user_metadata` API keys to Vault**

Write a one-time migration script that reads existing `ai_api_key` from `user_metadata` and stores it in Vault:

```bash
# Run in devcontainer with DB access
source .env.local && node -e "
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY_LEGACY);

async function migrate() {
  const { data: users } = await admin.auth.admin.listUsers();
  for (const user of users.users) {
    const key = user.user_metadata?.ai_api_key;
    if (key) {
      await admin.rpc('upsert_user_secret', {
        p_user_id: user.id,
        p_secret_name: 'ai_api_key',
        p_secret_value: key,
      });
      // Set flag and remove key from metadata
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, ai_api_key: undefined, ai_has_api_key: true },
      });
      console.log('Migrated:', user.email);
    }
  }
}
migrate();
"
```

- [ ] **Step 5: Migrate existing `calendar_sync_state` tokens to Vault**

```bash
source .env.local && node -e "
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY_LEGACY);

async function migrate() {
  const { data: rows } = await admin.from('calendar_sync_state').select('*');
  for (const row of rows ?? []) {
    if (row.provider_token) {
      await admin.rpc('upsert_user_secret', {
        p_user_id: row.user_id,
        p_secret_name: 'google_provider_token',
        p_secret_value: row.provider_token,
      });
    }
    if (row.provider_refresh_token) {
      await admin.rpc('upsert_user_secret', {
        p_user_id: row.user_id,
        p_secret_name: 'google_refresh_token',
        p_secret_value: row.provider_refresh_token,
      });
    }
    if (row.provider_token) console.log('Migrated calendar tokens for:', row.user_id);
  }
}
migrate();
"
```

- [ ] **Step 6: Verify build**

```bash
pnpm exec expo export --platform web
```

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: Deploy Edge Functions, migrate secrets to Vault"
```
