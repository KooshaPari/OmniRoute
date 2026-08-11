/**
 * db/caseMapping.ts — pure snake_case ↔ camelCase column mapping.
 *
 * Extracted from db/core.ts (god-file decomposition): the column-name conversion
 * helpers that translate raw SQLite rows (snake_case columns, 0/1 booleans, `_json`
 * TEXT columns) into the camelCase shapes the domain modules consume. Pure — no DB
 * handle, no module state — so they live as a co-located leaf that every db/ module
 * (and core.ts itself) imports. core.ts re-exports all five so existing call sites that
 * pull these helpers off the core module keep working unchanged.
 */

type JsonRecord = Record<string, unknown>;

const BOOLEAN_CAMEL_COLUMNS = new Set([
  "isActive",
  "rateLimitProtection",
  "proxyEnabled",
  "perKeyProxyEnabled",
  "quotaVisible",
]);

export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
}

export function objToSnake(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const result: JsonRecord = {};
  for (const [k, v] of Object.entries(obj as JsonRecord)) {
    result[toSnakeCase(k)] = v;
  }
  return result;
}

export function rowToCamel(row: unknown): JsonRecord | null {
  if (!row) return null;
  const result: JsonRecord = {};
  for (const [k, v] of Object.entries(row as JsonRecord)) {
    const camelKey = toCamelCase(k);
    if (BOOLEAN_CAMEL_COLUMNS.has(camelKey)) {
      result[camelKey] = v === 1 || v === true;
    } else if (camelKey === "providerSpecificData" && typeof v === "string") {
      try {
        result[camelKey] = JSON.parse(v);
      } catch {
        result[camelKey] = v;
      }
    } else if (camelKey.endsWith("Json")) {
      // Convention: any column with a `_json` suffix is JSON-encoded TEXT.
      // Surface the parsed object under the friendlier name (key minus the
      // "Json" suffix) — e.g. quotaWindowThresholdsJson → quotaWindowThresholds.
      // A NULL/absent column normalizes to `baseKey: null` (not the suffixed
      // key) so read and write paths expose a consistent shape.
      const baseKey = camelKey.slice(0, -"Json".length);
      if (typeof v === "string") {
        try {
          result[baseKey] = JSON.parse(v);
        } catch {
          result[baseKey] = null;
        }
      } else {
        result[baseKey] = v == null ? null : v;
      }
    } else {
      result[camelKey] = v;
    }
  }
  return result;
}

export function cleanNulls(obj: unknown): JsonRecord {
  const result: JsonRecord = {};
  for (const [k, v] of Object.entries((obj as JsonRecord) || {})) {
    if (v !== null && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Validates that a row (post-`rowToCamel`) contains all expected fields.
 * Throws if any required field is missing — this catches schema drift at
 * runtime BEFORE the row is silently consumed by downstream code (which is
 * what `as unknown as SomeDomainType` casts used to hide).
 *
 * Replaces the `rowToCamel(row) as unknown as DomainType` pattern. Usage:
 *
 *   const row = toRecord<FileRecord>(
 *     rowToCamel(rawRow),
 *     ["id", "filename", "bytes", "createdAt", "purpose"]
 *   );
 *   if (!row) return null; // row was null
 *   // row is now FileRecord-shaped; missing required fields would have thrown
 *
 * The caller passes the required field names as the second argument (a
 * `readonly (keyof T)[]`). At runtime, we check that each named field is
 * present in the row. We intentionally do NOT validate the value TYPE
 * (e.g., `typeof row.id === "string"`) — schema-drift here is usually a
 * missing field, not a wrong-type field. For type validation, use Zod.
 *
 * Performance: O(n) over required fields. Each check is a single property
 * lookup. No allocations beyond the return value.
 */
export function toRecord<T extends Record<string, unknown>>(
  row: JsonRecord | null | undefined,
  requiredFields: ReadonlyArray<keyof T>,
): T | null {
  if (row === null || row === undefined) return null;

  for (const field of requiredFields) {
    const name = String(field);
    if (!(name in row)) {
      const preview = JSON.stringify(row).slice(0, 200);
      throw new Error(
        `db.caseMapping.toRecord: missing required field '${name}' — possible schema drift. Row preview: ${preview}`,
      );
    }
  }

  return row as T;
}
