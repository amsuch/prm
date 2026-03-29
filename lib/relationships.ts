import { supabase } from "@/lib/supabase";
import { sanitizePostgrestValue } from "@/lib/sanitize";
import type { Tables, InsertTables } from "@/types/database";

export type RelationshipType = Tables<"relationship_types">;

export type ContactRelationship = {
  relationship_id: string;
  related_contact_id: string;
  related_first_name: string;
  related_last_name: string | null;
  related_company: string | null;
  related_avatar_url: string | null;
  relationship_name: string;
  relationship_category: string;
  notes: string | null;
};

/**
 * Fetch all relationship types available to a user.
 * Includes system-wide types (is_system=true) and user-created types.
 */
export async function getRelationshipTypes(userId: string): Promise<RelationshipType[]> {
  const { data, error } = await supabase
    .from("relationship_types")
    .select("*")
    .or(`is_system.eq.true,user_id.eq.${userId}`)
    .order("category")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch relationships for a specific contact using the RPC function.
 * The RPC handles checking both contact_a_id and contact_b_id,
 * and resolves correct labels for symmetric/asymmetric relationships.
 */
export async function getRelationships(contactId: string): Promise<ContactRelationship[]> {
  const { data, error } = await supabase.rpc("get_contact_relationships", {
    p_contact_id: contactId,
  });

  if (error) throw error;
  return (data ?? []) as ContactRelationship[];
}

/**
 * Add a new relationship between two contacts.
 */
export async function addRelationship(params: {
  contactAId: string;
  contactBId: string;
  relationshipTypeId: string;
  notes?: string;
}): Promise<Tables<"contact_relationships">> {
  const insertData: InsertTables<"contact_relationships"> = {
    contact_a_id: params.contactAId,
    contact_b_id: params.contactBId,
    relationship_type_id: params.relationshipTypeId,
    notes: params.notes ?? null,
  };

  const { data, error } = await supabase
    .from("contact_relationships")
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a relationship by its ID.
 */
export async function removeRelationship(relationshipId: string): Promise<void> {
  const { error } = await supabase
    .from("contact_relationships")
    .delete()
    .eq("id", relationshipId);

  if (error) throw error;
}

/**
 * Search contacts by name for the relationship picker.
 * Excludes the current contact and already-related contacts.
 */
export async function searchContactsForRelationship(params: {
  query: string;
  userId: string;
  excludeContactId: string;
  existingRelatedIds: string[];
}): Promise<
  {
    id: string;
    first_name: string;
    last_name: string | null;
    company: string | null;
    avatar_url: string | null;
  }[]
> {
  const { query, userId, excludeContactId, existingRelatedIds } = params;

  const excludeIds = [excludeContactId, ...existingRelatedIds];

  let dbQuery = supabase
    .from("contacts")
    .select("id, first_name, last_name, company, avatar_url")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .not("id", "in", `(${excludeIds.join(",")})`)
    .limit(20);

  if (query.trim()) {
    const q = sanitizePostgrestValue(query);
    dbQuery = dbQuery.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`,
    );
  }

  dbQuery = dbQuery.order("first_name");

  const { data, error } = await dbQuery;

  if (error) throw error;
  return data ?? [];
}
