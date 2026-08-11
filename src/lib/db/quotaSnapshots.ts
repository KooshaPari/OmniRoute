import { getDbInstance, rowToCamel } from "./core";
import { toRecord } from "./caseMapping";
import type { QuotaSnapshotRow, ProviderUtilizationPoint } from "@/shared/types/utilization";
import { createLogger } from "@/shared/utils/logger";

// Required field list for runtime drift detection. Must match QuotaSnapshotRow
// exactly; if either changes, the other must too (compile-time signal).
const REQUIRED_QUOTA_SNAPSHOT_FIELDS = [
  "id",
  "provider",
  "connectionId",
  "windowKey",
  "remainingPercentage",
  "isExhausted",
  "nextResetAt",
  "windowDurationMs",
  "rawData",
  "createdAt",
] as const satisfies ReadonlyArray<keyof QuotaSnapshotRow>;

type JsonRecord = Record<string, unknown>;

interface StatementLike<TRow = unknown> {
  all: (...params: unknown[]) => TRow[];
  get: (...params: unknown[]) => TRow | undefined;
  run: (...params: unknown[]) => { changes: number };
}

interface DbLike {
  prepare: <TRow = unknown>(sql: string) => StatementLike<TRow>;
}

const log = createLogger("db:quota-snapshots");

let lastCleanupAt = 0;

export function saveQuotaSnapshot(snapshot: Omit<QuotaSnapshotRow, "id" | "createdAt">): void {
  const db = getDbInstance() as unknown as DbLike;
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO quota_snapshots
       (provider, connection_id, window_key, remaining_percentage, is_exhausted,
        next_reset_at, window_duration_ms, raw_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      snapshot.provider,
      snapshot.connectionId,
      snapshot.windowKey,
      snapshot.remainingPercentage,
      snapshot.isExhausted,
      snapshot.nextResetAt,
      snapshot.windowDurationMs,
      snapshot.rawData,
      now
    );
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      log.warn("Skipping save: quota_snapshots table not found. Awaiting migration.");
      return;
    }
    throw err;
  }
}

export function getQuotaSnapshots(opts: {
  provider?: string;
  connectionId?: string;
  since: string;
  until?: string;
}): QuotaSnapshotRow[] {
  const db = getDbInstance() as unknown as DbLike;
  const conditions: string[] = ["created_at >= ?"];
  const params: unknown[] = [opts.since];

  if (opts.provider) {
    conditions.push("provider = ?");
    params.push(opts.provider);
  }

  if (opts.connectionId) {
    conditions.push("connection_id = ?");
    params.push(opts.connectionId);
  }

  if (opts.until) {
    conditions.push("created_at <= ?");
    params.push(opts.until);
  }

  try {
    const sql = `SELECT * FROM quota_snapshots WHERE ${conditions.join(" AND ")} ORDER BY created_at ASC`;
    const rows = db.prepare(sql).all(...params);
    return rows.map((r) =>
      toRecord<QuotaSnapshotRow>(rowToCamel(r), REQUIRED_QUOTA_SNAPSHOT_FIELDS),
    );
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      return [];
    }
    throw err;
  }
}

/**
 * Returns the single latest snapshot row for each distinct `window_key`
 * ever observed for this connection.
 *
 * Deliberately NOT a "most recent N rows across all windows" query: a
 * connection with many quota windows where only a subset actively churn
 * (frequent writes as they drain) and the rest stay idle/healthy (a single
 * old row each, thanks to the #4438 no-op-write dedup) would otherwise have
 * its recent-rows slice flooded entirely by the hot windows, silently
 * evicting the idle windows from rehydration (#8431). Scoping "latest" PER
 * window_key via a window function keeps every window visible regardless of
 * how skewed the write frequency is across windows.
 */
