---
title: "feat: Text-to-SQL agent with read-only query execution"
type: feat
status: active
date: 2026-03-27
---

# Text-to-SQL Agent

## Overview

Give the AI agent the ability to write and execute arbitrary read-only SQL queries against the user's data. The LLM generates SQL from natural language, a Postgres function validates and executes it in a read-only context, and results are displayed in the chat.

## Approach

**Client-side LLM call → Postgres RPC execution (no Edge Function needed)**

1. Client sends question to LLM with schema + few-shot examples in system prompt
2. LLM returns raw SQL (SELECT only)
3. Client calls a Supabase RPC function `execute_readonly_query(sql, user_id)`
4. Postgres function validates (SELECT only, has LIMIT), executes in read-only transaction, returns JSON

## Safety Layers

1. **Postgres function runs as read-only** — SET TRANSACTION READ ONLY
2. **Keyword validation** — rejects INSERT/UPDATE/DELETE/DROP etc.
3. **User ID injection** — replaces $1 with authenticated user_id, enforcing data isolation
4. **LIMIT enforcement** — appends LIMIT 100 if missing
5. **RLS still active** — double protection on data access
6. **Statement timeout** — 5 second max to prevent expensive queries

## Implementation Units

- [ ] **Unit 1: Postgres RPC function**

Create `execute_readonly_query(p_sql TEXT, p_user_id UUID)` that:
- Rejects non-SELECT statements via keyword check
- Enforces LIMIT
- Replaces $1 with user_id
- Executes in read-only transaction
- Returns JSONB array of results
- 5s statement timeout

- [ ] **Unit 2: Schema prompt + SQL generation**

Create `lib/sqlAgent.ts` with:
- `SCHEMA_PROMPT`: condensed DDL with column descriptions + few-shot examples
- `generateSQL(question, llmConfig)`: calls LLM, extracts SQL from response
- `executeSQLQuery(sql, userId)`: calls the RPC function
- `askWithSQL(question, userId, llmConfig)`: full pipeline — generate SQL, execute, format results, optionally ask LLM to summarize

- [ ] **Unit 3: Wire into agent**

Update `lib/agent.ts`:
- When intent is `search` and LLM is configured, use the SQL agent pipeline instead of plain search
- Show both the SQL query and results in the response
- New response type `sql_result` with query + rows + summary

Update `components/ChatBubble.tsx`:
- Render `sql_result` type: collapsible SQL block + results table/cards + natural language summary

## Scope Boundaries

- Read-only — no mutations through SQL (use existing action intents for that)
- No query caching or optimization
- No query history/favorites
