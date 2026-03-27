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
      throw new Error(
        `Google Calendar API error (${response.status}): ${errorBody}`,
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

  // 4. Get all contact emails for matching
  const { data: contactEmailRows } = await supabase
    .from("contact_emails")
    .select("email, contact_id");

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

  // Also get existing interaction metadata to avoid duplicating calendar events
  const { data: existingInteractions } = await supabase
    .from("interactions")
    .select("metadata")
    .eq("user_id", userId)
    .eq("type", "meeting");

  const existingEventIds = new Set<string>();
  for (const row of (existingInteractions ?? []) as unknown as { metadata: Record<string, unknown> }[]) {
    const calendarEventId = row.metadata?.calendar_event_id;
    if (typeof calendarEventId === "string") {
      existingEventIds.add(calendarEventId);
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
        const eventContactKey = `${event.id}:${contactId}`;
        if (existingEventIds.has(eventContactKey)) continue;

        // Create interaction
        const { error: interactionError } = await supabase
          .from("interactions")
          .insert({
            user_id: userId,
            contact_id: contactId,
            type: "meeting",
            title: event.summary,
            occurred_at: event.start,
            metadata: { calendar_event_id: event.id } as unknown as Tables<"interactions">["metadata"],
          } as never);

        if (!interactionError) {
          interactionsCreated++;
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
): Promise<void> {
  const { data: existing } = await supabase
    .from("calendar_sync_state")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await supabase
      .from("calendar_sync_state")
      .update({
        is_connected: true,
        provider_token: providerToken,
        provider_refresh_token: refreshToken ?? null,
      } as never)
      .eq("user_id", userId);
  } else {
    await supabase.from("calendar_sync_state").insert({
      user_id: userId,
      is_connected: true,
      provider_token: providerToken,
      provider_refresh_token: refreshToken ?? null,
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

export async function dismissSuggestion(id: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_suggestions")
    .update({ status: "dismissed" } as never)
    .eq("id", id);

  if (error) throw error;
}

export async function restoreSuggestion(id: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_suggestions")
    .update({ status: "pending" } as never)
    .eq("id", id);

  if (error) throw error;
}

export async function createContactFromSuggestion(
  suggestionId: string,
  userId: string,
): Promise<string> {
  // Fetch the suggestion
  const { data: suggestion, error: fetchError } = await supabase
    .from("calendar_suggestions")
    .select("*")
    .eq("id", suggestionId)
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
