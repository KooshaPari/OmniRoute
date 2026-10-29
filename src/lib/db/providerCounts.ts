/**
 * db/providerCounts.ts — provider_connections count query.
 *
 * Extracted from db/providers.ts to break the models → providers →
 * providers/deletion → models import cycle. models.ts needs the connection
 * count for post-delete cleanup without pulling in the whole providers
 * module (which imports providers/deletion, which imports models).
 */

import { getDbInstance } from "./core";

interface StatementLike<TRow = unknown> {
  all: (...params: unknown[]) => TRow[];
  get: (...params: unknown[]) => TRow | undefined;
  run: (...params: unknown[]) => { changes?: number };
}

interface DbLike {
  prepare: <TRow = unknown>(sql: string) => StatementLike<TRow>;
  transaction: <T>(fn: () => T) => () => T;
}

type JsonRecord = Record<string, unknown>;

export function getProviderConnectionsCount(filter: JsonRecord = {}): number {
  const db = getDbInstance() as unknown as DbLike;
  let sql = "SELECT count(*) as cnt FROM provider_connections";
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.provider) {
    conditions.push("provider = @provider");
    params.provider = filter.provider;
  }
  if (filter.isActive !== undefined) {
    conditions.push("is_active = @isActive");
    params.isActive = filter.isActive ? 1 : 0;
  }
  if (filter.authType) {
    conditions.push("auth_type = @authType");
    params.authType = filter.authType;
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  const row = db.prepare(sql).get(params) as { cnt: number };
  return row.cnt;
}
