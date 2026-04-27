-- PRM-SC Database Schema
-- PRM (Personal Relationship Manager)

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- PROFILES (linked to Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  department TEXT,
  birthday DATE,
  notes TEXT,
  avatar_url TEXT,
  source TEXT DEFAULT 'manual',
  source_id TEXT,
  custom_fields JSONB DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  fts TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(job_title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'C')
  ) STORED
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts" ON contacts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON contacts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON contacts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_fts_idx ON contacts USING gin(fts);
CREATE INDEX IF NOT EXISTS contacts_custom_fields_idx ON contacts USING gin(custom_fields);
CREATE INDEX IF NOT EXISTS contacts_source_idx ON contacts(user_id, source, source_id);
CREATE INDEX IF NOT EXISTS contacts_name_trgm_idx ON contacts USING gin (
  (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS contacts_last_contacted_idx ON contacts(user_id, last_contacted_at DESC NULLS LAST);

-- ============================================================
-- CONTACT EMAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'personal',
  email TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contact emails" ON contact_emails
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_emails.contact_id AND contacts.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS contact_emails_contact_idx ON contact_emails(contact_id);

-- ============================================================
-- CONTACT PHONES
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'mobile',
  phone TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE contact_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contact phones" ON contact_phones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_phones.contact_id AND contacts.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS contact_phones_contact_idx ON contact_phones(contact_id);

-- ============================================================
-- CONTACT URLS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'website',
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE contact_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contact urls" ON contact_urls
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_urls.contact_id AND contacts.user_id = auth.uid())
  );

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tags" ON tags
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tags_user_id_idx ON tags(user_id);

-- ============================================================
-- CONTACT TAGS (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contact tags" ON contact_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid())
  );

-- ============================================================
-- RELATIONSHIP TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS relationship_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reverse_name TEXT,
  category TEXT DEFAULT 'other',
  is_symmetric BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false
);

ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relationship types" ON relationship_types
  FOR SELECT USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "Users can manage own relationship types" ON relationship_types
  FOR ALL USING (auth.uid() = user_id);

-- Seed default relationship types
INSERT INTO relationship_types (name, reverse_name, category, is_symmetric, is_system) VALUES
  ('Spouse', 'Spouse', 'family', true, true),
  ('Partner', 'Partner', 'family', true, true),
  ('Parent', 'Child', 'family', false, true),
  ('Child', 'Parent', 'family', false, true),
  ('Sibling', 'Sibling', 'family', true, true),
  ('Friend', 'Friend', 'social', true, true),
  ('Colleague', 'Colleague', 'professional', true, true),
  ('Manager', 'Report', 'professional', false, true),
  ('Report', 'Manager', 'professional', false, true),
  ('Mentor', 'Mentee', 'professional', false, true),
  ('Mentee', 'Mentor', 'professional', false, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CONTACT RELATIONSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_a_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship_type_id UUID NOT NULL REFERENCES relationship_types(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(contact_a_id, contact_b_id, relationship_type_id),
  CHECK (contact_a_id != contact_b_id)
);

ALTER TABLE contact_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contact relationships" ON contact_relationships
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_relationships.contact_a_id AND contacts.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS contact_rel_a_idx ON contact_relationships(contact_a_id);
CREATE INDEX IF NOT EXISTS contact_rel_b_idx ON contact_relationships(contact_b_id);

-- ============================================================
-- INTERACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  direction TEXT,
  title TEXT,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own interactions" ON interactions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS interactions_contact_idx ON interactions(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS interactions_user_idx ON interactions(user_id, occurred_at DESC);

-- Trigger: update contact last_contacted_at on new interaction
CREATE OR REPLACE FUNCTION update_contact_last_contacted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET last_contacted_at = NEW.occurred_at,
      updated_at = now()
  WHERE id = NEW.contact_id
    AND (last_contacted_at IS NULL OR last_contacted_at < NEW.occurred_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_interaction_update_contact ON interactions;
CREATE TRIGGER trg_interaction_update_contact
  AFTER INSERT ON interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_contacted();

-- ============================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, field_key)
);

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own custom fields" ON custom_field_definitions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- REMINDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  recurrence TEXT DEFAULT 'none',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reminders" ON reminders
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- SEARCH FUNCTION: Combined FTS + Trigram
-- ============================================================
CREATE OR REPLACE FUNCTION search_contacts(
  search_query TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  source TEXT,
  last_contacted_at TIMESTAMPTZ,
  custom_fields JSONB,
  is_archived BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.company,
    c.job_title,
    (SELECT ce.email FROM contact_emails ce WHERE ce.contact_id = c.id AND ce.is_primary = true LIMIT 1),
    (SELECT cp.phone FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.is_primary = true LIMIT 1),
    c.avatar_url,
    c.source,
    c.last_contacted_at,
    c.custom_fields,
    c.is_archived,
    c.created_at,
    c.updated_at,
    greatest(
      similarity(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''), search_query),
      similarity(coalesce(c.company, ''), search_query),
      ts_rank(c.fts, websearch_to_tsquery('english', search_query))
    )::REAL AS rank
  FROM contacts c
  WHERE c.user_id = p_user_id
    AND c.is_archived = false
    AND (
      (coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) % search_query
      OR c.company % search_query
      OR c.fts @@ websearch_to_tsquery('english', search_query)
      OR c.first_name ILIKE '%' || search_query || '%'
      OR c.last_name ILIKE '%' || search_query || '%'
    )
  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- HELPER: Get relationships for a contact (both directions)
