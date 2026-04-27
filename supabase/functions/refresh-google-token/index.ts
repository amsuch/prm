import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Google's token endpoint. Exchanges a refresh_token for a new access_token.
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return json(
        { error: "Google OAuth credentials not configured" },
        500,
      );
    }

    const { data: row, error: fetchErr } = await supabase
      .from("calendar_sync_state")
      .select("provider_refresh_token")
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !row) {
      return json({ error: "No calendar connection found" }, 404);
    }

    const refreshToken = (row as { provider_refresh_token: string | null })
      .provider_refresh_token;
    if (!refreshToken) {
      return json(
        {
          error:
            "No refresh token on file. Reconnect Google Calendar to grant offline access.",
        },
        400,
      );
    }

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("refresh_token", refreshToken);
    params.set("grant_type", "refresh_token");

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const tokenBody = (await tokenRes.json()) as GoogleRefreshResponse;

    if (!tokenRes.ok || !tokenBody.access_token) {
      console.error(
        `[refresh-google-token] Google error (${tokenRes.status}): ${
          tokenBody.error ?? ""
        } ${tokenBody.error_description ?? ""}`,
      );
      // invalid_grant means the refresh token has been revoked / expired —
      // surface a 401 so the client can prompt re-auth.
      const status = tokenBody.error === "invalid_grant" ? 401 : 502;
      return json(
        {
          error: tokenBody.error_description ?? tokenBody.error ?? "Token refresh failed",
          code: tokenBody.error ?? "refresh_failed",
        },
        status,
      );
    }

    const accessToken = tokenBody.access_token;
    const expiresInSec = tokenBody.expires_in ?? 3600;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    const { error: updateErr } = await supabase
      .from("calendar_sync_state")
      .update({
        provider_token: accessToken,
        provider_token_expires_at: expiresAt,
      })
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("[refresh-google-token] Update failed:", updateErr);
      return json({ error: "Failed to persist refreshed token" }, 500);
    }

    return json({
      access_token: accessToken,
      expires_at: expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[refresh-google-token] Error:", message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
