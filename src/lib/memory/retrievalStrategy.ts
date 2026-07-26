/**
 * retrievalStrategy.ts — multi-source memory retrieval orchestration.
 *
 * Extracted from src/lib/memory/retrieval.ts to isolate the rank/merge/budget
 * logic that is invoked by both retrieveMemories (production) and retrievePreview
 * (Playground dry-run). This module is dependency-free: it imports only from
 * ./retrieval/scoring, ./qdrant (the facade), and the local DB. retrieval.ts
 * imports from here — never the reverse. No circular imports.
 *
 * Public surface (consumed by retrieval.ts):
 *   - hasTable(name)
 *   - fetchMemoriesByIds(ids)
 *   - applyRerank(items, query, model)
 *   - buildFtsRows(apiKeyId, config)
 *   - getMemoryColumns()  → column mapping for `memories` vs legacy `memory`
 *   - enforceTokenBudget(items, maxTokens)  → greedily accumulates entries
 *   - mergeHybridRows(ftsRows, keywordRows)  → dedup-by-id union
 *
 * Strategy types are also re-exported so retrieval.ts can keep its public tier
 * union without duplicating the literal type.
 */
import { getDbInstance } from "../db/core";
import { Memory } from "./types";
import { logger } from "../../../open-sse/utils/logger.ts";
import { sanitizeErrorMessage } from "../../../open-sse/utils/error.ts";
import { estimateTokens, rowToMemory, type MemoryRow } from "./retrieval/scoring";

const log = logger("MEMORY_RETRIEVAL_STRATEGY");

// ──────────────── Tier literal (re-exported for retrieval.ts) ────────────────

export type RetrievalTier = "fts5" | "vector" | "hybrid-rrf" | "qdrant";

export interface RankedItem<T extends RetrievalTier = RetrievalTier> {
  memory: Memory;
  score: number;
  tier: T;
}

// ──────────────── DB helpers ────────────────

/**
 * Returns true if the named table exists in the active SQLite database.
 * Used to detect the modern `memories` table vs the legacy `memory` table.
 */
export function hasTable(tableName: string): boolean {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return row?.name === tableName;
}

/**
 * Fetch memories from SQLite by an array of IDs, preserving input order.
 * Missing IDs are silently dropped (defensive — sqlite-vec may return hits
 * for rows that were deleted between the vector search and the lookup).
 */
export function fetchMemoriesByIds(ids: string[]): Memory[] {
  if (ids.length === 0) return [];
  const db = getDbInstance();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...ids) as MemoryRow[];

  const byId = new Map<string, Memory>();
  for (const row of rows) {
    byId.set(String(row.id), rowToMemory(row));
  }

  return ids.map((id) => byId.get(id)).filter((m): m is Memory => m !== undefined);
}

// ──────────────── Column mapping (modern vs legacy schema) ────────────────