-- Requires the contact to belong to the calling user.
-- ============================================================
CREATE OR REPLACE FUNCTION get_contact_relationships(p_contact_id UUID)
RETURNS TABLE (
  relationship_id UUID,
  related_contact_id UUID,
  related_first_name TEXT,
  related_last_name TEXT,
  related_company TEXT,
  related_avatar_url TEXT,
  relationship_name TEXT,
  relationship_category TEXT,
  notes TEXT
) AS $$
BEGIN
  -- Verify the contact belongs to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;

  RETURN QUERY
  -- Relationships where this contact is A
  SELECT
    cr.id,
    cr.contact_b_id,
    c.first_name,
    c.last_name,
    c.company,
    c.avatar_url,
    rt.name,
    rt.category,
    cr.notes
  FROM contact_relationships cr
  JOIN contacts c ON c.id = cr.contact_b_id
  JOIN relationship_types rt ON rt.id = cr.relationship_type_id
  WHERE cr.contact_a_id = p_contact_id

  UNION ALL

  -- Relationships where this contact is B (show reverse name)
  SELECT
    cr.id,
    cr.contact_a_id,
    c.first_name,
    c.last_name,
    c.company,
    c.avatar_url,
    COALESCE(rt.reverse_name, rt.name),
    rt.category,
    cr.notes
  FROM contact_relationships cr
  JOIN contacts c ON c.id = cr.contact_a_id
  JOIN relationship_types rt ON rt.id = cr.relationship_type_id
  WHERE cr.contact_b_id = p_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- ENRICHMENT QUEUE (server-side background enrichment via Parallel API)
-- ============================================================
CREATE TABLE IF NOT EXISTS enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('linkedin', 'email', 'name')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_json JSONB,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrichment jobs" ON enrichment_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrichment jobs" ON enrichment_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON enrichment_queue
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_pending
  ON enrichment_queue (status, created_at)
  WHERE status = 'pending';

-- ============================================================
-- CALENDAR SYNC STATE (Google Calendar OAuth + sync cursor)
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_sync_state (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  provider_token TEXT,
  provider_refresh_token TEXT,
  provider_token_expires_at TIMESTAMPTZ,
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE calendar_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar sync state" ON calendar_sync_state
  FOR ALL USING (auth.uid() = user_id);

-- Backfill the new column on existing deployments.
ALTER TABLE calendar_sync_state
  ADD COLUMN IF NOT EXISTS provider_token_expires_at TIMESTAMPTZ;

-- ============================================================
-- CALENDAR SUGGESTIONS (unmatched attendees queued for review)
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  event_title TEXT,
  event_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE calendar_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar suggestions" ON calendar_suggestions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS calendar_suggestions_user_status_idx
  ON calendar_suggestions(user_id, status, created_at DESC);

-- One pending suggestion per (user, email). Allows multiple historical rows
-- (dismissed/created) for the same email but blocks duplicate active ones.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_suggestions_pending_unique
  ON calendar_suggestions(user_id, lower(email))
  WHERE status = 'pending';

-- ============================================================
-- INTERACTION DEDUP INDEX (calendar sync)
-- ============================================================
-- syncCalendar writes metadata.dedup_key = `${event.id}:${contactId}` for every
-- meeting interaction it creates. This unique index makes re-syncs safe even
-- under races: the second insert hits 23505 and is silently ignored.
CREATE UNIQUE INDEX IF NOT EXISTS interactions_calendar_dedup_idx
  ON interactions ((metadata->>'dedup_key'))
  WHERE type = 'meeting' AND metadata->>'dedup_key' IS NOT NULL;
