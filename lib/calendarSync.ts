import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: { email: string; displayName?: string; self?: boolean }[];
};

export type SyncResult = {
  eventsProcessed: number;
  interactionsCreated: number;
  suggestionsCreated: number;
};

export type Suggestion = Tables<"calendar_suggestions">;

/**
 * Thrown by fetchCalendarEvents when the access token is rejected (401/403).
 * Callers (the useCalendarSync hook) catch this, refresh via the Edge Function,
 * and retry once with the new token.
 */
export class CalendarTokenExpiredError extends Error {
  constructor(message = "Google Calendar access token expired") {
    super(message);
    this.name = "CalendarTokenExpiredError";
  }
}

// ---------------------------------------------------------------------------
// Google Calendar API
// ---------------------------------------------------------------------------

const CALENDAR_API_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  syncToken?: string,
): Promise<{ events: CalendarEvent[]; nextSyncToken: string | null }> {
  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams();

    if (syncToken) {
      // Incremental sync – only syncToken allowed (no timeMin/timeMax)
      params.set("syncToken", syncToken);
    } else {
      params.set("timeMin", timeMin);
      params.set("timeMax", timeMax);
      params.set("singleEvents", "true");
      params.set("orderBy", "startTime");
    }

    params.set("maxResults", "250");

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${CALENDAR_API_BASE}?${params.toString()}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Google Calendar API error (${response.status}): ${errorBody}`);
      if (response.status === 401 || response.status === 403) {
        throw new CalendarTokenExpiredError();
      }
      throw new Error(
        `Google Calendar API error (${response.status})`,
      );
    }

    const data = (await response.json()) as {
      items?: {
        id: string;
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        attendees?: { email: string; displayName?: string; self?: boolean }[];
        status?: string;
      }[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };

    const items = data.items ?? [];

    for (const item of items) {
      // Skip cancelled events
      if (item.status === "cancelled") continue;

      const startStr = item.start?.dateTime ?? item.start?.date ?? "";
      const endStr = item.end?.dateTime ?? item.end?.date ?? "";

      allEvents.push({
        id: item.id,
        summary: item.summary ?? "(No title)",
        start: startStr,
        end: endStr,
        attendees: item.attendees ?? [],
      });
    }

    pageToken = data.nextPageToken;
    if (data.nextSyncToken) {
      nextSyncToken = data.nextSyncToken;
    }
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}

// ---------------------------------------------------------------------------
// Sync pipeline
// ---------------------------------------------------------------------------

export async function syncCalendar(
  userId: string,
  accessToken: string,
): Promise<SyncResult> {
  // 1. Get user's own emails from user_emails table
  const { data: userEmailRows } = await supabase
    .from("user_emails")
    .select("email")
    .eq("user_id", userId);

  const userEmails = new Set(
    (userEmailRows ?? []).map((r) => (r as unknown as { email: string }).email.toLowerCase()),
  );

  // Also get the user's auth email
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    userEmails.add(user.email.toLowerCase());
  }

  // 2. Get last sync time from calendar_sync_state
  const { data: syncState } = await supabase
    .from("calendar_sync_state")
    .select("*")
    .eq("user_id", userId)
    .single();

  const typedSyncState = syncState as unknown as Tables<"calendar_sync_state"> | null;

  const now = new Date();
  const timeMax = now.toISOString();

  let timeMin: string;
  let storedSyncToken: string | undefined;

  if (typedSyncState?.sync_token) {
    // Use incremental sync via syncToken
    storedSyncToken = typedSyncState.sync_token;
    timeMin = ""; // not used with syncToken
  } else if (typedSyncState?.last_sync_at) {
    // Fallback: fetch from last sync time
    timeMin = typedSyncState.last_sync_at;
  } else {
    // First sync: last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    timeMin = thirtyDaysAgo.toISOString();
  }

  // 3. Fetch events
  const { events, nextSyncToken } = await fetchCalendarEvents(
    accessToken,
    timeMin,
    timeMax,
    storedSyncToken,
  );

  // 4. Get contact emails for matching (scoped to user's contacts)
  const { data: contactEmailRows } = await supabase
    .from("contact_emails")
    .select("email, contact_id, contacts!inner(user_id)")
    .eq("contacts.user_id", userId);

  type ContactEmailRow = { email: string; contact_id: string };
  const typedContactEmails = (contactEmailRows ?? []) as unknown as ContactEmailRow[];

  const emailToContactId = new Map<string, string>();
  for (const row of typedContactEmails) {
    emailToContactId.set(row.email.toLowerCase(), row.contact_id);
  }

  // Also get existing suggestions to avoid duplicates
  const { data: existingSuggestions } = await supabase
    .from("calendar_suggestions")
    .select("email")
    .eq("user_id", userId);

  const existingSuggestionEmails = new Set(
    (existingSuggestions ?? []).map(
      (r) => (r as unknown as { email: string }).email.toLowerCase(),
    ),
  );

  // Also get existing interaction metadata to avoid duplicating calendar events.
  // Dedup key is `${event.id}:${contactId}` so the same event with multiple
  // attendees produces one interaction per attendee, but re-running sync is a no-op.
  const { data: existingInteractions } = await supabase
    .from("interactions")
    .select("metadata")
    .eq("user_id", userId)
    .eq("type", "meeting");

  const existingDedupKeys = new Set<string>();
  for (const row of (existingInteractions ?? []) as unknown as { metadata: Record<string, unknown> }[]) {
    const dedupKey = row.metadata?.dedup_key;
    if (typeof dedupKey === "string") {
      existingDedupKeys.add(dedupKey);
      continue;
    }
    // Backfill: rows written by older sync only stored calendar_event_id without contact_id.
    // Treat them as already-synced for the same (event, contact) by reconstructing the key
    // from the legacy fields when both are present.
    const calendarEventId = row.metadata?.calendar_event_id;
    const legacyContactId = row.metadata?.contact_id;
    if (typeof calendarEventId === "string" && typeof legacyContactId === "string") {
      existingDedupKeys.add(`${calendarEventId}:${legacyContactId}`);
    }
  }

  let interactionsCreated = 0;
  let suggestionsCreated = 0;
  let eventsProcessed = 0;

  // 4. Process each event with 2+ attendees
  for (const event of events) {
    if (event.attendees.length < 2) continue;
    eventsProcessed++;

    // Filter out user's own emails and self-marked attendees
    const otherAttendees = event.attendees.filter(
      (a) => !a.self && !userEmails.has(a.email.toLowerCase()),
    );

    for (const attendee of otherAttendees) {
      const contactId = emailToContactId.get(attendee.email.toLowerCase());

      if (contactId) {
        // Check if we already created an interaction for this event+contact
        const dedupKey = `${event.id}:${contactId}`;
        if (existingDedupKeys.has(dedupKey)) continue;

        // Create interaction
        const { error: interactionError } = await supabase
          .from("interactions")
          .insert({
            user_id: userId,
            contact_id: contactId,
            type: "meeting",
            title: event.summary,
            occurred_at: event.start,
            metadata: {
              calendar_event_id: event.id,
              contact_id: contactId,
              dedup_key: dedupKey,
            } as unknown as Tables<"interactions">["metadata"],
          } as never);

        // Ignore Postgres unique-violation (23505) — dedup index caught a race.
        if (!interactionError) {
          interactionsCreated++;
          existingDedupKeys.add(dedupKey);
        } else if ((interactionError as { code?: string }).code !== "23505") {
          console.error("Calendar sync interaction insert failed:", interactionError);
        }
      } else {
        // Unmatched – create suggestion (skip duplicates)
        if (existingSuggestionEmails.has(attendee.email.toLowerCase())) continue;

        const { error: suggestionError } = await supabase
          .from("calendar_suggestions")
          .insert({
            user_id: userId,
            email: attendee.email,
            display_name: attendee.displayName ?? null,
            event_title: event.summary,
            event_date: event.start,
            status: "pending",
          } as never);

        if (!suggestionError) {
          suggestionsCreated++;
          existingSuggestionEmails.add(attendee.email.toLowerCase());
        }
      }
    }
  }

  // 5. Update calendar_sync_state.last_sync_at and sync_token
  await supabase
    .from("calendar_sync_state")
    .update({
      last_sync_at: now.toISOString(),
      sync_token: nextSyncToken,
    } as never)
    .eq("user_id", userId);

  // 6. Return counts
  return { eventsProcessed, interactionsCreated, suggestionsCreated };
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

export async function connectCalendar(
  userId: string,
  providerToken: string,
  refreshToken?: string,
  expiresAt?: string | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from("calendar_sync_state")
    .select("user_id, provider_refresh_token")
    .eq("user_id", userId)
    .single();

  if (existing) {
    // Preserve refresh token across re-auth flows that don't return one
    // (Google only re-issues a refresh_token when prompt=consent is used).
    const existingRefresh = (existing as unknown as { provider_refresh_token: string | null })
      .provider_refresh_token;
    await supabase
      .from("calendar_sync_state")
      .update({
        is_connected: true,
        provider_token: providerToken,
        provider_refresh_token: refreshToken ?? existingRefresh ?? null,
        provider_token_expires_at: expiresAt ?? null,
      } as never)
      .eq("user_id", userId);
  } else {
    await supabase.from("calendar_sync_state").insert({
      user_id: userId,
      is_connected: true,
      provider_token: providerToken,
      provider_refresh_token: refreshToken ?? null,
      provider_token_expires_at: expiresAt ?? null,
    } as never);
  }
}

export async function disconnectCalendar(userId: string): Promise<void> {
  await supabase
    .from("calendar_sync_state")
    .update({
      is_connected: false,
      provider_token: null,
      provider_refresh_token: null,
      provider_token_expires_at: null,
      sync_token: null,
    } as never)
    .eq("user_id", userId);
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export async function getCalendarSuggestions(
  userId: string,
): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from("calendar_suggestions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as unknown as Suggestion[];
}

export async function dismissSuggestion(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_suggestions")
    .update({ status: "dismissed" } as never)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function restoreSuggestion(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_suggestions")
    .update({ status: "pending" } as never)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function createContactFromSuggestion(
  suggestionId: string,
  userId: string,
): Promise<string> {
  // Fetch the suggestion — filter by user_id to prevent cross-user access
  const { data: suggestion, error: fetchError } = await supabase
    .from("calendar_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !suggestion) {
    throw new Error("Suggestion not found");
  }

  const typed = suggestion as unknown as Suggestion;

  // Parse displayName into first/last name
  const nameParts = (typed.display_name ?? typed.email.split("@")[0]).split(" ");
  const firstName = nameParts[0] ?? typed.email.split("@")[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  // Create the contact
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      source: "calendar",
    } as never)
    .select("id")
    .single();

  if (contactError || !contact) {
    throw new Error(contactError?.message ?? "Failed to create contact");
  }

  const contactId = (contact as unknown as { id: string }).id;

  // Add the email to contact_emails
  await supabase.from("contact_emails").insert({
    contact_id: contactId,
    email: typed.email,
    label: "work",
    is_primary: true,
  } as never);

  // Update suggestion status
  await supabase
    .from("calendar_suggestions")
    .update({
      status: "created",
      created_contact_id: contactId,
    } as never)
    .eq("id", suggestionId);

  return contactId;
}
