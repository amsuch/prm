---
title: "feat: Persistent Chat, Markdown, Category Edit, Photo Fetch, Notes, Search, Branding"
type: feat
status: active
date: 2026-03-29
---

# PRM Seven-Fix Feature Bundle

## Overview

Seven user-reported issues and feature gaps: (1) chat session persistence and creation UX, (2) markdown rendering in agent chat, (3) entity category editing broken, (4) photo fetch non-functional with no logging, (5) contact notes with markdown, (6) advanced contact search/filtering on all fields, (7) rename "Personal RM" to "PRM" everywhere.

## Problem Frame

The PRM app has accumulated several rough edges after rapid development. The user cannot edit entity categories despite UI existing. The photo fetch button silently fails. Agent chat responses render raw markdown. Contact search only supports basic filters. Notes display as plain text with no markdown. Branding is inconsistent.

## Requirements Trace

- R1. Agent chat sessions must persist across app restarts and the user must be able to create new sessions
- R2. Agent chat messages must render markdown formatting (bold, lists, code, headers)
- R3. Entity categories must be editable (name, icon, color) from settings
- R4. Fetch Photo must work via web search (not just LinkedIn), with comprehensive logging
- R5. Contacts must have a notes field with markdown rendering, visible when populated
- R6. Contact search must support filtering on any field and any combination of fields
- R7. All instances of "Personal RM" / "PersonalCRM" must be replaced with "PRM"

## Scope Boundaries

- No streaming for agent responses (future work)
- No server-side proxy for photo fetch -- use Supabase Edge Function or direct image search API
- No rich text editor for notes -- plain text input with markdown preview
- No saved filter presets -- just combinable filter fields
- Search improvements apply to contacts tab only (Ask tab already has AdvancedFilters)

## Context & Research

### Relevant Code and Patterns

- Chat persistence: `hooks/useChatSessions.ts`, `hooks/useChatMessages.ts`, `app/(app)/(tabs)/ask.tsx` (already has DB tables, drawer, session switching)
- Chat rendering: `components/ChatBubble.tsx` line 75 renders plain `<Text>` for agent text
- Entity categories: `hooks/useEntityCategories.ts` has full CRUD, `components/EntityCategoryManager.tsx` has inline editing UI -- likely an RLS policy issue blocking updates
- Photo fetch: `lib/linkedin.ts` only extracts og:image from LinkedIn pages, `components/ContactHeader.tsx` only shows button when LinkedIn URL exists and no avatar
- Notes: `contacts.notes` column exists in DB, `app/(app)/contact/[id].tsx` line 274 renders plain text only when truthy
- Search: `lib/search.ts` has `SearchFilters` type (query, tags, company, lastContacted, source), `components/AdvancedFilters.tsx` is only wired to Ask tab
- Branding: `app/sign-in.tsx:200` says "Personal RM", `lib/linkedin.ts:39` says "PersonalCRM/1.0"

### Institutional Learnings

- Design tokens: use `indigo-600` primary, `stone-*` for grays, never hardcode hex
- useCallback deps: always include all referenced variables (prior stale closure bug)
- RLS on entity_categories was previously fixed (memory obs 217) but may have regressed
- LinkedIn photo fetch has fundamental CORS limitation on web
- Always verify build with `pnpm exec expo export --platform web`

## Key Technical Decisions

- **Markdown library**: Use `react-native-markdown-display` for both chat bubbles and contact notes. It's the most popular RN markdown renderer, supports custom styles, and works on both web and native. A single `<MarkdownText>` wrapper component will be shared.
- **Photo fetch strategy**: Replace LinkedIn-only approach with a general image search. Use a Supabase Edge Function that calls a search API (Google Custom Search or similar) to find the best profile photo for a person by name + company. Add comprehensive `console.log` logging at every step for debugging.
- **Advanced filters on contacts tab**: Bring `AdvancedFilters` component to the contacts tab. Extend `SearchFilters` type with `jobTitle`, `entityId`, `hasEmail`, `hasPhone` fields. Reuse existing search infrastructure.
- **Entity category RLS fix**: Check and fix the UPDATE RLS policy on `entity_categories` table. The `updateCategory` hook function works correctly but RLS may be blocking the write.

## Open Questions

### Resolved During Planning

