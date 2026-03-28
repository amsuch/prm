# prm-sc

Personal Relationship Manager — hybrid web + mobile app built with Expo (React Native) and Supabase.

## Tech Stack

- **Framework**: Expo SDK 52, expo-router v4 (file-based routing)
- **Language**: TypeScript (strict mode)
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage)
- **Styling**: NativeWind v4 (Tailwind CSS via `className` on React Native components)
- **Package Manager**: pnpm
- **AI**: OpenAI / Anthropic APIs called client-side via `lib/llm.ts`

## Development Environment

This project uses VS Code devcontainers. All development happens inside the container.

### Database Access

- Direct DB connections use the **session pooler** at `aws-0-us-west-2.pooler.supabase.com:5432`
- User: `postgres.rymspebhcinjttcrmtow`, password in `SUPABASE_CONNECTION_STRING`
- Use the `pg` npm package (already installed as devDependency) for schema migrations
- The REST API uses the legacy JWT key (`SUPABASE_SERVICE_ROLE_KEY_LEGACY`) for admin operations
- The app client uses `EXPO_PUBLIC_SUPABASE_KEY` (anon/publishable key) — this is safe to bundle

### Running the App

```bash
pnpm dev:web          # Start web on port 8081
pnpm dev              # Start Expo dev server (web + mobile)
```

Verify builds with: `pnpm exec expo export --platform web`

## Agent Isolation Rules

**You are running inside a devcontainer. You MUST follow these rules:**

1. **Filesystem**: Only read/write files under `/workspaces/prm-sc`
2. **Git**: Only interact with the `prm-sc` repository (`kelihi/prm-sc`)
3. **Network**: May fetch docs, search web, install npm packages. No internal/private services.
4. **Secrets**: Never log, print, or write API keys to files. Use environment variables.
5. **No host access**: No Docker sockets, host filesystems, or container breakout

## Project Structure

```
/workspaces/prm-sc/
  app/                   # Expo Router screens (file-based routing)
    _layout.tsx          # Root layout (SessionProvider + Stack)
    sign-in.tsx          # Passwordless magic link auth
    (app)/               # Authenticated routes
      _layout.tsx        # Auth gate (Redirect if no session)
      (tabs)/            # Bottom tab navigator
        _layout.tsx      # Tab config (Home, Contacts, Entities, Ask, Settings)
        index.tsx        # Dashboard
        contacts.tsx     # Contacts list
        entities.tsx     # Entities list
        ask.tsx          # AI agent chat
        settings.tsx     # Settings + AI config
        import.tsx       # Import hub (hidden tab, accessed via buttons)
      contact/           # Contact CRUD
      entity/            # Entity CRUD
      import/            # CSV + device import flows
      bulk-link.tsx      # Bulk relationship linking
  components/            # Shared UI components (~30 files)
  hooks/                 # Custom React hooks (~13 files)
  lib/                   # Business logic + utilities
    supabase.ts          # Supabase client singleton
    auth/ctx.tsx         # Auth context provider (useSession)
    agent.ts             # AI agent: query execution + action handlers
    queryParser.ts       # NL→intent regex parser (20 intents)
    llm.ts               # OpenAI/Anthropic API client
    sqlAgent.ts          # Text-to-SQL: LLM generates SQL, Postgres executes read-only
    csv.ts               # CSV parsing + LinkedIn import
    contacts.ts          # Device contacts import
    entities.ts          # Entity CRUD operations
    relationships.ts     # Contact relationship CRUD
    interactions.ts      # Interaction logging
    search.ts            # Search + filter helpers
    utils.ts             # formatDate, getInitials, debounce, etc.
    validation.ts        # Form validation
  types/database.ts      # Supabase-generated TypeScript types
  constants/             # Colors, layout tokens
  supabase/schema.sql    # Full database schema (14 tables)
  docs/plans/            # Implementation plans
```

## Database

14 tables in Supabase with RLS on all:
- `profiles`, `contacts`, `contact_emails`, `contact_phones`, `contact_urls`
- `tags`, `contact_tags`, `interactions`, `reminders`
- `relationship_types`, `contact_relationships`
- `custom_field_definitions`
- `entities`, `entity_people`

