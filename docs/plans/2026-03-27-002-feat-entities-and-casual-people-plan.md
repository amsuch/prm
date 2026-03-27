---
title: "feat: Entities view with casual people and promotion to contacts"
type: feat
status: active
date: 2026-03-27
---

# Entities View with Casual People

## Overview

Add an "Entities" concept — places/organizations (restaurants, companies, gyms, clubs) that the user frequents. Each entity can have "people" associated with it (waitstaff, baristas, receptionists, trainers) who are tracked casually without being full contacts. These people can be promoted to real contacts when the relationship deepens.

## Problem Frame

Users interact with people at places they frequent — their barista, their trainer, the waiter at their favorite restaurant. These aren't full "contacts" (no email, no LinkedIn, no relationship tracking needed), but the user wants to remember names and roles. When one of these people becomes important enough, they should be promotable to a real contact with full features.

## Data Model Decision

**Option A (chosen): Separate `entities` and `entity_people` tables**

This is cleaner than overloading the contacts table because:
- Entities are fundamentally different from contacts (they have addresses, hours, categories — not emails/phones)
- Casual people have minimal fields (just name + role) — no need for the full contact schema
- Promotion to contact is a one-time copy operation, not a mode toggle
- Keeps the contacts table clean for real relationship management
- Avoids bloating the contact list with hundreds of casual acquaintances

**Option B (rejected): Contacts with a `is_casual` flag**
- Would pollute the contacts list, search, and stats
- Would require filtering casual people out of every existing query
- Doesn't model the entity (place) concept at all

## Requirements Trace

- R1. Create/edit/delete entities (places/organizations) with name, type, address, notes
- R2. Add casual people to entities with name, role, and optional notes
- R3. Promote a casual person to a full contact (copies data, links to entity)
- R4. Browse entities in a dedicated tab/view
- R5. View entity detail with its associated people
- R6. Agent tools: create entities, add people, promote people, query entities

## Scope Boundaries

- No entity-to-entity relationships (a restaurant is not "connected to" a gym)
- No interaction tracking on casual people (only full contacts get that)
- No entity import from external sources
- No map/location features

## Key Technical Decisions

- **Entity types**: Free-text `category` field with autocomplete from previous values (restaurant, company, gym, club, school, etc.)
- **Entity people → contact promotion**: Creates a new contact record, copies name/role as job_title, links back to entity via a `contact_urls` entry or `source = 'entity'` with `source_id = entity_id`
- **Navigation**: Replace the Import tab with an Entities tab. Import moves to a button on the Contacts tab and Settings.
- **RLS**: Same pattern as contacts — `user_id` on both tables, auth.uid() policies

## Implementation Units

- [ ] **Unit 1: Database Schema**

**Goal:** Create `entities` and `entity_people` tables with RLS.

**Files:**
- Modify: `supabase/schema.sql` (add new tables)
- Modify: `types/database.ts` (add new types)

**Approach:**
- `entities` table: id, user_id, name, category, address, phone, website, notes, avatar_url, is_archived, created_at, updated_at
- `entity_people` table: id, entity_id, user_id, first_name, last_name, role, notes, promoted_contact_id (null until promoted), created_at
- RLS: user_id = auth.uid() on both
- Indexes on user_id, entity_id

**Verification:**
- Tables created in Supabase with RLS active

- [ ] **Unit 2: Entity CRUD + Hooks**

**Goal:** Create hooks and lib functions for entity operations.

**Files:**
- Create: `hooks/useEntities.ts` — list entities with search/filter
- Create: `hooks/useEntity.ts` — single entity with its people
- Create: `lib/entities.ts` — CRUD operations, promote person to contact

**Approach:**
- `useEntities`: fetch entities for user, search by name/category, sort
- `useEntity(id)`: fetch entity + entity_people where entity_id matches
- `lib/entities.ts`: createEntity, updateEntity, deleteEntity, addPerson, removePerson, promotePerson (creates contact, sets promoted_contact_id)

**Verification:**
- CRUD operations work against Supabase

- [ ] **Unit 3: Entities Tab Screen**

**Goal:** Build the entities list screen as a new tab.

**Files:**
- Create: `app/(app)/(tabs)/entities.tsx`
- Modify: `app/(app)/(tabs)/_layout.tsx` — replace Import tab with Entities, move import to contacts
- Create: `components/EntityCard.tsx`

**Approach:**
- FlatList of entities with search bar
- Each card shows: name, category badge, people count, address snippet
- FAB to add new entity
- Tap navigates to entity detail

**Verification:**
- Entities tab shows in navigation
- List renders with search working

- [ ] **Unit 4: Entity Detail + People Management**

**Goal:** Build entity detail screen with people list and management.

**Files:**
- Create: `app/(app)/entity/[id].tsx` — entity detail
- Create: `app/(app)/entity/new.tsx` — create entity
- Create: `app/(app)/entity/[id]/edit.tsx` — edit entity
- Create: `components/EntityPersonCard.tsx` — person row with promote button
- Create: `components/AddPersonModal.tsx` — add casual person form
- Modify: `app/(app)/_layout.tsx` — add entity routes

**Approach:**
- Entity detail: header with name/category/address, people section as list
- Each person shows name, role, and either "Promote to Contact" button or linked contact chip (if already promoted)
- Add person modal: first name, last name (optional), role, notes
- Promote: creates contact with first_name, last_name, job_title=role, source='entity', source_id=entity.id, then sets promoted_contact_id on entity_people row

**Verification:**
- Can create entity, add people, promote person to contact
- Promoted person shows link to their contact profile

- [ ] **Unit 5: Agent Tools for Entities**

**Goal:** Add entity-related intents to the agent.

**Files:**
- Modify: `lib/queryParser.ts` — add entity intents
- Modify: `lib/agent.ts` — add entity handlers

**Approach:**
- New intents:
  - `create_entity`: "add a restaurant called Joe's Diner"
  - `add_entity_person`: "add Sarah as waitress at Joe's Diner"
  - `promote_person`: "promote Sarah from Joe's Diner to a contact"
  - `entity_lookup`: "who works at Joe's Diner?" / "show me my restaurants"
- All action intents go through HITL approval
- `isActionIntent` updated to include new mutation intents

**Verification:**
- Agent can create entities and people via chat
- HITL approval works for entity mutations

- [ ] **Unit 6: Navigation Restructure**

**Goal:** Move Import from tab to contacts screen, make room for Entities tab.

**Files:**
- Modify: `app/(app)/(tabs)/_layout.tsx` — swap Import tab for Entities
- Modify: `app/(app)/(tabs)/contacts.tsx` — add Import button in header/empty state

**Approach:**
- 5 tabs: Home, Contacts, Entities, Ask, Settings
- Import accessible from: contacts empty state CTA, contacts header button, settings
- Import routes remain at `/(app)/import/csv` and `/(app)/import/device` — just no longer a tab

**Verification:**
- Entities tab visible and functional
- Import still accessible from contacts screen

## System-Wide Impact

- **Navigation**: Import tab replaced by Entities tab. Import routes unchanged, just entry points moved.
- **Agent**: 4 new intents added to query parser + agent executor
- **Database**: 2 new tables, no changes to existing tables
- **Types**: New types added, no breaking changes

## Risks

- **Promotion logic**: Need to handle edge case where person is promoted twice (check promoted_contact_id before creating)
- **Entity category autocomplete**: Same pattern as company autocomplete on ContactForm
