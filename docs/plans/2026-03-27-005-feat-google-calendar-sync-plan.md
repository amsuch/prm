---
title: "feat: Google Calendar sync with auto-interaction matching"
type: feat
status: active
date: 2026-03-27
---

# Google Calendar Sync

## Overview

Connect Google Calendar to auto-create interactions from calendar events. Attendee emails are matched to existing contacts. Unmatched emails surface as suggestions to create new contacts or dismiss. Users can specify their own work emails so those are filtered out.

## Problem Frame

Users have meetings with people in their network but don't log them as interactions manually. Google Calendar already has this data — event title, time, and attendee emails. By syncing calendar events, we can auto-populate the interaction timeline without manual entry.

## Key Technical Decisions

- **No Edge Function needed for MVP**: We can call the Google Calendar API directly from the client using the `provider_token` from Supabase OAuth. Token refresh requires a server, but for MVP we can re-auth when the token expires (1 hour window is enough for a sync session).
- **Token storage**: Store `provider_token` and `provider_refresh_token` in a `google_tokens` table (RLS-protected, only user can see their own).
- **Sync approach**: On-demand "Sync Now" button. User triggers sync, app fetches events, matches emails, creates interactions.
- **Unmatched emails → suggestions**: Stored in `calendar_suggestions` table. User can "Create Contact" or "Dismiss". Dismissed suggestions can be restored.
- **User's own emails**: Stored in `user_emails` table. Filtered out during matching so the user doesn't appear as an attendee of their own meetings.

## Requirements Trace

- R1. Connect Google Calendar via OAuth (reuse existing Google sign-in with added scopes)
- R2. Fetch calendar events with attendees
- R3. Match attendee emails to existing contacts
- R4. Auto-create interactions (type: 'meeting') for matched contacts
- R5. Surface unmatched emails as suggestions (create contact or dismiss)
- R6. User can specify their own email addresses (work, personal) to exclude
- R7. Dismissed suggestions can be restored
- R8. Settings UI for managing calendar connection and own emails

## Scope Boundaries

- No real-time/webhook sync (on-demand only for MVP)
- No Edge Function (token refresh handled by re-auth)
- No write access to calendar (read-only)
- No multi-calendar support (primary calendar only)

## Implementation Units

- [ ] **Unit 1: Database Tables**

Create tables:
- `user_emails`: id, user_id, email, label ('work'/'personal'), created_at
- `calendar_sync_state`: user_id (PK), last_sync_at, sync_token, is_connected, created_at
- `calendar_suggestions`: id, user_id, email, display_name, event_title, event_date, status ('pending'/'dismissed'/'created'), created_contact_id, created_at

RLS on all. Execute against Supabase via pg client.

- [ ] **Unit 2: Google OAuth Scopes**

Modify sign-in to request Calendar scope when user opts in:
- Add a "Connect Google Calendar" button in Settings (not on initial sign-in — don't scare new users)
- When tapped, call `supabase.auth.signInWithOAuth` with added scope `calendar.events.readonly` + `access_type: 'offline'`
- Capture `provider_token` and `provider_refresh_token` in `onAuthStateChange`, store in `calendar_sync_state`
- Show connection status in Settings

- [ ] **Unit 3: Calendar Sync Logic**

Create `lib/calendarSync.ts`:
- `fetchCalendarEvents(accessToken, timeMin, timeMax)`: calls Google Calendar API, returns events with attendees
- `syncCalendar(userId, accessToken)`: full pipeline:
  1. Fetch events from last sync (or last 30 days if first sync)
  2. For each event with attendees:
     a. Filter out user's own emails (from `user_emails` table)
     b. For each remaining attendee email:
        - Check if email exists in `contact_emails` → if yes, create interaction
        - If not matched, create a `calendar_suggestions` row
  3. Update `calendar_sync_state` with `last_sync_at`
- `getCalendarSuggestions(userId)`: fetch pending suggestions
- `dismissSuggestion(id)`: set status to 'dismissed'
- `restoreSuggestion(id)`: set status back to 'pending'
- `createContactFromSuggestion(id, userId)`: create contact from suggestion email/name

- [ ] **Unit 4: User Emails Management**

In Settings, add "My Email Addresses" section:
- List user's emails with labels (work/personal)
- Add new email + label
- Delete existing
- These emails are excluded from attendee matching

- [ ] **Unit 5: Calendar Settings UI**

In Settings, add "Google Calendar" section:
- Connection status (connected/disconnected)
- "Connect Calendar" / "Disconnect" button
- "Sync Now" button with last sync time
- Sync progress indicator

- [ ] **Unit 6: Suggestions Screen**

New screen or section showing unmatched attendees:
- List of suggestions with email, name, event context
- "Create Contact" button → creates contact with email, navigates to edit
- "Dismiss" button → hides suggestion
- "Show Dismissed" toggle to view/restore dismissed suggestions
- Accessible from Settings or Dashboard

- [ ] **Unit 7: Dashboard Integration**

On the home dashboard, show:
- "Calendar connected" badge if connected
- "X unreviewed suggestions" card if there are pending suggestions
- Quick link to sync or view suggestions
