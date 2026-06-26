/**
 * Bounded ring buffer of recent compression runs.
 *
 * Used by the /api/compression/replay endpoint to fetch a specific
 * run by id and rehydrate its stats.  Pure in-memory store -- the
 * telemetry singleton (PR #109) is the canonical writer.
 */

export interface CompressedRunRecord {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  elapsedMs: number;
  costSavedUsd: number;
  enginesUsed: string[];
  success: boolean;
  errorMessage?: string;
}

const DEFAULT_CAPACITY = 1000;

export class RunHistoryBuffer {
  private capacity: number;
  private buffer: (CompressedRunRecord | undefined)[];
  private head = 0;
  private size_ = 0;
  private idCounter = 0;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    if (capacity <= 0) {
      throw new Error(`capacity must be > 0, got ${capacity}`);
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  record(
    input: Omit<CompressedRunRecord, 'id' | 'timestamp'> & {
      timestamp?: string;
    },
  ): CompressedRunRecord {
    this.idCounter += 1;
    const record: CompressedRunRecord = {
      ...input,
      id: `run-${Date.now()}-${this.idCounter}`,
      timestamp: input.timestamp ?? new Date().toISOString(),
    };
    this.buffer[this.head] = record;
    this.head = (this.head + 1) % this.capacity;
    if (this.size_ < this.capacity) this.size_ += 1;
    return record;
  }

  get(id: string): CompressedRunRecord | null {
    for (let i = 0; i < this.size_; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const rec = this.buffer[idx];
      if (rec && rec.id === id) return rec;
    }
    return null;
  }

  list(limit: number = 50): CompressedRunRecord[] {
    const out: CompressedRunRecord[] = [];
    const n = Math.min(limit, this.size_);
    for (let i = 0; i < n; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const rec = this.buffer[idx];
      if (rec) out.push(rec);
    }
    return out;
  }

  size(): number {
    return this.size_;
  }

  capacity$(): number {
    return this.capacity;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size_ = 0;
  }
}

let _instance: RunHistoryBuffer | null = null;

export function getRunHistoryBuffer(): RunHistoryBuffer {
  if (!_instance) _instance = new RunHistoryBuffer();
  return _instance;
}

/** Test-only: reset the singleton so each test starts clean. */
export function resetRunHistoryBuffer(): void {
  _instance = null;
}
