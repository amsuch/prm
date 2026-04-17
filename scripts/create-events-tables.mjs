// Creates events feature tables via Supabase Management API (direct pooler is blocked from devcontainer).
// Run with: node scripts/create-events-tables.mjs
const TOKEN = process.env.SUPABASE_ACCOUNT_TOKEN;
const PROJECT_REF = "rymspebhcinjttcrmtow";
const ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

if (!TOKEN) {
  console.error("Missing SUPABASE_ACCOUNT_TOKEN");
  process.exit(1);
}

const STATEMENTS = [
  // events table
  `CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    event_date DATE,
    location TEXT,
    url TEXT,
    description TEXT,
    notes TEXT,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE events ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view own events" ON events`,
  `CREATE POLICY "Users can view own events" ON events FOR SELECT USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can insert own events" ON events`,
  `CREATE POLICY "Users can insert own events" ON events FOR INSERT WITH CHECK (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can update own events" ON events`,
  `CREATE POLICY "Users can update own events" ON events FOR UPDATE USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can delete own events" ON events`,
  `CREATE POLICY "Users can delete own events" ON events FOR DELETE USING (auth.uid() = user_id)`,
  `CREATE INDEX IF NOT EXISTS events_user_id_idx ON events(user_id)`,
  `CREATE INDEX IF NOT EXISTS events_is_archived_idx ON events(is_archived)`,
  `CREATE INDEX IF NOT EXISTS events_user_archived_idx ON events(user_id, is_archived)`,
  `CREATE INDEX IF NOT EXISTS events_event_date_idx ON events(user_id, event_date DESC NULLS LAST)`,

  // event_categories table
  `CREATE TABLE IF NOT EXISTS event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'calendar-outline',
    color TEXT NOT NULL DEFAULT '#e0e7ff',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view system and own event categories" ON event_categories`,
  `CREATE POLICY "Users can view system and own event categories" ON event_categories FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can insert own event categories" ON event_categories`,
  `CREATE POLICY "Users can insert own event categories" ON event_categories FOR INSERT WITH CHECK (auth.uid() = user_id AND is_system = false)`,
  `DROP POLICY IF EXISTS "Users can update own event categories" ON event_categories`,
  `CREATE POLICY "Users can update own event categories" ON event_categories FOR UPDATE USING (auth.uid() = user_id AND is_system = false)`,
  `DROP POLICY IF EXISTS "Users can delete own event categories" ON event_categories`,
  `CREATE POLICY "Users can delete own event categories" ON event_categories FOR DELETE USING (auth.uid() = user_id AND is_system = false)`,

  // Seed system categories
  `INSERT INTO event_categories (name, icon, color, is_system)
   SELECT * FROM (VALUES
     ('Conference', 'business-outline', '#dbeafe', true),
     ('Meetup', 'people-outline', '#e0e7ff', true),
     ('Party', 'wine-outline', '#fce7f3', true),
     ('Workshop', 'construct-outline', '#fef3c7', true),
     ('Wedding', 'heart-outline', '#fee2e2', true),
     ('Concert', 'musical-notes-outline', '#ede9fe', true),
     ('Sports', 'football-outline', '#dcfce7', true),
     ('Dinner', 'restaurant-outline', '#ffedd5', true),
     ('Travel', 'airplane-outline', '#cffafe', true),
     ('Other', 'calendar-outline', '#f3f4f6', true)
   ) AS v(name, icon, color, is_system)
   WHERE NOT EXISTS (SELECT 1 FROM event_categories WHERE is_system = true)`,

  // event_people table
  `CREATE TABLE IF NOT EXISTS event_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    role TEXT,
    notes TEXT,
    promoted_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE event_people ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view own event people" ON event_people`,
  `CREATE POLICY "Users can view own event people" ON event_people FOR SELECT USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can insert own event people" ON event_people`,
  `CREATE POLICY "Users can insert own event people" ON event_people FOR INSERT WITH CHECK (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can update own event people" ON event_people`,
  `CREATE POLICY "Users can update own event people" ON event_people FOR UPDATE USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can delete own event people" ON event_people`,
  `CREATE POLICY "Users can delete own event people" ON event_people FOR DELETE USING (auth.uid() = user_id)`,
  `CREATE INDEX IF NOT EXISTS event_people_event_id_idx ON event_people(event_id)`,
  `CREATE INDEX IF NOT EXISTS event_people_user_id_idx ON event_people(user_id)`,
];

async function run(sql) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

async function main() {
  for (const sql of STATEMENTS) {
    const preview = sql.replace(/\s+/g, " ").slice(0, 80);
    try {
      await run(sql);
      console.log("OK", preview);
    } catch (e) {
      console.error("FAIL", preview);
      throw e;
    }
  }

  const tables = await run(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN ('events','event_people','event_categories')
     ORDER BY table_name`,
  );
  console.log("Tables present:", tables);

  const cats = await run(
    `SELECT count(*)::int AS n FROM event_categories WHERE is_system = true`,
  );
  console.log("System categories:", cats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
