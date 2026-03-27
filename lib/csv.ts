import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

export type ParsedCSV = {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

export type ColumnMapping = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  connected_on: string | null;
  linkedin_url: string | null;
  phone: string | null;
  notes: string | null;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
};

export type ImportProgress = {
  current: number;
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
};

const LINKEDIN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  first_name: ["first name", "firstname", "first_name", "given name"],
  last_name: ["last name", "lastname", "last_name", "surname", "family name"],
  email: [
    "email address",
    "email",
    "e-mail",
    "email_address",
    "emailaddress",
  ],
  company: ["company", "organization", "organisation", "employer"],
  job_title: ["position", "job title", "title", "job_title", "role"],
  connected_on: [
    "connected on",
    "connected_on",
    "connection date",
    "date connected",
  ],
  linkedin_url: ["url", "profile url", "linkedin url", "linkedin_url", "link"],
  phone: ["phone", "phone number", "telephone", "mobile", "cell"],
  notes: ["notes", "note", "comments", "comment"],
};

export function parseCSV(csvText: string): ParsedCSV {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    const critical = result.errors.filter(
      (e) => e.type === "Delimiter" || e.type === "FieldMismatch",
    );
    if (critical.length > 0) {
      throw new Error(
        `CSV parsing failed: ${critical.map((e) => e.message).join(", ")}`,
      );
    }
  }

  const headers = result.meta.fields ?? [];
  const rows = result.data;

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    first_name: null,
    last_name: null,
    email: null,
    company: null,
    job_title: null,
    connected_on: null,
    linkedin_url: null,
    phone: null,
    notes: null,
  };

  for (const [field, aliases] of Object.entries(LINKEDIN_ALIASES)) {
    for (const header of headers) {
      const normalized = header.toLowerCase().trim();
      if (aliases.includes(normalized)) {
        mapping[field as keyof ColumnMapping] = header;
        break;
      }
    }
  }

  return mapping;
}

const BATCH_SIZE = 100;

export async function importContacts(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  userId: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    total: rows.length,
  };

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const contactInserts: ContactInsert[] = [];
    const emailInserts: { email: string; contactIndex: number }[] = [];
    const urlInserts: { url: string; contactIndex: number }[] = [];

    for (const row of batch) {
      const firstName = mapping.first_name
        ? row[mapping.first_name]?.trim()
        : "";
      const lastName = mapping.last_name
        ? row[mapping.last_name]?.trim()
        : null;

      if (!firstName) {
        result.skipped++;
        continue;
      }

      const email = mapping.email ? row[mapping.email]?.trim() : null;
      const company = mapping.company ? row[mapping.company]?.trim() : null;
      const jobTitle = mapping.job_title
        ? row[mapping.job_title]?.trim()
        : null;
      const linkedinUrl = mapping.linkedin_url
        ? row[mapping.linkedin_url]?.trim()
        : null;
      const connectedOn = mapping.connected_on
        ? parseDate(row[mapping.connected_on]?.trim())
        : null;
      const notes = mapping.notes ? row[mapping.notes]?.trim() : null;

      const sourceId = linkedinUrl || null;

      contactInserts.push({
        user_id: userId,
        first_name: firstName,
        last_name: lastName || null,
        company: company || null,
        job_title: jobTitle || null,
        source: "linkedin",
        source_id: sourceId,
        notes: notes || null,
        custom_fields: connectedOn
          ? { linkedin_connected_on: connectedOn }
          : {},
      });

      const idx = contactInserts.length - 1;
      if (email) {
        emailInserts.push({ email, contactIndex: idx });
      }
      if (linkedinUrl) {
        urlInserts.push({ url: linkedinUrl, contactIndex: idx });
      }
    }

    if (contactInserts.length === 0) {
      onProgress?.({
        current: Math.min(i + BATCH_SIZE, rows.length),
        total: rows.length,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      });
      continue;
    }

    // Check for existing contacts with same source+source_id
    const sourceIds = contactInserts
      .map((c) => c.source_id)
      .filter((id): id is string => id !== null && id !== undefined);

    let existingSourceIds = new Set<string>();
    if (sourceIds.length > 0) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("source_id")
        .eq("user_id", userId)
        .eq("source", "linkedin")
        .in("source_id", sourceIds);

      const rows = existing as { source_id: string | null }[] | null;
      existingSourceIds = new Set(
        (rows ?? []).map((e) => e.source_id).filter(Boolean) as string[],
      );
    }

    // Filter out duplicates and insert new contacts
    for (let j = 0; j < contactInserts.length; j++) {
      const contact = contactInserts[j];
      if (contact.source_id && existingSourceIds.has(contact.source_id)) {
        result.skipped++;
        continue;
      }

      try {
        const { data: inserted, error } = await supabase
          .from("contacts")
          .insert(contact as never)
          .select("id")
          .single();

        if (error) {
          result.errors.push(
            `Failed to import ${contact.first_name} ${contact.last_name ?? ""}: ${error.message}`,
          );
          continue;
        }

        const record = inserted as { id: string } | null;
        if (record) {
          // Insert associated email
          const relatedEmails = emailInserts.filter(
            (e) => e.contactIndex === j,
          );
          for (const em of relatedEmails) {
            await supabase.from("contact_emails").insert({
              contact_id: record.id,
              email: em.email,
              label: "work",
              is_primary: true,
            } as never);
          }

          // Insert associated URL
          const relatedUrls = urlInserts.filter((u) => u.contactIndex === j);
          for (const ur of relatedUrls) {
            await supabase.from("contact_urls").insert({
              contact_id: record.id,
              url: ur.url,
              label: "linkedin",
            } as never);
          }

          result.imported++;
        }
      } catch (err) {
        result.errors.push(
          `Unexpected error importing ${contact.first_name}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    onProgress?.({
      current: Math.min(i + BATCH_SIZE, rows.length),
      total: rows.length,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  }

  return result;
}

function parseDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  try {
    // LinkedIn uses formats like "27 Mar 2026" or "2026-03-27"
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

export async function readFileWeb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        resolve(text);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
