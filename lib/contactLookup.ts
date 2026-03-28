import { supabase } from "@/lib/supabase";

export type ContactResult = {
  id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  avatar_url: string | null;
};

export async function findContactsByName(
  name: string,
  userId: string,
  limit = 5,
): Promise<ContactResult[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, job_title, avatar_url")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
    .limit(limit);

  if (error) throw error;
  return (data as unknown as ContactResult[]) ?? [];
}

export function formatContactName(
  firstName: string,
  lastName?: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(" ");
}