Key RPC functions: `search_contacts`, `get_contact_relationships`, `execute_readonly_query`

## Conventions

### Code Style
- Functional components with hooks
- Named exports for components, default exports only for route screens
- Import from `@/lib/supabase`, `@/types/database`, `@/constants/colors`, etc.
- Supabase query results cast with `as unknown as T` (required by typed client)

### Design Tokens (NativeWind)

**Apply these consistently across ALL screens:**

| Token | Value |
|-------|-------|
| Screen horizontal padding | `px-4` |
| Tab screen bottom padding | `pb-24` (ScrollView) or `paddingBottom: 96` (FlatList) |
| Card | `rounded-xl bg-white shadow-sm` |
| Form input | `rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900` |
| Primary button | `rounded-xl bg-blue-600 py-3.5 active:bg-blue-700` |
| Pressable active state | `active:bg-gray-50` (light), `active:bg-gray-100` (on cards) |
| Section header (settings) | `text-xs font-semibold uppercase tracking-wider text-gray-400` |
| Screen title | `text-2xl font-bold text-gray-900` |
| Section title | `text-lg font-semibold text-gray-900` |
| Body text | `text-base text-gray-900` |
| Subtitle/meta | `text-sm text-gray-500` |
| Label | `text-xs text-gray-500` |
| Divider | `h-px bg-gray-100` |
| Primary color | `blue-600` / `Colors.brand[600]` |
| Error | `red-500` / `Colors.error` |
| Success | `green-600` / `Colors.success` |

**Never hardcode hex colors in JSX.** Use NativeWind classes or `Colors` constants.

### Auth
- Passwordless magic link via `supabase.auth.signInWithOtp`
- `detectSessionInUrl`: true on web (for magic link redirect), false on native
- Session stored in AsyncStorage, auto-refreshed on app foreground
- User metadata stores AI config: `ai_provider`, `ai_model`, `ai_api_key`, `ai_system_prompt`

### AI Agent (Ask tab)
- 3-tier query processing: regex intent → text-to-SQL → conversational LLM
- Action intents go through HITL approval (default) or execute directly (Auto mode)
- `isActionIntent()` determines which intents need approval
- SQL execution uses `execute_readonly_query` RPC (read-only, parameterized user_id, 5s timeout)
- LLM config read from `session.user.user_metadata` via `getLLMConfigFromSession()`

### Supabase Patterns
- All tables have `user_id` column with RLS policy `auth.uid() = user_id`
- Auto-create profile on signup via `handle_new_user` trigger
- `last_contacted_at` auto-updated via `trg_interaction_update_contact` trigger
- Batch operations in chunks of 200 (avoid PostgREST URL length limits)

## Supabase Management API

Use `SUPABASE_ACCOUNT_TOKEN` (sbp_ format) with the Management API at `api.supabase.com`:

```bash
# Get auth config
curl -s "https://api.supabase.com/v1/projects/rymspebhcinjttcrmtow/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCOUNT_TOKEN}"

# Update auth config
curl -s -X PATCH "https://api.supabase.com/v1/projects/rymspebhcinjttcrmtow/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCOUNT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"site_url": "http://localhost:8081"}'
```

Current auth config:
- `site_url`: http://localhost:8081
- `redirect_urls`: http://localhost:8081, prm-sc://auth/callback
- `mailer_autoconfirm`: true (no email confirmation needed)
- `mailer_otp_length`: 6 digits
- Magic link email template includes both clickable link AND 6-digit OTP code

## Mandatory Pre-Commit Checks

**Before committing ANY LLM/API integration:**
```bash
# 1. Test the actual API call
curl -s "https://api.openai.com/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"MODEL","messages":[{"role":"user","content":"hi"}],"max_completion_tokens":10}'

# 2. Test with tool calling (if applicable)
# Include the actual tool definitions, not simplified versions

# 3. Verify the build
pnpm exec expo export --platform web
```

**Before listing model IDs in the UI:**
```bash
# Query the ACTUAL available models
curl -s "https://api.openai.com/v1/models" -H "Authorization: Bearer $KEY" | \
  node -e "..." # filter for chat-compatible models

# Test each model with /v1/chat/completions to confirm it's a chat model
```

