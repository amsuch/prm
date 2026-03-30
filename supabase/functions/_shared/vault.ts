import { createClient } from "npm:@supabase/supabase-js@2";

// Module-level cache: userId -> { secretName -> { value, fetchedAt } }
const secretCache = new Map<string, Map<string, { value: string | null; fetchedAt: number }>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!,
  );
}

/**
 * Read a decrypted secret for a user. Cached for 5 minutes in-memory
 * (survives across warm invocations on Deno Deploy).
 */
export async function readSecret(userId: string, secretName: string): Promise<string | null> {
  const userCache = secretCache.get(userId);
  if (userCache) {
    const cached = userCache.get(secretName);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const client = getServiceClient();
  const { data, error } = await client.rpc("read_user_secret", {
    p_user_id: userId,
    p_secret_name: secretName,
  });

  if (error) {
    throw new Error(`Failed to read secret: ${error.message}`);
  }

  const value = (data as string) ?? null;

  if (!secretCache.has(userId)) {
    secretCache.set(userId, new Map());
  }
  secretCache.get(userId)!.set(secretName, { value, fetchedAt: Date.now() });

  return value;
}

/**
 * Write a secret for a user. Invalidates the cache entry.
 */
export async function upsertSecret(userId: string, secretName: string, secretValue: string): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.rpc("upsert_user_secret", {
    p_user_id: userId,
    p_secret_name: secretName,
    p_secret_value: secretValue,
  });

  if (error) {
    throw new Error(`Failed to upsert secret: ${error.message}`);
  }

  secretCache.get(userId)?.delete(secretName);
}

/**
 * Delete a secret for a user. Invalidates the cache entry.
 */
export async function deleteSecret(userId: string, secretName: string): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.rpc("delete_user_secret", {
    p_user_id: userId,
    p_secret_name: secretName,
  });

  if (error) {
    throw new Error(`Failed to delete secret: ${error.message}`);
  }

  secretCache.get(userId)?.delete(secretName);
}
