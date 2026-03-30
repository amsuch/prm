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
