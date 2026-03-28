# Add Feature

Complete checklist for adding a new feature to the PRM app. Follow every step.

## Arguments
$ARGUMENTS — description of the feature to add

## Steps

### 1. Database
```bash
# Create table via the pg session pooler
node -e "
const { Client } = require('pg');
const c = new Client({
  host: 'aws-0-us-west-2.pooler.supabase.com', port: 5432,
  user: 'postgres.rymspebhcinjttcrmtow', password: '!i3fHR5NmrocwzZd',
  database: 'postgres', ssl: { rejectUnauthorized: false }
});
async function run() {
  await c.connect();
  // CREATE TABLE, ALTER TABLE ENABLE ROW LEVEL SECURITY, CREATE POLICY
  await c.end();
}
run();
"
```

### 2. Types
Add table types to `/workspaces/prm-sc/types/database.ts` following the existing pattern (Row, Insert, Update, Relationships).

### 3. Hook
Create `hooks/use[Feature].ts` following hook convention:
- Return `{ data, isLoading, error, refetch }`
- Use `useCallback` for refetch
- Error as string, loading starts true
- Import supabase from `@/lib/supabase`

### 4. Screen
- Create route file in `app/(app)/`
- Register in `app/(app)/_layout.tsx` as a Stack.Screen
- Use design tokens: bg-stone-50, rounded-xl bg-white shadow-sm, text-stone-900

### 5. Agent Tool
Add tool definition in `lib/tools.ts`:
- Name, description (3-4 sentences), parameters (JSON Schema)
- Execute function that calls Supabase
- Set `requiresApproval: true` for mutation tools
- Do NOT use `strict: true` or `additionalProperties: false` with optional params

### 6. Settings (if configurable)
Add management UI section in `app/(app)/(tabs)/settings.tsx`.

### 7. Verify
```bash
pnpm exec expo export --platform web
```

### 8. Test API (if external)
Run `/test-api` to validate any external API calls.
