import { Platform } from "react-native";
import * as Contacts from "expo-contacts";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

export type DeviceContact = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  emails: { label: string; email: string }[];
  phones: { label: string; number: string }[];
  imageUri: string | null;
};

export type DeviceImportProgress = {
  current: number;
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
};

export type DeviceImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
};

export function isDeviceContactsAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export async function requestContactsPermission(): Promise<boolean> {
  if (!isDeviceContactsAvailable()) return false;

  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function checkContactsPermission(): Promise<
  "granted" | "denied" | "undetermined"
> {
  if (!isDeviceContactsAvailable()) return "denied";

  try {
    const { status } = await Contacts.getPermissionsAsync();
    return status as "granted" | "denied" | "undetermined";
  } catch {
    return "denied";
  }
}

export async function loadDeviceContacts(
  pageSize: number = 50,
  pageOffset: number = 0,
): Promise<{ contacts: DeviceContact[]; hasMore: boolean; total: number }> {
  if (!isDeviceContactsAvailable()) {
    return { contacts: [], hasMore: false, total: 0 };
  }

  try {
    const result = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.FirstName,
        Contacts.Fields.LastName,
        Contacts.Fields.Company,
        Contacts.Fields.JobTitle,
        Contacts.Fields.Emails,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Image,
      ],
      pageSize,
      pageOffset,
      sort: Contacts.SortTypes.FirstName,
    });

    const contacts: DeviceContact[] = result.data
      .filter((c) => c.firstName || c.lastName)
      .map((c) => ({
        id: c.id ?? `${c.firstName}-${c.lastName}-${Date.now()}`,
        firstName: c.firstName ?? "",
        lastName: c.lastName ?? "",
        company: c.company ?? null,
        jobTitle: c.jobTitle ?? null,
        emails: (c.emails ?? []).map((e) => ({
          label: e.label ?? "other",
          email: e.email ?? "",
        })),
        phones: (c.phoneNumbers ?? []).map((p) => ({
          label: p.label ?? "other",
          number: p.number ?? "",
        })),
        imageUri: c.image?.uri ?? null,
      }));

    return {
      contacts,
      hasMore: result.hasNextPage ?? false,
      total: result.data.length + pageOffset,
    };
  } catch (err) {
    throw new Error(
      `Failed to load contacts: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}

export async function loadAllDeviceContacts(): Promise<DeviceContact[]> {
  const allContacts: DeviceContact[] = [];
  let offset = 0;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await loadDeviceContacts(pageSize, offset);
    allContacts.push(...result.contacts);
    hasMore = result.hasMore;
    offset += pageSize;
  }

  return allContacts;
}

export function mapToAppSchema(
  contact: DeviceContact,
  userId: string,
): ContactInsert {
  return {
    user_id: userId,
    first_name: contact.firstName || "Unknown",
    last_name: contact.lastName || null,
    company: contact.company,
    job_title: contact.jobTitle,
    source: "device",
    source_id: contact.id,
  };
}

const IMPORT_BATCH_SIZE = 50;

export async function importDeviceContacts(
  contacts: DeviceContact[],
  userId: string,
  onProgress?: (progress: DeviceImportProgress) => void,
): Promise<DeviceImportResult> {
  const result: DeviceImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    total: contacts.length,
  };

  // Pre-fetch existing device source IDs for dedup
  const sourceIds = contacts.map((c) => c.id);
  const existingSourceIds = new Set<string>();

  if (sourceIds.length > 0) {
    // Query in batches to avoid URL length limits
    for (let i = 0; i < sourceIds.length; i += 500) {
      const batch = sourceIds.slice(i, i + 500);
      const { data: existing } = await supabase
        .from("contacts")
        .select("source_id")
        .eq("user_id", userId)
        .eq("source", "device")
        .in("source_id", batch);

      const rows = existing as { source_id: string | null }[] | null;
      if (rows) {
        for (const e of rows) {
          if (e.source_id) existingSourceIds.add(e.source_id);
        }
      }
    }
  }

  // Also check by email for cross-source dedup
  const allEmails = contacts.flatMap((c) =>
    c.emails.map((e) => e.email).filter(Boolean),
  );
  const existingEmails = new Set<string>();

  if (allEmails.length > 0) {
    for (let i = 0; i < allEmails.length; i += 500) {
      const batch = allEmails.slice(i, i + 500);
      const { data: existing } = await supabase
        .from("contact_emails")
        .select("email")
        .in("email", batch);

      const rows = existing as { email: string }[] | null;
      if (rows) {
        for (const e of rows) {
          existingEmails.add(e.email);
        }
      }
    }
  }

  for (let i = 0; i < contacts.length; i += IMPORT_BATCH_SIZE) {
    const batch = contacts.slice(i, i + IMPORT_BATCH_SIZE);

    for (const contact of batch) {
      // Check source_id dedup
      if (existingSourceIds.has(contact.id)) {
        result.skipped++;
        continue;
      }

      // Check email dedup
      const hasExistingEmail = contact.emails.some((e) =>
        existingEmails.has(e.email),
      );
      if (hasExistingEmail) {
        result.skipped++;
        continue;
      }

      try {
        const contactData = mapToAppSchema(contact, userId);
        const { data: inserted, error } = await supabase
          .from("contacts")
          .insert(contactData as never)
          .select("id")
          .single();

        if (error) {
          result.errors.push(
            `Failed to import ${contact.firstName} ${contact.lastName}: ${error.message}`,
          );
          continue;
        }

        const record = inserted as { id: string } | null;
        if (record) {
          // Insert emails
          for (const email of contact.emails) {
            if (email.email) {
              await supabase.from("contact_emails").insert({
                contact_id: record.id,
                email: email.email,
                label: email.label || "other",
                is_primary: email === contact.emails[0],
              } as never);
            }
          }

          // Insert phones
          for (const phone of contact.phones) {
            if (phone.number) {
              await supabase.from("contact_phones").insert({
                contact_id: record.id,
                phone: phone.number,
                label: phone.label || "other",
                is_primary: phone === contact.phones[0],
              } as never);
            }
          }

          result.imported++;
        }
      } catch (err) {
        result.errors.push(
          `Unexpected error importing ${contact.firstName}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    onProgress?.({
      current: Math.min(i + IMPORT_BATCH_SIZE, contacts.length),
      total: contacts.length,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  }

  return result;
}