- **Which markdown library?** `react-native-markdown-display` -- most popular, supports custom styles, works with RN 0.76
- **How to fetch photos without LinkedIn?** Supabase Edge Function with image search API. Fallback: simple Google Images scraping via server-side fetch.
- **Where do advanced filters go?** Bring `AdvancedFilters` modal to the contacts tab, extending it with additional filter fields.

### Deferred to Implementation

- **Exact Google Custom Search API setup**: May need API key configuration in settings or env vars
- **react-native-markdown-display compatibility with Expo SDK 52**: Need to verify at install time
- **Edge Function deployment**: May need Supabase CLI or Management API setup

## Implementation Units

- [ ] **Unit 1: Branding — Rename "Personal RM" to "PRM"**

**Goal:** Unify all branding to "PRM" across the codebase.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `app/sign-in.tsx` (line 200: "Personal RM" -> "PRM")
- Modify: `lib/linkedin.ts` (line 39: "PersonalCRM/1.0" -> "PRM/1.0")
- Modify: `supabase/schema.sql` (line 2: comment only)

**Approach:**
- Simple string replacements in 3 files
- Do NOT change `app.json` name (already "PRM"), `CLAUDE.md` description, or plan docs

**Patterns to follow:**
- Existing `app.json` already uses "PRM"

**Test scenarios:**
- Happy path: grep for "Personal RM" and "PersonalCRM" returns zero results after change

**Verification:**
- `grep -r "Personal RM\|PersonalCRM" app/ lib/ components/` returns empty

---

- [ ] **Unit 2: Install Markdown Library and Create Shared Component**

**Goal:** Install `react-native-markdown-display` and create a reusable `<MarkdownText>` component styled to match the app's design tokens.

**Requirements:** R2, R5

**Dependencies:** None

**Files:**
- Modify: `package.json` (add dependency)
- Create: `components/MarkdownText.tsx`

**Approach:**
- Install `react-native-markdown-display` via pnpm
- Create `MarkdownText` component that wraps the library with NativeWind-compatible styles
- Style markdown elements to match design tokens: headings use `stone-900`, body uses `text-base text-stone-900`, code blocks use `bg-stone-100 rounded-lg`, links use `text-indigo-600`
- Accept a `style` prop for context-specific overrides (chat bubble vs notes section)
- If `react-native-markdown-display` has compatibility issues, fall back to a simple regex-based renderer that handles bold, italic, code, lists, and headers

**Patterns to follow:**
- Existing component pattern: named export, NativeWind classes, `Colors` constants

**Test scenarios:**
- Happy path: renders `**bold**` as bold text, `# Header` as larger text, `` `code` `` with background
- Edge case: empty string renders nothing, plain text without markdown renders normally
- Edge case: malformed markdown (unclosed bold) renders gracefully without crashing

**Verification:**
- Build passes: `pnpm exec expo export --platform web`
- Component renders markdown formatting visually

---

- [ ] **Unit 3: Markdown Rendering in Agent Chat**

**Goal:** Replace plain text rendering in ChatBubble with markdown-aware rendering for agent messages.

**Requirements:** R2

**Dependencies:** Unit 2

**Files:**
- Modify: `components/ChatBubble.tsx` (line 75: replace `<Text>` with `<MarkdownText>`)

**Approach:**
- Import `MarkdownText` from Unit 2
- Replace `<Text className="text-base text-stone-900">{text}</Text>` on line 75 with `<MarkdownText>{text}</MarkdownText>`
- User messages remain plain `<Text>` in the indigo bubble (no markdown needed for user input)
- Ensure markdown styles work within the white chat bubble container

**Patterns to follow:**
- Existing ChatBubble structure -- only modify the agent text rendering

**Test scenarios:**
- Happy path: agent response with `**bold**` text renders bold
- Happy path: agent response with bullet list renders formatted list
- Happy path: agent response with code block renders with monospace + background
- Edge case: very long code block doesn't overflow the bubble container

**Verification:**
- Agent responses display formatted markdown instead of raw asterisks/hashes

---

- [ ] **Unit 4: Contact Notes with Markdown Rendering**

**Goal:** Render contact notes using markdown and show the notes section even with an "add notes" prompt when empty.

**Requirements:** R5

**Dependencies:** Unit 2

