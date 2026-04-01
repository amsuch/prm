import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Server-side queue processor for contact enrichment.
 *
 * Called via:
 *   1. Database webhook on enrichment_queue INSERT (automatic)
 *   2. Manual invocation / cron
 *
 * Picks up pending jobs, calls Parallel Task API, creates contacts
 * with the results, and marks jobs complete — all server-side so the
 * user can close the app.
 */

const PARALLEL_API_KEY = Deno.env.get("PARALLEL_API_KEY") ?? "";
const PARALLEL_BASE = "https://api.parallel.ai";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** 10 properties — within the core processor limit. */
const PERSON_SCHEMA = {
  type: "json" as const,
  json_schema: {
    type: "object",
    properties: {
      first_name: { type: "string" },
      last_name: { type: "string" },
      company: { type: "string" },
      job_title: { type: "string" },
      department: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      location: { type: "string" },
      bio: { type: "string" },
      previous_companies: { type: "array", items: { type: "string" } },
    },
  },
};

// ---------------------------------------------------------------------------
// Parallel API
// ---------------------------------------------------------------------------

function buildPrompt(type: string, value: string): string {
  if (type === "linkedin")
    return `Research this LinkedIn profile and extract professional information: ${value}`;
  if (type === "email")
    return `Research this email and find the person's professional information: ${value}`;
  return `Research this person and find their professional information: ${value}`;
}

async function callParallel(
  type: string,
  value: string,
): Promise<Record<string, unknown>> {
  // Create task run
  const createRes = await fetch(`${PARALLEL_BASE}/v1/tasks/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": PARALLEL_API_KEY,
    },
    body: JSON.stringify({
      input: buildPrompt(type, value),
      task_spec: { output_schema: PERSON_SCHEMA },
      processor: "core",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Parallel create error (${createRes.status}): ${err}`);
  }

  const { run_id } = await createRes.json();

  // Get result (blocks until complete)
  const resultRes = await fetch(
    `${PARALLEL_BASE}/v1/tasks/runs/${run_id}/result`,
    {
      headers: { "x-api-key": PARALLEL_API_KEY },
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!resultRes.ok) {
    const err = await resultRes.text();
    throw new Error(`Parallel result error (${resultRes.status}): ${err}`);
  }

  const result = await resultRes.json();
  const output = result?.output as Record<string, unknown> | undefined;
  return (output?.content ?? output ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Create contact from enrichment
// ---------------------------------------------------------------------------

async function createContact(
  userId: string,
  e: Record<string, unknown>,
  linkedinUrl: string | null,
): Promise<string> {
  const notesParts: string[] = [];
  if (e.bio) notesParts.push(String(e.bio));
  if (e.location) notesParts.push(`Location: ${e.location}`);

  const customFields: Record<string, unknown> = {};
  if (Array.isArray(e.previous_companies) && e.previous_companies.length > 0) {
    customFields.previous_companies = e.previous_companies;
  }
  if (e.location) customFields.location = String(e.location);

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      first_name: String(e.first_name || "Unknown"),
      last_name: e.last_name ? String(e.last_name) : null,
      company: e.company ? String(e.company) : null,
      job_title: e.job_title ? String(e.job_title) : null,
      department: e.department ? String(e.department) : null,
      notes: notesParts.length > 0 ? notesParts.join("\n") : null,
      custom_fields:
        Object.keys(customFields).length > 0 ? customFields : null,
      source: "enrichment",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const contactId = data.id;

  const email = e.email ? String(e.email).trim() : "";
  const phone = e.phone ? String(e.phone).trim() : "";

  if (email) {
    await supabase
      .from("contact_emails")
      .insert({ contact_id: contactId, email, label: "work", is_primary: true });
  }

  if (phone) {
    await supabase
      .from("contact_phones")
      .insert({ contact_id: contactId, phone, label: "work", is_primary: true });
  }

  if (linkedinUrl) {
    await supabase
      .from("contact_urls")
      .insert({ contact_id: contactId, url: linkedinUrl, label: "linkedin" });
  }

  return contactId;
}

// ---------------------------------------------------------------------------
// Process one job
// ---------------------------------------------------------------------------

type Job = { id: string; user_id: string; identifier: string; type: string };

async function processJob(job: Job): Promise<void> {
  console.log(`[Queue] Processing ${job.id}: ${job.type}`);

  await supabase
    .from("enrichment_queue")
    .update({ status: "processing" })
    .eq("id", job.id);

  try {
    const enrichment = await callParallel(job.type, job.identifier);

    const linkedinUrl = job.type === "linkedin" ? job.identifier : null;
    const contactId = await createContact(job.user_id, enrichment, linkedinUrl);

    await supabase
      .from("enrichment_queue")
      .update({
        status: "completed",
        result_json: enrichment,
        contact_id: contactId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    const name = `${enrichment.first_name ?? ""} ${enrichment.last_name ?? ""}`.trim();
    console.log(`[Queue] ${job.id} done — contact ${contactId} (${name})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Queue] ${job.id} failed: ${msg}`);

    await supabase
      .from("enrichment_queue")
      .update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!PARALLEL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Parallel API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Optional: accept specific job IDs in body
    let jobIds: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.job_ids)) jobIds = body.job_ids;
    } catch { /* no body — process all pending */ }

    let query = supabase
      .from("enrichment_queue")
      .select("id, user_id, identifier, type")
      .order("created_at", { ascending: true });

    if (jobIds) {
      query = query.in("id", jobIds).in("status", ["pending", "failed"]);
    } else {
      query = query.eq("status", "pending").limit(10);
    }

    const { data: jobs, error } = await query;
    if (error) throw new Error(error.message);

    const pending = (jobs as unknown as Job[]) ?? [];

    if (pending.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending jobs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[Queue] ${pending.length} job(s) to process`);

    let processed = 0;
    let failed = 0;
    for (const job of pending) {
      try {
        await processJob(job);
        processed++;
      } catch {
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Queue] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
