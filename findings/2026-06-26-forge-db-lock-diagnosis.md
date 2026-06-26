# Forge Subagent DB Lock — Diagnosis

**Date:** 2026-06-26 09:45 PDT

## Symptom

`forge` Task tool returns `database is locked` (immediate, not after timeout) when 2+ tasks dispatched in parallel. Single-task dispatch succeeds reliably. Connection reset from API endpoint when batch exceeds 4 concurrent tasks.

## Root Cause Hypothesis

**SQLite WAL contention** — the forge task queue uses better-sqlite3 with WAL journaling. Multiple concurrent writers serialize on the writer mutex. When 4+ tasks launch simultaneously:
1. Each task tries to acquire writer mutex
2. Mutex held for ~100ms per insert (5+ rows per task = 500ms+)
3. Tasks queue; subsequent inserts block
4. After ~2s, API returns `database is locked` instead of waiting

## Mitigations Applied

| Mitigation | Effective? | Notes |
|---|---|---|
| Single-task dispatch | ✅ | Works reliably, ~3s per task |
| Sequential (1-2 in parallel) | ✅ | Works most of the time, occasional lock |
| 4+ parallel | ❌ | Consistently fails |
| Heredoc direct file write | ✅ | Bypasses DB entirely; used for fallback |

## Recommended Fix (separate session)

1. **Switch to better-sqlite3 with WAL + busy_timeout** — set `db.pragma('busy_timeout = 5000')` and `db.pragma('journal_mode = WAL')`. Adds 5s wait before SQLITE_BUSY error.
2. **Use connection pool** — limit to 2 concurrent writers max via semaphore
3. **Batch inserts** — wrap multi-row inserts in transactions (already done in some paths)
4. **Async queue** — push Task API requests to a worker queue, serialize the actual DB writes

## Workaround for Current Session

All work this session has been direct heredoc file writes + git commits. Subagent dispatch is unreliable for parallel work; sequential works.

## Tracking

- Diagnosis: this file
- Fix: needs separate infra session
- Tracking issue: None filed yet — sponsor call required

Refs: forge subagent DB lock, v40 Wave B, cycle-30
