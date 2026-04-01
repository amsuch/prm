#!/usr/bin/env node
/**
 * Integration tests for the Parallel API enrichment flow.
 *
 * Tests:
 * 1. Parallel Task API — create run + get result (direct)
 * 2. Supabase Edge Function — auth rejection for unauthenticated requests
 * 3. LinkedIn URL normalization logic (unit)
 *
 * Usage: node scripts/test-enrich.mjs
 *
 * Requires .env.local with PARALLEL_API_KEY and EXPO_PUBLIC_SUPABASE_URL/KEY.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------
const envPath = resolve(import.meta.dirname, "..", ".env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1: Parallel Task API — create run
// ---------------------------------------------------------------------------
console.log("\n\x1b[1mTest 1: Parallel Task API — create task run\x1b[0m");

const createRes = await fetch("https://api.parallel.ai/v1/tasks/runs", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": PARALLEL_API_KEY,
  },
  body: JSON.stringify({
    input:
      "Find the current job title and company for the person at https://www.linkedin.com/in/satyanadella",
    task_spec: {
      output_schema: {
        type: "json",
        json_schema: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            company: { type: "string" },
            job_title: { type: "string" },
          },
        },
      },
    },
    processor: "base",
  }),
});

const createData = await createRes.json();
assert(createRes.ok, `POST /v1/tasks/runs returns ${createRes.status}`);
assert(typeof createData.run_id === "string", `run_id is a string: ${createData.run_id}`);
assert(createData.status === "queued" || createData.status === "running", `status is queued/running: ${createData.status}`);
assert(createData.is_active === true, "is_active is true");

// ---------------------------------------------------------------------------
// Test 2: Parallel Task API — get result (blocks until done)
// ---------------------------------------------------------------------------
console.log("\n\x1b[1mTest 2: Parallel Task API — get task result\x1b[0m");

const resultRes = await fetch(
  `https://api.parallel.ai/v1/tasks/runs/${createData.run_id}/result`,
  {
    headers: { "x-api-key": PARALLEL_API_KEY },
    signal: AbortSignal.timeout(120_000),
  },
);

const resultData = await resultRes.json();
assert(resultRes.ok, `GET /result returns ${resultRes.status}`);
assert(resultData.run?.status === "completed", `run status is completed: ${resultData.run?.status}`);
assert(resultData.output?.content != null, "output.content is present");

const content = resultData.output?.content;
if (content) {
  assert(typeof content.first_name === "string" && content.first_name.length > 0, `first_name: "${content.first_name}"`);
  assert(typeof content.last_name === "string" && content.last_name.length > 0, `last_name: "${content.last_name}"`);
  assert(typeof content.company === "string" && content.company.length > 0, `company: "${content.company}"`);
  assert(typeof content.job_title === "string" && content.job_title.length > 0, `job_title: "${content.job_title}"`);
}

// ---------------------------------------------------------------------------
// Test 3: Edge Function — rejects unauthenticated requests
// ---------------------------------------------------------------------------
console.log("\n\x1b[1mTest 3: Edge Function — auth enforcement\x1b[0m");

const noAuthRes = await fetch(
  `${SUPABASE_URL}/functions/v1/enrich-contact`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`, // anon key, not a user JWT
    },
    body: JSON.stringify({ type: "linkedin", value: "https://linkedin.com/in/test" }),
  },
);
const noAuthData = await noAuthRes.json();
assert(noAuthRes.status === 401, `Rejects anon key with 401: got ${noAuthRes.status}`);
assert(noAuthData.error === "Unauthorized", `Error message: "${noAuthData.error}"`);

// No auth header at all
const bareRes = await fetch(
  `${SUPABASE_URL}/functions/v1/enrich-contact`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "linkedin", value: "https://linkedin.com/in/test" }),
  },
);
// Supabase gateway returns 401 for missing auth on --no-verify-jwt=false,
// or the function itself returns 401
assert(bareRes.status === 401, `Rejects no-auth with 401: got ${bareRes.status}`);

// ---------------------------------------------------------------------------
// Test 4: Edge Function — validates input
// ---------------------------------------------------------------------------
console.log("\n\x1b[1mTest 4: Edge Function — input validation\x1b[0m");

// We can't call the function without a valid user JWT, but we can test
// that CORS preflight works
const optionsRes = await fetch(
  `${SUPABASE_URL}/functions/v1/enrich-contact`,
  { method: "OPTIONS" },
);
assert(
  optionsRes.status === 200 || optionsRes.status === 204,
  `CORS preflight returns ${optionsRes.status}`,
);

// ---------------------------------------------------------------------------
// Test 5: LinkedIn URL normalization (unit test)
// ---------------------------------------------------------------------------
console.log("\n\x1b[1mTest 5: LinkedIn URL normalization\x1b[0m");

function normalizeLinkedInUrl(value) {
  if (!value.startsWith("http")) {
    return value.startsWith("linkedin.com")
      ? `https://www.${value}`
      : value.startsWith("/in/")
        ? `https://www.linkedin.com${value}`
        : `https://www.linkedin.com/in/${value}`;
  }
  return value;
}

assert(
  normalizeLinkedInUrl("https://www.linkedin.com/in/johndoe") ===
    "https://www.linkedin.com/in/johndoe",
  "Full URL unchanged",
);
assert(
  normalizeLinkedInUrl("linkedin.com/in/johndoe") ===
    "https://www.linkedin.com/in/johndoe",
  "linkedin.com/in/slug gets https://www. prefix",
);
assert(
  normalizeLinkedInUrl("/in/johndoe") ===
    "https://www.linkedin.com/in/johndoe",
  "/in/slug gets full prefix",
);
assert(
  normalizeLinkedInUrl("johndoe") ===
    "https://www.linkedin.com/in/johndoe",
  "Bare slug gets full URL",
);
assert(
  normalizeLinkedInUrl("http://linkedin.com/in/johndoe") ===
    "http://linkedin.com/in/johndoe",
  "http:// URL unchanged",
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(
  `\n\x1b[1m${passed + failed} tests, \x1b[32m${passed} passed\x1b[0m\x1b[1m, \x1b[${failed ? "31" : "32"}m${failed} failed\x1b[0m`,
);
process.exit(failed > 0 ? 1 : 0);
