/**
 * SQL Agent: generates and executes read-only SQL queries
 * using the LLM for text-to-SQL translation.
 */

import { supabase } from "@/lib/supabase";
import { callLLM, type LLMConfig } from "@/lib/llm";
import { validateSQL, sanitizeForLLM } from "@/lib/sanitize";

export type SQLResult = {
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  summary: string;
};

const SCHEMA_PROMPT = `You are a SQL query generator for a PostgreSQL database. Generate ONLY valid PostgreSQL SELECT queries. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or any DDL/DML.

## Database Schema

-- Contacts (the main entity)
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,  -- ALWAYS filter by user_id = $1
  first_name TEXT NOT NULL,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  department TEXT,
  birthday DATE,
  notes TEXT,
  source TEXT,  -- 'manual', 'linkedin', 'device', 'csv', 'entity'
  custom_fields JSONB DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,  -- filter is_archived = false unless asked about archived
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Contact emails (one-to-many)
CREATE TABLE contact_emails (
  id UUID, contact_id UUID REFERENCES contacts(id),
  label TEXT, -- 'personal', 'work'
  email TEXT NOT NULL, is_primary BOOLEAN
);

-- Contact phones (one-to-many)
CREATE TABLE contact_phones (
  id UUID, contact_id UUID REFERENCES contacts(id),
  label TEXT, -- 'mobile', 'work', 'home'
  phone TEXT NOT NULL, is_primary BOOLEAN
);

-- Tags and junction table
CREATE TABLE tags (
  id UUID, user_id UUID NOT NULL, name TEXT NOT NULL, color TEXT
);
CREATE TABLE contact_tags (
  contact_id UUID REFERENCES contacts(id),
  tag_id UUID REFERENCES tags(id)
);

-- Interactions (activity log)
CREATE TABLE interactions (
  id UUID, user_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  type TEXT NOT NULL,  -- 'note', 'call', 'email', 'meeting', 'text', 'social', 'gift'
  direction TEXT,  -- 'inbound', 'outbound', null
  title TEXT, body TEXT,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

-- Relationships between contacts
CREATE TABLE relationship_types (
  id UUID, name TEXT, reverse_name TEXT,
  category TEXT, -- 'family', 'professional', 'social', 'other'
  is_symmetric BOOLEAN
);
CREATE TABLE contact_relationships (
  contact_a_id UUID REFERENCES contacts(id),
  contact_b_id UUID REFERENCES contacts(id),
  relationship_type_id UUID REFERENCES relationship_types(id),
  notes TEXT
);

-- Entities (places/organizations)
CREATE TABLE entities (
  id UUID, user_id UUID NOT NULL,
  name TEXT NOT NULL, category TEXT, address TEXT,
  phone TEXT, website TEXT, notes TEXT,
  is_archived BOOLEAN DEFAULT false
);

-- Entity people (casual acquaintances at entities)
CREATE TABLE entity_people (
  id UUID, entity_id UUID REFERENCES entities(id),
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL, last_name TEXT,
  role TEXT, notes TEXT,
  promoted_contact_id UUID REFERENCES contacts(id)
);

-- Reminders
CREATE TABLE reminders (
  id UUID, user_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  title TEXT NOT NULL, remind_at TIMESTAMPTZ,
  recurrence TEXT, is_completed BOOLEAN
);

-- Custom field definitions
CREATE TABLE custom_field_definitions (
  id UUID, user_id UUID NOT NULL,
  name TEXT, field_key TEXT, field_type TEXT,
  options JSONB, display_order INTEGER
);

## Rules
1. ALWAYS include WHERE user_id = $1 on tables that have user_id
2. ALWAYS include WHERE is_archived = false on contacts/entities unless asked about archived
3. Use ILIKE with % wildcards for name/text matching, never exact equality
4. Use JOINs through contact_tags to filter by tag
5. For relationships, check BOTH directions (contact_a_id and contact_b_id)
6. Always LIMIT results (max 100)
7. Use $1 for user_id — it will be replaced at execution time
8. Return useful columns (name, company, title) not just IDs
9. Use COUNT, AVG, MAX, MIN for aggregate questions
10. For "how many" questions, use SELECT COUNT(*)

## Examples

User: "Who do I know at Google?"
SQL: SELECT c.first_name, c.last_name, c.job_title, c.last_contacted_at FROM contacts c WHERE c.user_id = $1 AND c.is_archived = false AND c.company ILIKE '%Google%' ORDER BY c.first_name LIMIT 50

User: "Show me contacts I haven't talked to in 90 days"
SQL: SELECT c.first_name, c.last_name, c.company, c.last_contacted_at FROM contacts c WHERE c.user_id = $1 AND c.is_archived = false AND (c.last_contacted_at IS NULL OR c.last_contacted_at < NOW() - INTERVAL '90 days') ORDER BY c.last_contacted_at ASC NULLS FIRST LIMIT 50

User: "How many contacts do I have per company?"
SQL: SELECT c.company, COUNT(*) as count FROM contacts c WHERE c.user_id = $1 AND c.is_archived = false AND c.company IS NOT NULL GROUP BY c.company ORDER BY count DESC LIMIT 20

User: "Show contacts tagged VIP with their emails"
SQL: SELECT c.first_name, c.last_name, c.company, ce.email FROM contacts c JOIN contact_tags ct ON ct.contact_id = c.id JOIN tags t ON t.id = ct.tag_id LEFT JOIN contact_emails ce ON ce.contact_id = c.id AND ce.is_primary = true WHERE c.user_id = $1 AND c.is_archived = false AND t.name ILIKE '%VIP%' ORDER BY c.first_name LIMIT 50

User: "What interactions did I have last week?"
SQL: SELECT i.type, i.title, i.occurred_at, c.first_name, c.last_name FROM interactions i JOIN contacts c ON c.id = i.contact_id WHERE i.user_id = $1 AND i.occurred_at >= NOW() - INTERVAL '7 days' ORDER BY i.occurred_at DESC LIMIT 50

## Response Format
Return ONLY the SQL query. No explanation, no markdown, no backticks. Just the raw SQL.`;

