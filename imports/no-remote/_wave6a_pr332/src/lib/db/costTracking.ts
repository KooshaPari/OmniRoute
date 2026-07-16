/**
 * db/costTracking.ts — Cost-event ledger (B5 of v8.1 Bifrost track, ADR-031 § 4)
 *
 * Append-only ledger of billable events emitted by the request pipeline.
 * Every successful `recordVirtualKeyUsage` in `db/virtualKeys.ts` writes
 * one row here, with the same provider / model / token / cost fields.
 *
 * Public surface:
 *   - `recordCostEvent(input)`        — append one event, return the row
 *   - `listCostEventsForTenant(t, s)` — newest-first within a time window
 *   - `listCostEventsForKey(k, s)`    — same, scoped to a single key
 *   - `summarizeCostForTenant(t, s)`  — totals + byProvider + byModel + byDay
 *   - `summarizeCostForKey(k, s)`     — same, isolated to one key
 *
 * Time semantics: `since` is the lower bound (inclusive) on `occurred_at`.
 * ISO 8601. The summary methods return `sinceIso` + `untilIso` in the
 * payload so the dashboard can render a window-relative caption without
 * round-tripping.
 *
 * The rollups are computed in JS from the raw rows; SQLite has no
 * GROUP BY for ISO date-trunc and we want to keep the response shape
 * stable across drivers (better-sqlite3 / sql.js).
 */

import { v4 as uuidv4 } from "uuid";
import { getDbInstance } from "./core";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecordCostEventInput {
  virtualKeyId: string;
  tenantId: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd: number;
  /** ISO 8601. Defaults to now. */
  occurredAt?: string;
}

export interface CostEvent {
  id: string;
  virtualKeyId: string;
  tenantId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  occurredAt: string;
}

export interface CostBucket {
  key: string;
  costUsd: number;
  eventCount: number;
}

export interface CostDayBucket {
  day: string; // YYYY-MM-DD
  costUsd: number;
  eventCount: number;
}

export interface CostSummary {
  sinceIso: string;
  untilIso: string;
  eventCount: number;
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  byProvider: CostBucket[];
  byModel: CostBucket[];
  byDay: CostDayBucket[];
}

interface CostEventRow {
  id: string;
  virtual_key_id: string;
  tenant_id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  occurred_at: string;
}