**Files:**
- Modify: `app/(app)/contact/[id].tsx` (lines 273-288: notes section)

**Approach:**
- Replace the plain `<Text>` notes display with `<MarkdownText>` component
- Remove the `{contact.notes && ...}` conditional -- always show the Notes section
- When notes are empty, show an "Add Notes" prompt that navigates to the edit form
- Keep the collapsible section behavior

**Patterns to follow:**
- Existing section rendering pattern in `contact/[id].tsx` (SectionHeader + card)
- Empty state pattern: Ionicons icon + subtle text + action button

**Test scenarios:**
- Happy path: notes with markdown formatting (bold, lists) render correctly
- Happy path: empty notes show "Add Notes" prompt with edit button
- Happy path: notes section is collapsible like other sections
- Edge case: very long notes with many markdown elements render without performance issues

**Verification:**
- Notes section always visible on contact detail page
- Markdown formatting renders correctly in notes

---

- [ ] **Unit 5: Fix Entity Category Editing**

**Goal:** Diagnose and fix why entity category editing doesn't work. Add error visibility.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `hooks/useEntityCategories.ts` (add logging to updateCategory)
- Modify: `components/EntityCategoryManager.tsx` (improve error display)
- Possibly: RLS policy fix via direct DB query

**Approach:**
- Add `console.log` statements to `updateCategory` in the hook to log the request and response
- Check the RLS UPDATE policy on `entity_categories` table via SQL query
- The likely issue: RLS UPDATE policy may not exist or may be too restrictive. Need `CREATE POLICY "Users can update own categories" ON entity_categories FOR UPDATE USING (auth.uid() = user_id)`
- Test by updating a user-created category (not system) and checking the response
- Add visible error toast/alert in `EntityCategoryManager` when update fails
- Also verify the `CategoryRow` component properly passes `onUpdate` and the save flow works end-to-end

**Patterns to follow:**
- Existing RLS patterns: `auth.uid() = user_id` on all tables
- Error display: `Alert.alert` on native, `window.alert` on web (existing delete pattern)

**Test scenarios:**
- Happy path: user can tap a category row, edit name/icon/color, save successfully
- Happy path: updated category appears immediately in the list after save
- Error path: attempting to edit with empty name shows validation error
- Error path: RLS rejection surfaces a visible error message, not silent failure

**Verification:**
- User can edit their own categories from Settings
- Errors are logged to console and shown to user

---

- [ ] **Unit 6: Photo Fetch with Web Search and Logging**

**Goal:** Replace the LinkedIn-only photo fetch with a web search approach that finds profile photos by name. Add comprehensive logging.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `lib/linkedin.ts` -> rename/refactor to `lib/photoSearch.ts`
- Modify: `components/ContactHeader.tsx` (update import, show button for all contacts, not just LinkedIn)
- Create: `lib/photoSearch.ts` (new photo search logic)

**Approach:**
- Create `lib/photoSearch.ts` with a `fetchContactPhoto(name: string, company?: string, linkedinUrl?: string)` function
- Strategy order: (1) try LinkedIn og:image if URL available, (2) try Clearbit Logo API for company avatar, (3) try Google search for person's profile image
- For Google search: use `https://www.google.com/search?q={name}+{company}+profile+photo&tbm=isch` and extract first relevant image. This needs server-side fetch due to CORS.
- Since we can't easily deploy an Edge Function right now, implement a client-side approach with multiple fallback strategies and detailed logging
- Add `console.log` at EVERY step: function entry, URL being fetched, response status, extracted image URL, errors
- Show the "Fetch Photo" button for ALL contacts (not just those with LinkedIn URLs)
- Allow re-fetching even when avatar_url already exists (add a "refresh" option)
- Keep `isLinkedInUrl` helper for the LinkedIn-first strategy

**Patterns to follow:**
- Existing `fetchLinkedInPhoto` pattern for the LinkedIn strategy
- ContactHeader button pattern for the UI trigger

**Test scenarios:**
- Happy path: clicking "Fetch Photo" on a contact with LinkedIn URL extracts and saves the photo
- Happy path: clicking "Fetch Photo" on a contact without LinkedIn URL attempts alternative search
- Error path: all fetch strategies fail, user sees informative error message with logged details
- Happy path: console shows detailed logs at each step for debugging
- Edge case: contact with existing avatar shows "Update Photo" instead of "Fetch Photo"

