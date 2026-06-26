/**
 * Tier 3: On-disk segmented cache — PR-036 Multi-tier LRU Cache
 *
 * Provides a shared / cross-process cache using the filesystem.
 * Entries are written as individual JSON files under a configurable
 * directory (default: `OMNIROUTE_CACHE_DIR || 'data/cache'`).
 *
 * A simple LRU directory structure is approximated by splitting entries
 * into 256 sub-directories (first two hex chars of the key) to avoid
 * any single directory having too many entries.
 *
 * This tier is designed for multi-process setups (e.g. PM2 cluster mode)
 * where multiple Node.js processes share the same disk cache.
 *
 * @module lib/cache/tiers/disk
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface DiskTierOptions {
  baseDir?: string;
  maxEntries?: number;
  maxBytes?: number;
  ttlMs?: number;
}

interface DiskEntry {
  value: unknown;
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  tokensSaved: number;
}

const DEFAULT_MAX_ENTRIES = 50_000;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024; // 512 MB
const DEFAULT_TTL = 12 * 60 * 60 * 1000; // 12 hours

export class DiskTier {
  #baseDir: string;
  #maxEntries: number;
  #maxBytes: number;
  #defaultTtl: number;

  constructor(options: DiskTierOptions = {}) {
    this.#baseDir = options.baseDir ?? (process.env.OMNIROUTE_CACHE_DIR || path.join("data", "cache"));
    this.#maxEntries = options.maxEntries ?? parseInt(process.env.DISK_CACHE_MAX_ENTRIES || String(DEFAULT_MAX_ENTRIES), 10);
    this.#maxBytes = options.maxBytes ?? parseInt(process.env.DISK_CACHE_MAX_BYTES || String(DEFAULT_MAX_BYTES), 10);
    this.#defaultTtl = options.ttlMs ?? parseInt(process.env.DISK_CACHE_TTL_MS || String(DEFAULT_TTL), 10);
    this.#ensureDirs();
  }

  // ── Public API ──────────────────────────────────────

  /**
   * Read from disk cache.
   * Returns `{ value, tokensSaved }` or `null` if missing / expired.
   */
  get(key: string): { value: unknown; tokensSaved: number } | null {
    const filePath = this.#keyPath(key);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const entry: DiskEntry = JSON.parse(raw);
      if (Date.now() > new Date(entry.expiresAt).getTime()) {
        this.#deleteFile(filePath);
        return null;
      }
      // Touch the file to update LRU order (update mtime)
      const now = new Date();
      fs.utimesSync(filePath, now, now);
      return { value: entry.value, tokensSaved: entry.tokensSaved };
    } catch {
      return null;
    }
  }

  /**
   * Write to disk cache.
   */
  set(key: string, value: unknown, options?: { ttlMs?: number; tokensSaved?: number }): void {
    const ttl = options?.ttlMs ?? this.#defaultTtl;
    const now = new Date();
    const entry: DiskEntry = {
      value,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
      tokensSaved: options?.tokensSaved ?? 0,
    };
    const filePath = this.#keyPath(key);
    this.#ensureDirsFor(filePath);

    // Evict if over budget
    this.#evictIfNeeded(JSON.stringify(value).length * 2);

    try {
      fs.writeFileSync(filePath + ".tmp", JSON.stringify(entry), "utf-8");
      fs.renameSync(filePath + ".tmp", filePath);
    } catch {
      // Write failed — skip
    }
  }

  /**
   * Delete a single entry.
   */
  delete(key: string): boolean {
    const filePath = this.#keyPath(key);
    return this.#deleteFile(filePath);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    try {
      this.#rmDir(this.#baseDir);
      this.#ensureDirs();
    } catch {
      // ignore
    }
  }

  /**
   * Return approximate non-expired entry count.
   * Walks all sub-directories; use sparingly.
   */
  get size(): number {
    return this.#walkFiles().length;
  }

  // ── Private ──────────────────────────────────────────

  #ensureDirs(): void {
    try {
      fs.mkdirSync(this.#baseDir, { recursive: true });
      // Create 256 sub-directories (00–ff)
      for (let i = 0; i < 256; i++) {
        const sub = i.toString(16).padStart(2, "0");
        fs.mkdirSync(path.join(this.#baseDir, sub), { recursive: true });
      }
    } catch {
      // best-effort
    }
  }

  #ensureDirsFor(filePath: string): void {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    } catch {
      // best-effort
    }
  }

  #keyPath(key: string): string {
    const hash = crypto.createHash("md5").update(key).digest("hex");
    const prefix = hash.slice(0, 2);
    return path.join(this.#baseDir, prefix, hash);
  }

  #deleteFile(filePath: string): boolean {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  #walkFiles(): string[] {
    const results: string[] = [];
    try {
      for (const sub of fs.readdirSync(this.#baseDir)) {
        const subPath = path.join(this.#baseDir, sub);
        if (!fs.statSync(subPath).isDirectory()) continue;
        for (const file of fs.readdirSync(subPath)) {
          const filePath = path.join(subPath, file);
          if (!fs.statSync(filePath).isFile()) continue;
          // Skip expired
          try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const entry: DiskEntry = JSON.parse(raw);
            if (Date.now() <= new Date(entry.expiresAt).getTime()) {
              results.push(filePath);
            } else {
              this.#deleteFile(filePath);
            }
          } catch {
            this.#deleteFile(filePath);
          }
        }
      }
    } catch {
      // ignore
    }
    return results;
  }

  #evictIfNeeded(entrySize: number): void {
    // Simple eviction: if total files exceed max, delete oldest
    const files = this.#walkFiles();
    if (files.length < this.#maxEntries) return;

    // Sort by mtime, oldest first
    files.sort((a, b) => {
      try {
        return fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs;
      } catch {
        return 0;
      }
    });

    const toEvict = Math.ceil(files.length * 0.1); // evict 10%
    for (let i = 0; i < toEvict && i < files.length; i++) {
      this.#deleteFile(files[i]);
    }
  }

  #rmDir(dir: string): void {
    try {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
          this.#rmDir(full);
        } else {
          fs.unlinkSync(full);
        }
      }
      fs.rmdirSync(dir);
    } catch {
      // ignore
    }
  }
}
