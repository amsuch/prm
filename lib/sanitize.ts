/**
 * Security sanitization utilities for user inputs.
 *
 * - validateSQL: blocks DML/DDL in LLM-generated SQL
 * - sanitizeForLLM: strips prompt injection patterns from user input
 * - sanitizePostgrestValue: escapes special chars for Supabase .or()/.ilike() filters
 */

// ---------------------------------------------------------------------------
// SQL Validation
// ---------------------------------------------------------------------------

const SQL_BLOCKLIST = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY|DO|CALL|SET|RESET|DISCARD|LOCK|UNLISTEN|NOTIFY|LISTEN|LOAD|REINDEX|REFRESH|COMMENT|EXPLAIN|VACUUM|PREPARE|DEALLOCATE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RAISE|IMPORT)\b/i;

/**
 * Validate that a SQL string is a safe read-only query.
 * Throws if the query contains DML/DDL keywords or stacked statements.
 */
export function validateSQL(sql: string): void {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  // Must start with SELECT or WITH
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Only SELECT queries are allowed.");
  }

  // Block stacked queries (semicolons not inside string literals)
  // Strip string literals (handles PostgreSQL escaped quotes: 'it''s ok')
  const withoutStrings = trimmed.replace(/'([^']|'')*'/g, "''");
  if (withoutStrings.includes(";")) {
    throw new Error("Multiple statements are not allowed.");
  }

  // Block DML/DDL keywords anywhere in the query
  if (SQL_BLOCKLIST.test(withoutStrings)) {
    throw new Error("Only SELECT queries are allowed. DML/DDL statements are prohibited.");
  }

  // Block common subquery attacks: (DELETE ...), (UPDATE ...), (INSERT ...)
  const dangerousSubquery = /\(\s*(DELETE|UPDATE|INSERT|DROP|ALTER|CREATE|TRUNCATE)\b/i;
  if (dangerousSubquery.test(withoutStrings)) {
    throw new Error("Subqueries containing write operations are not allowed.");
  }
}

// ---------------------------------------------------------------------------
// LLM Input Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize user input before passing to an LLM prompt.
 * Strips common prompt injection patterns while preserving the user's intent.
 */
export function sanitizeForLLM(input: string): string {
  let sanitized = input;

  // Strip sequences that attempt to override system instructions
  sanitized = sanitized.replace(
    /\b(ignore|forget|disregard)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)\b/gi,
    "[filtered]",
  );

  // Strip "you are now" / "act as" / "pretend" role-override attempts
  sanitized = sanitized.replace(
    /\b(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|you\s+are)|from\s+now\s+on\s+you)\b/gi,
    "[filtered]",
  );

  // Strip attempts to inject system/assistant messages
  sanitized = sanitized.replace(
    /\b(system|assistant)\s*:/gi,
    "$1 -",
  );

  // Limit total length to prevent token-stuffing
  if (sanitized.length > 2000) {
    sanitized = sanitized.slice(0, 2000);
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// PostgREST Filter Sanitization
// ---------------------------------------------------------------------------

/**
 * Escape special PostgREST filter characters in user-provided values.
 * Prevents filter injection when interpolating into .or() or .ilike() strings.
 *
 * PostgREST uses commas to separate filter conditions and dots for operators.
 * Parentheses delimit groups. These must be escaped in user values.
 */
export function sanitizePostgrestValue(value: string): string {
  // Remove characters that have special meaning in PostgREST filter syntax
  return value
    .replace(/[,.()"\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
