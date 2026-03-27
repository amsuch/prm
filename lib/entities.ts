/**
 * CRUD operations for entities and entity_people tables.
 */

import { supabase } from "@/lib/supabase";
import type { Tables, InsertTables, UpdateTables } from "@/types/database";

export type EntityRow = Tables<"entities">;
export type EntityPersonRow = Tables<"entity_people">;

/**
 * Create a new entity (place/organization).
 */
export async function createEntity(
  userId: string,
  data: Omit<InsertTables<"entities">, "user_id">,
): Promise<EntityRow> {
  const { data: entity, error } = await supabase
    .from("entities")
    .insert({ ...data, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return entity as unknown as EntityRow;
}

/**
 * Update an existing entity.
 */
export async function updateEntity(
  id: string,
  data: UpdateTables<"entities">,
): Promise<EntityRow> {
  const { data: entity, error } = await supabase
    .from("entities")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return entity as unknown as EntityRow;
}

/**
 * Delete an entity and its associated people.
 */
export async function deleteEntity(id: string): Promise<void> {
  // entity_people should cascade, but delete explicitly for safety
  const { error: peopleError } = await supabase
    .from("entity_people")
    .delete()
    .eq("entity_id", id);

  if (peopleError) throw peopleError;

  const { error } = await supabase
    .from("entities")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Add a casual person to an entity.
 */
export async function addPersonToEntity(
  entityId: string,
  userId: string,
  data: { first_name: string; last_name?: string | null; role?: string | null; notes?: string | null },
): Promise<EntityPersonRow> {
  const { data: person, error } = await supabase
    .from("entity_people")
    .insert({
      entity_id: entityId,
      user_id: userId,
      first_name: data.first_name,
      last_name: data.last_name ?? null,
      role: data.role ?? null,
      notes: data.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return person as unknown as EntityPersonRow;
}

/**
 * Remove a person from an entity.
 */
export async function removePersonFromEntity(personId: string): Promise<void> {
  const { error } = await supabase
    .from("entity_people")
    .delete()
    .eq("id", personId);

  if (error) throw error;
}

/**
 * Promote a casual person to a full contact.
 * Creates a new contact with first_name, last_name, job_title=role,
 * source='entity', source_id=entity.id. Then updates the entity_people
 * record with the new contact's promoted_contact_id.
 */
export async function promotePersonToContact(
  person: EntityPersonRow,
  entity: EntityRow,
  userId: string,
): Promise<Tables<"contacts">> {
  // Guard against double promotion
  if (person.promoted_contact_id) {
    throw new Error("This person has already been promoted to a contact.");
  }

  // Create the contact
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      first_name: person.first_name,
      last_name: person.last_name ?? null,
      job_title: person.role ?? null,
      company: entity.name,
      source: "entity",
      source_id: entity.id,
    })
    .select("*")
    .single();

  if (contactError) throw contactError;

  const newContact = contact as unknown as Tables<"contacts">;

  // Link back to entity_people
  const { error: updateError } = await supabase
    .from("entity_people")
    .update({ promoted_contact_id: newContact.id })
    .eq("id", person.id);

  if (updateError) throw updateError;

  return newContact;
}