export interface MemoryColumns {
  tableName: "memories" | "memory";
  apiKeyId: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Return the column mapping for the active memories table. The `memories`
 * table (modern) uses snake_case columns; the legacy `memory` table uses
 * camelCase. Consumers must call this once per request and reuse the result.
 */
export function getMemoryColumns(): MemoryColumns {
  const useModernTable = hasTable("memories");
  if (useModernTable) {
    return {
      tableName: "memories",
      apiKeyId: "api_key_id",
      sessionId: "session_id",
      createdAt: "created_at",
      expiresAt: "expires_at",
    };
  }
  return {
    tableName: "memory",
    apiKeyId: "apiKeyId",
    sessionId: "sessionId",
    createdAt: "createdAt",
    expiresAt: "expiresAt",
  };
}

// ──────────────── FTS5 builder ────────────────

export interface FtsColConfig {
  apiKeyCol: string;
  expiresCol: string;
  createdCol: string;
  sessionCol: string;
  tableName: string;
  query?: string;
  scope?: string;
  sessionId?: string;
  retentionDays?: number;
}

/**
 * Build the FTS5 rows for a given apiKeyId + config + query.
 * Returns a MemoryRow array (or empty on SQL error — FTS5 syntax errors are
 * degraded to no-op so a malformed user query never crashes retrieval).
 */
export function buildFtsRows(apiKeyId: string, config: FtsColConfig): MemoryRow[] {
  if (!config.query) return [];
  const db = getDbInstance();
  const {
    apiKeyCol,
    expiresCol,
    createdCol,
    sessionCol,
    tableName,
    query: q,
    scope,
    sessionId,
    retentionDays,
  } = config;

  let ftsQueryStr =
    `SELECT m.* FROM ${tableName} m ` +
    `JOIN memory_fts f ON m.memory_id = f.rowid ` +
    `WHERE f.memory_fts MATCH ? AND m.${apiKeyCol} = ? ` +
    `AND (m.${expiresCol} IS NULL OR datetime(m.${expiresCol}) > datetime('now'))`;
  if (scope === "session" && sessionId) {
    ftsQueryStr += ` AND m.${sessionCol} = ?`;
  }
  if (retentionDays && retentionDays > 0) {
    ftsQueryStr += ` AND datetime(m.${createdCol}) >= datetime(?)`;
  }
  ftsQueryStr += ` ORDER BY f.rank LIMIT 100`;

  const ftsParams: unknown[] = [q, apiKeyId];
  if (scope === "session" && sessionId) ftsParams.push(sessionId);
  if (retentionDays && retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    ftsParams.push(cutoff);
  }

  try {
    return db.prepare(ftsQueryStr).all(...ftsParams) as MemoryRow[];
  } catch {
    return [];
  }
}

// ──────────────── Rerank (loopback-only) ────────────────

// Loopback rerank URL — localhost only, never routed over the network.
// nosemgrep: javascript.lang.security.audit.non-literal-regexp.non-literal-regexp
const RERANK_LOOPBACK_URL = "http://127.0.0.1:20128/v1/rerank";

/**
 * Apply reranking via /v1/rerank (loopback-only) if rerankProviderModel is set.
 * Returns reordered array (or original order on any error — rerank failure
 * never fails retrieval).
 *
 * Security note: the URL is a hardcoded loopback address (127.0.0.1:20128) — it
 * never carries sensitive data over a network link. HTTP is safe for loopback IPC.
 * nosemgrep: javascript.lang.security.detect-non-literal-url
 */
export async function applyRerank<T extends { memory: Memory; score: number }>(
  items: T[],
  query: string,
  rerankProviderModel: string
): Promise<T[]> {
  if (items.length === 0) return items;

  try {
    const documents = items.map((item) => item.memory.content);
    const body = {
      model: rerankProviderModel,
      query,
      documents,
      top_n: items.length,
    };

    const res = await fetch(RERANK_LOOPBACK_URL, {
      // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      log.warn("memory.rerank.http_fail", {
        status: res.status,
        model: rerankProviderModel,
      });
      return items;
    }

    const data = (await res.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };

    if (!Array.isArray(data.results) || data.results.length === 0) {
      return items;
    }

    // Build reordered list using the index references from the rerank response
    const reordered: T[] = [];
    for (const r of data.results) {
      const idx = r.index;
      if (typeof idx === "number" && idx >= 0 && idx < items.length) {
        const item = items[idx];
        if (item) reordered.push({ ...item, score: r.relevance_score });
      }
    }
    // Append any items not mentioned in results (safety net)
    const mentionedIndices = new Set(data.results.map((r) => r.index));
    for (let i = 0; i < items.length; i++) {
      if (!mentionedIndices.has(i)) {
        const item = items[i];
        if (item) reordered.push(item);
      }
    }
    return reordered;
  } catch (err: unknown) {
    log.warn("memory.rerank.error", {
      error: sanitizeErrorMessage(err instanceof Error ? err.message : String(err)),
      model: rerankProviderModel,
    });
    return items;
  }
}

// ──────────────── Token budget enforcement ────────────────

/**
 * Greedy accumulator: pushes entries into `out` until adding the next one would
 * exceed `maxTokens`. The first entry is always pushed (even if it alone exceeds
 * the budget) so the caller never receives an empty result when there is at least
 * one candidate.
 *
 * Returns the final token total so callers can log it.
 */
export function enforceTokenBudget(
  items: ReadonlyArray<{ memory: Memory; score: number; tier: RetrievalTier }>,
  maxTokens: number,
  out: Array<{ memory: Memory; score: number; tier: RetrievalTier }>,
  initialTotal = 0
): number {
  let total = initialTotal;
  for (const entry of items) {
    const memoryTokens = estimateTokens(entry.memory.content);
    if (total + memoryTokens > maxTokens) {
      if (out.length === 0) {
        out.push(entry);
        total += memoryTokens;
      }
      break;
    }
    out.push(entry);
    total += memoryTokens;
  }
  return total;
}

// ──────────────── Hybrid row dedup (FTS5 ∪ keyword) ────────────────

/**
 * Union two MemoryRow streams, dedup by id, preserving input order. Used by the
 * hybrid strategy's FTS5-degraded path (FTS5 hits first, then chronological
 * keyword).
 */
export function mergeHybridRows(ftsRows: MemoryRow[], keywordRows: MemoryRow[]): MemoryRow[] {
  const seen = new Set<string>();
  const rows: MemoryRow[] = [];
  for (const row of [...ftsRows, ...keywordRows]) {
    const rowId = String(row.id);
    if (!seen.has(rowId)) {
      seen.add(rowId);
      rows.push(row);
    }
  }
  return rows;
}
