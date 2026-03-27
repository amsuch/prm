import { supabase } from "@/lib/supabase";
import type { Tables, InsertTables } from "@/types/database";

export type Interaction = Tables<"interactions">;

export type InteractionType =
  | "call"
  | "email"
  | "meeting"
  | "text"
  | "social"
  | "note"
  | "gift"
  | "other";

export type InteractionDirection = "inbound" | "outbound" | "none";

export const INTERACTION_TYPES: {
  value: InteractionType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { value: "call", label: "Call", icon: "call-outline", color: "#10b981" },
  { value: "email", label: "Email", icon: "mail-outline", color: "#3b82f6" },
  { value: "meeting", label: "Meeting", icon: "people-outline", color: "#8b5cf6" },
  { value: "text", label: "Text", icon: "chatbubble-outline", color: "#06b6d4" },
  { value: "social", label: "Social", icon: "globe-outline", color: "#f59e0b" },
  { value: "note", label: "Note", icon: "document-text-outline", color: "#6b7280" },
  { value: "gift", label: "Gift", icon: "gift-outline", color: "#ec4899" },
  { value: "other", label: "Other", icon: "ellipsis-horizontal-outline", color: "#9ca3af" },
];

export const INTERACTION_DIRECTIONS: {
  value: InteractionDirection;
  label: string;
}[] = [
  { value: "outbound", label: "Outbound" },
  { value: "inbound", label: "Inbound" },
  { value: "none", label: "N/A" },
];

/**
 * Get the icon config for an interaction type.
 */
export function getInteractionTypeConfig(type: string) {
  return (
    INTERACTION_TYPES.find((t) => t.value === type) ??
    INTERACTION_TYPES[INTERACTION_TYPES.length - 1]
  );
}

/**
 * Log a new interaction for a contact.
 */
export async function logInteraction(params: {
  userId: string;
  contactId: string;
  type: InteractionType;
  direction: InteractionDirection;
  title?: string;
  body?: string;
  occurredAt?: string;
}): Promise<Interaction> {
  const insertData: InsertTables<"interactions"> = {
    user_id: params.userId,
    contact_id: params.contactId,
    type: params.type,
    direction: params.direction === "none" ? null : params.direction,
    title: params.title?.trim() || null,
    body: params.body?.trim() || null,
    occurred_at: params.occurredAt ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("interactions")
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  // Update the contact's last_contacted_at
  await supabase
    .from("contacts")
    .update({ last_contacted_at: insertData.occurred_at })
    .eq("id", params.contactId)
    .lt("last_contacted_at", insertData.occurred_at!)
    .single();

  return data;
}

/**
 * Get interactions for a specific contact, ordered by most recent first.
 */
export async function getInteractions(
  contactId: string,
  limit: number = 50,
): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Get recent interactions across all contacts for the dashboard.
 */
export async function getRecentInteractions(
  userId: string,
  limit: number = 20,
): Promise<(Interaction & { contact_first_name: string; contact_last_name: string | null })[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(
      `
      *,
      contacts!inner (first_name, last_name)
    `,
    )
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Flatten the contact data into the interaction object
  return (data ?? []).map((row) => {
    const contacts = row.contacts as unknown as {
      first_name: string;
      last_name: string | null;
    };
    return {
      ...row,
      contact_first_name: contacts.first_name,
      contact_last_name: contacts.last_name,
      contacts: undefined,
    };
  }) as (Interaction & { contact_first_name: string; contact_last_name: string | null })[];
}

/**
 * Update an existing interaction.
 */
export async function updateInteraction(
  interactionId: string,
  params: {
    type?: InteractionType;
    direction?: InteractionDirection;
    title?: string;
    body?: string;
    occurredAt?: string;
  },
): Promise<Interaction> {
  const updateData: Record<string, unknown> = {};
  if (params.type !== undefined) updateData.type = params.type;
  if (params.direction !== undefined)
    updateData.direction = params.direction === "none" ? null : params.direction;
  if (params.title !== undefined) updateData.title = params.title.trim() || null;
  if (params.body !== undefined) updateData.body = params.body.trim() || null;
  if (params.occurredAt !== undefined) updateData.occurred_at = params.occurredAt;

  const { data, error } = await supabase
    .from("interactions")
    .update(updateData)
    .eq("id", interactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an interaction.
 */
export async function deleteInteraction(interactionId: string): Promise<void> {
  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);

  if (error) throw error;
}
