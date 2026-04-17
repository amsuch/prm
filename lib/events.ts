/**
 * CRUD operations for events and event_people tables.
 */

import { supabase } from "@/lib/supabase";
import type { Tables, InsertTables, UpdateTables } from "@/types/database";

export type EventRow = Tables<"events">;
export type EventPersonRow = Tables<"event_people">;

/**
 * Create a new event.
 */
export async function createEvent(
  userId: string,
  data: Omit<InsertTables<"events">, "user_id">,
): Promise<EventRow> {
  const { data: event, error } = await supabase
    .from("events")
    .insert({ ...data, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return event as unknown as EventRow;
}

/**
 * Update an existing event.
 */
export async function updateEvent(
  id: string,
  data: UpdateTables<"events">,
): Promise<EventRow> {
  const { data: event, error } = await supabase
    .from("events")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return event as unknown as EventRow;
}

/**
 * Delete an event and its associated attendees.
 */
export async function deleteEvent(id: string): Promise<void> {
  const { error: peopleError } = await supabase
    .from("event_people")
    .delete()
    .eq("event_id", id);

  if (peopleError) throw peopleError;

  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) throw error;
}

/**
 * Add a casual attendee to an event.
 */
export async function addPersonToEvent(
  eventId: string,
  userId: string,
  data: {
    first_name: string;
    last_name?: string | null;
    role?: string | null;
    notes?: string | null;
  },
): Promise<EventPersonRow> {
  const { data: person, error } = await supabase
    .from("event_people")
    .insert({
      event_id: eventId,
      user_id: userId,
      first_name: data.first_name,
      last_name: data.last_name ?? null,
      role: data.role ?? null,
      notes: data.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return person as unknown as EventPersonRow;
}

/**
 * Remove an attendee from an event.
 */
export async function removePersonFromEvent(personId: string): Promise<void> {
  const { error } = await supabase
    .from("event_people")
    .delete()
    .eq("id", personId);

  if (error) throw error;
}

/**
 * Promote an event attendee to a full contact.
 * Creates a new contact with source='event' and source_id=event.id,
 * then updates the event_people record with promoted_contact_id.
 */
export async function promotePersonToContact(
  person: EventPersonRow,
  event: EventRow,
  userId: string,
): Promise<Tables<"contacts">> {
  if (person.promoted_contact_id) {
    throw new Error("This person has already been promoted to a contact.");
  }

  const noteParts: string[] = [];
  noteParts.push(`Met at: ${event.name}`);
  if (event.event_date) noteParts.push(`Date: ${event.event_date}`);
  if (person.notes) noteParts.push(person.notes);

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      first_name: person.first_name,
      last_name: person.last_name ?? null,
      job_title: person.role ?? null,
      notes: noteParts.join("\n"),
      source: "event",
      source_id: event.id,
    })
    .select("*")
    .single();

  if (contactError) throw contactError;

  const newContact = contact as unknown as Tables<"contacts">;

  const { error: updateError } = await supabase
    .from("event_people")
    .update({ promoted_contact_id: newContact.id })
    .eq("id", person.id);

  if (updateError) throw updateError;

  return newContact;
}
