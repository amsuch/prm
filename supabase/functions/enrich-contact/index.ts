import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PARALLEL_API_KEY = Deno.env.get("PARALLEL_API_KEY") ?? "";
const PARALLEL_BASE = "https://api.parallel.ai";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Output schema for person enrichment from Parallel Task API. */
/** 10 properties — within the core processor's recommended limit. */
const PERSON_OUTPUT_SCHEMA = {
  type: "json" as const,
  json_schema: {
    type: "object",
    properties: {
      first_name: { type: "string", description: "Person's first name" },
      last_name: { type: "string", description: "Person's last name" },
      company: { type: "string", description: "Current company or employer" },
      job_title: { type: "string", description: "Current job title or role" },
      department: { type: "string", description: "Department within the company" },
      email: { type: "string", description: "Professional or public email address" },
      phone: { type: "string", description: "Phone number if available" },
      location: { type: "string", description: "City and state/country of residence" },
      bio: { type: "string", description: "Brief professional summary or headline (1-2 sentences)" },
      previous_companies: {
        type: "array",
        items: { type: "string" },
        description: "List of notable previous employers",
      },
    },
  },
};

/**
 * Build the task input prompt based on identifier type.
 */
function buildTaskInput(
  type: string,
  value: string,
): { input: string; task_spec: Record<string, unknown> } {
  let prompt: string;

  switch (type) {
    case "linkedin":
      prompt = `Research this LinkedIn profile and extract detailed professional information about the person: ${value}. Find their current role, company, location, contact info, education, and professional background.`;
      break;
    case "email":
      prompt = `Research this email address and find detailed professional information about the person who owns it: ${value}. Find their name, current role, company, LinkedIn profile, location, and professional background.`;
      break;
    case "name":
      prompt = `Research this person and find their detailed professional information: ${value}. Find their current role, company, LinkedIn profile, email, location, and professional background.`;
      break;
    default:
      prompt = `Research and find detailed professional information about: ${value}`;
  }

  return {
    input: prompt,
    task_spec: { output_schema: PERSON_OUTPUT_SCHEMA },
  };
}

/**
 * Create a task run on Parallel API.
 */
async function createTaskRun(
  input: string,
  taskSpec: Record<string, unknown>,
): Promise<{ run_id: string }> {
  const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": PARALLEL_API_KEY,
    },
    body: JSON.stringify({
      input,
      task_spec: taskSpec,
      processor: "core",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Parallel API error (${res.status}): ${err}`);
  }

  return await res.json();
}

/**
 * Poll for the task result. The result endpoint blocks until done
 * (up to the timeout), so we just need one call with a long timeout.
 */
async function getTaskResult(
  runId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${PARALLEL_BASE}/v1/tasks/runs/${runId}/result`,
    {
      method: "GET",
      headers: {
        "x-api-key": PARALLEL_API_KEY,
      },
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Parallel result error (${res.status}): ${err}`);
  }

  return await res.json();
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth — require a valid Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate the JWT by creating a Supabase client with it
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request
    const body = await req.json();
    const { type, value } = body as { type: string; value: string };

    if (!type || !value) {
      return new Response(
        JSON.stringify({ error: "Missing 'type' and 'value' in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!["linkedin", "email", "name"].includes(type)) {
      return new Response(
        JSON.stringify({
          error: "Invalid type. Must be 'linkedin', 'email', or 'name'",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!PARALLEL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Parallel API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build and run the Parallel task
    const { input, task_spec } = buildTaskInput(type, value);
    const taskRun = await createTaskRun(input, task_spec);

    console.log(`[enrich-contact] Created task run: ${taskRun.run_id} for ${type}:${value}`);

    // Get the result (blocks until complete, up to ~60s)
    const result = await getTaskResult(taskRun.run_id);

    // Extract the output from the Parallel response
    // The result structure is: { run: {...}, output: { content: {...}, basis: [...] } }
    const rawOutput = (result as Record<string, unknown>).output as Record<string, unknown> | undefined;
    const output = rawOutput?.content ?? rawOutput ?? result;

    console.log(`[enrich-contact] Got result for ${taskRun.run_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        enrichment: output,
        source: "parallel",
        run_id: taskRun.run_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[enrich-contact] Error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