/**
 * Generate SQL from a natural language question using the LLM.
 */
export async function generateSQL(
  question: string,
  llmConfig: LLMConfig,
): Promise<string> {
  const sanitizedQuestion = sanitizeForLLM(question);

  const response = await callLLM(
    { ...llmConfig, systemPrompt: SCHEMA_PROMPT },
    [{ role: "user", content: sanitizedQuestion }],
  );

  // Extract SQL from response — strip any markdown fences
  let sql = response.content.trim();
  sql = sql.replace(/^```(?:sql)?\n?/i, "").replace(/\n?```$/i, "");
  sql = sql.trim();

  // Validate SQL is safe (read-only, no DML/DDL)
  validateSQL(sql);

  return sql;
}

/**
 * Execute a read-only SQL query via the Supabase RPC function.
 */
export async function executeSQLQuery(
  sql: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("execute_readonly_query", {
    p_sql: sql,
    p_user_id: userId,
  });

  if (error) {
    throw new Error("Query execution failed");
  }

  return (data as Record<string, unknown>[]) ?? [];
}

/**
 * Full pipeline: question → SQL → execute → summarize
 */
export async function askWithSQL(
  question: string,
  userId: string,
  llmConfig: LLMConfig,
): Promise<SQLResult> {
  // Step 1: Generate SQL
  const sql = await generateSQL(question, llmConfig);

  // Step 2: Execute
  const rows = await executeSQLQuery(sql, userId);

  // Step 3: Summarize results with LLM
  let summary: string;
  if (rows.length === 0) {
    summary = "No results found for your query.";
  } else {
    try {
      const resultPreview = JSON.stringify(rows.slice(0, 10), null, 2);
      const summaryResponse = await callLLM(
        llmConfig,
        [
          {
            role: "user",
            content: `I asked: "${question}"\n\nThe database returned ${rows.length} row(s):\n${resultPreview}\n\nGive a brief, helpful summary of these results. Be concise — 1-3 sentences.`,
          },
        ],
      );
      summary = summaryResponse.content;
    } catch {
      // If summary fails, just describe the count
      summary = `Found ${rows.length} result${rows.length === 1 ? "" : "s"}.`;
    }
  }

  return {
    sql,
    rows,
    rowCount: rows.length,
    summary,
  };
}
