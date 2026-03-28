# Add Database Table

Create a new Supabase table with RLS, add TypeScript types, and verify.

## Arguments
$ARGUMENTS — table name and columns description

## Steps

### 1. Create table via session pooler
```bash
node -e "
const { Client } = require('pg');
const c = new Client({
  host: 'aws-0-us-west-2.pooler.supabase.com', port: 5432,
  user: 'postgres.rymspebhcinjttcrmtow', password: '!i3fHR5NmrocwzZd',
  database: 'postgres', ssl: { rejectUnauthorized: false }
});
async function run() {
  await c.connect();

  await c.query(\`
    CREATE TABLE IF NOT EXISTS [table_name] (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      -- columns here
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )
  \`);

  await c.query('ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY');
  await c.query(\`CREATE POLICY \"Users manage own [table]\" ON [table_name] FOR ALL USING (auth.uid() = user_id)\`).catch(()=>{});
  await c.query('CREATE INDEX IF NOT EXISTS [table]_user_idx ON [table_name](user_id)');

  // Verify
  const tables = await c.query(\"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='[table_name]'\");
  console.log('Created:', tables.rows.length > 0 ? 'YES' : 'NO');

  await c.end();
}
run().catch(e => console.error(e.message));
"
```

### 2. Add types to database.ts
Add Row, Insert, Update, and Relationships types to `/workspaces/prm-sc/types/database.ts` following the existing pattern.

### 3. Update schema.sql
Add the CREATE TABLE statement to `/workspaces/prm-sc/supabase/schema.sql` for reference.

### 4. Verify
```bash
pnpm exec expo export --platform web
```