function rowToCostEvent(row: CostEventRow): CostEvent {
  return {
    id: row.id,
    virtualKeyId: row.virtual_key_id,
    tenantId: row.tenant_id,
    provider: row.provider,
    model: row.model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    costUsd: row.cost_usd,
    occurredAt: row.occurred_at,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureValidSince(since: string | undefined): string {
  if (typeof since === "string" && since.length > 0) {
    const ms = Date.parse(since);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  // Default to 30 days back — matches the dashboard's default window.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString();
}

function isoDay(occurredAt: string): string {
  // SQLite stores `datetime('now')` as `YYYY-MM-DD HH:MM:SS` in UTC.
  // We accept either that form or a full ISO 8601 string and reduce
  // to the YYYY-MM-DD prefix.
  if (occurredAt.length >= 10 && occurredAt[10] === "T") {
    return occurredAt.slice(0, 10);
  }
  return occurredAt.slice(0, 10);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function recordCostEvent(input: RecordCostEventInput): CostEvent {
  if (typeof input.virtualKeyId !== "string" || input.virtualKeyId.length === 0) {
    throw new Error("recordCostEvent: virtualKeyId is required");
  }
  if (typeof input.tenantId !== "string" || input.tenantId.length === 0) {
    throw new Error("recordCostEvent: tenantId is required");
  }
  if (typeof input.provider !== "string" || input.provider.length === 0) {
    throw new Error("recordCostEvent: provider is required");
  }
  if (typeof input.model !== "string" || input.model.length === 0) {
    throw new Error("recordCostEvent: model is required");
  }
  if (typeof input.costUsd !== "number" || !Number.isFinite(input.costUsd) || input.costUsd < 0) {
    throw new Error("recordCostEvent: costUsd must be a non-negative finite number");
  }

  const db = getDbInstance();
  const id = uuidv4();
  const occurredAt = input.occurredAt ?? nowIso();
  const promptTokens = Number.isInteger(input.promptTokens) ? (input.promptTokens as number) : 0;
  const completionTokens = Number.isInteger(input.completionTokens) ? (input.completionTokens as number) : 0;

  db.prepare(
    `INSERT INTO cost_events
      (id, virtual_key_id, tenant_id, provider, model,
       prompt_tokens, completion_tokens, cost_usd, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.virtualKeyId,
    input.tenantId,
    input.provider,
    input.model,
    promptTokens,
    completionTokens,
    input.costUsd,
    occurredAt
  );

  const row = db
    .prepare(`SELECT * FROM cost_events WHERE id = ?`)
    .get(id) as CostEventRow;
  return rowToCostEvent(row);
}

export function listCostEventsForTenant(
  tenantId: string,
  sinceIso?: string
): CostEvent[] {
  const db = getDbInstance();
  const since = ensureValidSince(sinceIso);
  const rows = db
    .prepare(
      `SELECT * FROM cost_events
        WHERE tenant_id = ? AND occurred_at >= ?
        ORDER BY occurred_at DESC, id DESC`
    )
    .all(tenantId, since) as CostEventRow[];
  return rows.map(rowToCostEvent);
}

export function listCostEventsForKey(
  keyId: string,
  sinceIso?: string
): CostEvent[] {
  const db = getDbInstance();
  const since = ensureValidSince(sinceIso);
  const rows = db
    .prepare(
      `SELECT * FROM cost_events
        WHERE virtual_key_id = ? AND occurred_at >= ?
        ORDER BY occurred_at DESC, id DESC`
    )
    .all(keyId, since) as CostEventRow[];
  return rows.map(rowToCostEvent);
}

export function summarizeCostForTenant(
  tenantId: string,
  sinceIso?: string
): CostSummary {
  const since = ensureValidSince(sinceIso);
  const until = nowIso();
  const events = listCostEventsForTenant(tenantId, since);
  return summariseEvents(events, since, until);
}

export function summarizeCostForKey(
  keyId: string,
  sinceIso?: string
): CostSummary {
  const since = ensureValidSince(sinceIso);
  const until = nowIso();
  const events = listCostEventsForKey(keyId, since);
  return summariseEvents(events, since, until);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function summariseEvents(
  events: CostEvent[],
  sinceIso: string,
  untilIso: string
): CostSummary {
  const providerBuckets = new Map<string, CostBucket>();
  const modelBuckets = new Map<string, CostBucket>();
  const dayBuckets = new Map<string, CostDayBucket>();

  let totalCostUsd = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const ev of events) {
    totalCostUsd += ev.costUsd;
    totalPromptTokens += ev.promptTokens;
    totalCompletionTokens += ev.completionTokens;

    const providerKey = ev.provider;
    const providerBucket = providerBuckets.get(providerKey) ?? {
      key: providerKey,
      costUsd: 0,
      eventCount: 0,
    };
    providerBucket.costUsd += ev.costUsd;
    providerBucket.eventCount += 1;
    providerBuckets.set(providerKey, providerBucket);

    const modelKey = ev.model;
    const modelBucket = modelBuckets.get(modelKey) ?? {
      key: modelKey,
      costUsd: 0,
      eventCount: 0,
    };
    modelBucket.costUsd += ev.costUsd;
    modelBucket.eventCount += 1;
    modelBuckets.set(modelKey, modelBucket);

    const dayKey = isoDay(ev.occurredAt);
    const dayBucket = dayBuckets.get(dayKey) ?? {
      day: dayKey,
      costUsd: 0,
      eventCount: 0,
    };
    dayBucket.costUsd += ev.costUsd;
    dayBucket.eventCount += 1;
    dayBuckets.set(dayKey, dayBucket);
  }

  const byProvider = Array.from(providerBuckets.values()).sort(
    (a, b) => b.costUsd - a.costUsd
  );
  const byModel = Array.from(modelBuckets.values()).sort(
    (a, b) => b.costUsd - a.costUsd
  );
  const byDay = Array.from(dayBuckets.values()).sort((a, b) =>
    a.day < b.day ? -1 : a.day > b.day ? 1 : 0
  );

  return {
    sinceIso,
    untilIso,
    eventCount: events.length,
    totalCostUsd,
    totalPromptTokens,
    totalCompletionTokens,
    byProvider,
    byModel,
    byDay,
  };
}
