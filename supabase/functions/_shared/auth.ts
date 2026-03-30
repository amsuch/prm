import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Validate the JWT from the Authorization header and return the user ID.
 * Throws if the token is invalid or missing.
 */
export async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid JWT");
  }

  return data.user.id;
}