**Before committing tool definitions:**
- Verify all properties with `additionalProperties: false` have ALL props in `required`
- OR remove `additionalProperties: false` and `strict: true` for tools with optional params
- Test the tool schema by sending it to the API

**After swarm agent builds:**
- Run `pnpm exec expo export --platform web` to catch import/type errors
- Check for design consistency (px-4, shadow-sm, Colors constants)
- Verify useCallback/useMemo dependency arrays include all referenced variables

## Development Skills

### Skill 1: Pre-Commit API Integration Check

**When:** Before committing any code that calls an external API (OpenAI, Anthropic, Google Calendar, Google Maps).

1. Extract the exact API endpoint, headers, and body from the code
2. Test with curl using real credentials
3. Verify the response format matches what the code expects
4. Test error cases (invalid key, wrong model, rate limit)
5. Verify the parameter names match the API docs (`max_tokens` vs `max_completion_tokens`)

### Skill 2: Swarm Agent Design Token Injection

**When:** Dispatching multiple agents to build UI.

1. Always include the design token table from CLAUDE.md in every agent prompt
2. List the exact NativeWind classes for:
   - Backgrounds: `bg-stone-50`
   - Cards: `rounded-xl bg-white shadow-sm`
   - Buttons: `bg-indigo-600 active:bg-indigo-700`
   - Text: `text-stone-900` / `text-stone-700` / `text-stone-500`
   - Inputs: `rounded-xl border border-stone-200 bg-stone-50 px-4 py-3`
3. Specify: "Never use hardcoded hex colors. Import from `@/constants/colors`"
4. After all agents complete, run a consistency check: `grep -r "bg-gray\|bg-blue\|text-gray" components/`

### Skill 3: Hook Authoring Convention

**When:** Creating a new React hook.

1. Return shape must be: `{ data: T, isLoading: boolean, error: string | null, refetch: () => Promise<void> }`
2. Use `useCallback` for `refetch`
3. Use abort signals for unmount cleanup
4. Error state as `string`, not `Error` object
5. Loading starts as `true`, set `false` after first fetch

### Skill 4: Component Extraction Criteria

**When:** A component file exceeds 300 lines.

1. If it has 3+ distinct visual sections, extract each as a sub-component
2. If it has inline utility functions, move them to `lib/`
3. If it renders lists of items, extract the item component
4. Create a folder: `components/[Name]/` with sub-components
5. Re-export from an index file for clean imports

### Skill 5: New Feature Integration Checklist

**When:** Adding a new feature to the PRM app.

1. **Database:** Create table via pg pooler, add to `types/database.ts`
2. **Supabase:** Enable RLS, create policies
3. **Types:** Add table types to the `Database` type
4. **Hook:** Create `use[Feature].ts` following hook convention (Skill 3)
5. **Screen:** Create `app/(app)/[feature].tsx`, register in `_layout.tsx`
6. **Agent:** Add tool definition in `lib/tools.ts`
7. **Settings:** Add management UI if user-configurable
8. **Build:** Verify with `pnpm exec expo export --platform web`

## Common Pitfalls (from this project)

1. **Supabase short API keys** (`sb_publishable_`, `sb_secret_`) are NOT JWTs. Use the legacy JWT key for admin API calls (`Authorization: Bearer`).
2. **Direct DB host** (`db.*.supabase.co`) may not resolve from containers. Use the **session pooler** (`aws-0-{region}.pooler.supabase.com:5432`) with `postgres.{project_ref}` as username.
3. **`detectSessionInUrl`** must be `true` on web for magic link redirects to work. Set `false` on native.
4. **NativeWind v4** requires `nativewind-env.d.ts` (not `nativewind.d.ts`). Clear metro cache if styles don't apply: `npx expo start --clear`.
5. **`$$` in SQL functions** gets mangled by JS template literals. Execute function bodies as single statements, not split by semicolons.
6. **Supabase auth email confirmation** is on by default. Magic link handles both sign-up and sign-in (shouldCreateUser: true).
7. **Expo web** builds may need `react-native-worklets`, `react-native-css-interop`, and `@babel/runtime` installed explicitly.
