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
