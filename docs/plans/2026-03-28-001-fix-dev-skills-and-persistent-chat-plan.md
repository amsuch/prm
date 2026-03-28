---
title: "fix: Development skills from failure analysis + persistent chat"
type: fix
status: active
date: 2026-03-28
---

# Dev Skills + Persistent Chat

## Unit 1: CLAUDE.md Testing Conventions

Add mandatory testing rules to CLAUDE.md:
- Before committing any LLM/API integration: test the actual API call via curl/node
- Before committing tool definitions: validate schemas against provider requirements
- Before listing model IDs: query the actual /v1/models endpoint
- After swarm builds: run expo export to verify build

## Unit 2: Persistent Chat Sessions

Save chat conversations to Supabase so they persist across app restarts:
- New table: `chat_sessions` (id, user_id, title, created_at, updated_at)
- New table: `chat_messages` (id, session_id, role, content, response_json, tool_progress_json, created_at)
- Chat history sidebar/drawer to switch between sessions
- Auto-save messages as they're sent/received
- "New Chat" button to start fresh
- Load previous session on app open

## Unit 3: Memory Updates

Save all failure learnings to memory for future sessions.