export function getLatestQuotaSnapshotsForConnection(connectionId: string): QuotaSnapshotRow[] {
  const db = getDbInstance() as unknown as DbLike;

  try {
    const rows = db
      .prepare(
        `SELECT * FROM (
           SELECT *, ROW_NUMBER() OVER (
             PARTITION BY window_key ORDER BY created_at DESC, id DESC
           ) AS rn
           FROM quota_snapshots
           WHERE connection_id = ?
         )
         WHERE rn = 1`
      )
      .all(connectionId);

    return rows.map((row) => rowToCamel(row) as unknown as QuotaSnapshotRow);
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      return [];
    }
    throw err;
  }
}

export function getLatestQuotaSnapshotsForConnection(connectionId: string): QuotaSnapshotRow[] {
  const db = getDbInstance() as unknown as DbLike;

  try {
    const rows = db
      .prepare(
        `SELECT * FROM quota_snapshots
         WHERE connection_id = ?
         ORDER BY created_at DESC
         LIMIT 200`
      )
      .all(connectionId);
    const latestByWindow = new Map<string, QuotaSnapshotRow>();

    for (const row of rows) {
      const snapshot = rowToCamel(row) as unknown as QuotaSnapshotRow;
      const windowKey =
        (snapshot as unknown as { windowKey?: string }).windowKey ?? snapshot.window_key;
      if (!windowKey || latestByWindow.has(windowKey)) continue;
      latestByWindow.set(windowKey, snapshot);
    }

    return [...latestByWindow.values()];
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      return [];
    }
    throw err;
  }
}

export function getAggregatedSnapshots(opts: {
  provider?: string;
  since: string;
  until?: string;
  bucketMinutes: number;
  aggregateBy?: "provider" | "connection";
}): ProviderUtilizationPoint[] {
  const db = getDbInstance() as unknown as DbLike;
  const conditions: string[] = ["created_at >= ?"];
  const params: unknown[] = [opts.since];

  if (opts.provider) {
    conditions.push("provider = ?");
    params.push(opts.provider);
  }

  if (opts.until) {
    conditions.push("created_at <= ?");
    params.push(opts.until);
  }

  const bucketSeconds = Number(opts.bucketMinutes) * 60;
  if (!Number.isFinite(bucketSeconds) || bucketSeconds <= 0) {
    throw new Error("Invalid bucket size");
  }

  const groupFields =
    opts.aggregateBy === "connection"
      ? "bucket, provider, connection_id, window_key"
      : "bucket, provider, window_key";
  const selectKey =
    opts.aggregateBy === "connection" ? "provider || ':' || connection_id as provider" : "provider";

  try {
    const sql = `
      SELECT
        datetime((strftime('%s', created_at) / ${bucketSeconds}) * ${bucketSeconds}, 'unixepoch') as bucket,
        ${selectKey},
        AVG(remaining_percentage) as remainingPct,
        MAX(is_exhausted) as isExhausted,
        window_key
      FROM quota_snapshots
      WHERE ${conditions.join(" AND ")}
      GROUP BY ${groupFields}
      ORDER BY bucket ASC
    `;

    const rows = db.prepare(sql).all(...params) as Array<{
      bucket: string;
      provider: string;
      remainingPct: number | null;
      isExhausted: number;
      windowKey: string;
    }>;

    return rows.map((r) => ({
      timestamp: r.bucket,
      provider: r.provider,
      remainingPct: r.remainingPct ?? 0,
      isExhausted: r.isExhausted === 1,
      windowKey: r.windowKey,
    }));
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      return [];
    }
    throw err;
  }
}

export function cleanupOldSnapshots(retentionDays = 90): number {
  const now = Date.now();
  const cleanupThresholdMs = 6 * 60 * 60 * 1000;

  if (now - lastCleanupAt < cleanupThresholdMs) {
    return 0;
  }

  const db = getDbInstance() as unknown as DbLike;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = db.prepare("DELETE FROM quota_snapshots WHERE created_at < ?").run(cutoffDate);
    lastCleanupAt = now;
    return result.changes;
  } catch (err: any) {
    if (err?.message?.includes("no such table")) {
      return 0;
    }
    throw err;
  }
}