**Verification:**
- "Fetch Photo" button appears for all contacts
- Console logs show detailed fetch attempt progression
- Photo is saved to contact when found

---

- [ ] **Unit 7: Advanced Contact Search and Filtering**

**Goal:** Bring full combinable filter support to the contacts tab so users can filter on any field and any combination.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `lib/search.ts` (extend `SearchFilters` with `jobTitle`, `entityId`, `hasEmail`, `hasPhone`, `hasNotes`)
- Modify: `components/AdvancedFilters.tsx` (add new filter fields)
- Modify: `app/(app)/(tabs)/contacts.tsx` (integrate AdvancedFilters, replace basic FilterChips)
- Modify: `hooks/useContacts.ts` (accept full `SearchFilters` instead of simple `SortOption`/`FilterOption`)

**Approach:**
- Extend `SearchFilters` type with: `jobTitle: string`, `entityId: string`, `hasEmail: boolean | null`, `hasPhone: boolean | null`, `hasNotes: boolean | null`
- Add these filter fields to `AdvancedFilters` modal: job title text input, entity dropdown, has email/phone/notes toggles
- Wire `AdvancedFilters` into contacts tab: add a filter icon button in the header that opens the modal
- Update `buildFilterQuery` in `search.ts` to handle new filters:
  - `jobTitle`: ILIKE on `job_title` column
  - `entityId`: subquery through `entity_people` table
  - `hasEmail`/`hasPhone`: EXISTS subquery on `contact_emails`/`contact_phones`
  - `hasNotes`: `notes IS NOT NULL AND notes != ''`
- Refactor `useContacts` to accept the full `SearchFilters` type, replacing the separate `SortOption` and `FilterOption` params
- Show active filter count as a badge on the filter button
- Keep the basic `FilterChips` (All, Stale, Recent, tags) as quick-access shortcuts that populate the underlying SearchFilters

**Patterns to follow:**
- Existing `AdvancedFilters` modal structure
- Existing `buildFilterQuery` for adding new clauses
- Existing `FilterChips` quick-filter pattern

**Test scenarios:**
- Happy path: filter by job title "Engineer" shows only contacts with matching job title
- Happy path: filter by "has email" shows only contacts with at least one email
- Happy path: combine tag + company + last contacted filters simultaneously
- Happy path: active filter count shows on the filter button badge
- Edge case: clearing all filters returns to the full contact list
- Edge case: filter by entity shows contacts linked via entity_people table
- Integration: text search combined with filters narrows results correctly

**Verification:**
- Contacts tab has a filter button that opens the AdvancedFilters modal
- All filter fields work individually and in combination
- Filter chip shortcuts still work alongside advanced filters

## System-Wide Impact

- **Markdown renderer**: New dependency (`react-native-markdown-display`) affects bundle size. Used in two surfaces: ChatBubble and contact notes. Must verify Expo web build compatibility.
- **Search refactor**: Changing `useContacts` hook signature affects `contacts.tsx` only. The Ask tab's search remains separate.
- **Photo fetch**: Changing from LinkedIn-only to multi-strategy affects `ContactHeader` and adds a new lib file. No other components reference `fetchLinkedInPhoto` directly.
- **RLS fix**: Database policy change on `entity_categories` -- safe because it's adding/fixing a policy, not removing one.
- **Branding**: String changes only, no API or behavior impact.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `react-native-markdown-display` incompatible with Expo SDK 52 / RN 0.76 | Fall back to simple regex-based markdown renderer |
| Google image search blocked by CORS on web | Implement multiple fallback strategies; log failures; consider Edge Function in future |
| Entity category RLS fix may require Supabase admin access | Use existing DB connection string via pg pooler |
| Bundle size increase from markdown library | Library is ~30KB gzipped, acceptable for the functionality |

## Sources & References

- Related code: `components/ChatBubble.tsx`, `lib/search.ts`, `hooks/useEntityCategories.ts`
- Related plans: `docs/plans/2026-03-28-001-fix-dev-skills-and-persistent-chat-plan.md`
- Memory: feedback_dev_patterns.md (design tokens), feedback_testing.md (useCallback deps)
