import { BaseGuardrail, type GuardrailContext, type GuardrailResult } from "./base";
import { scanLocalDlp, type DlpScanResult } from "./localDlpScanner";

type Mode = "warn" | "redact" | "block";

interface Stats {
  categories: string[];
  count: number;
}

function addScan(stats: Stats, result: DlpScanResult): void {
  for (const category of result.categories) {
    if (!stats.categories.includes(category)) stats.categories.push(category);
  }
  stats.count += result.matches.length;
}

function scanString(
  text: string,
  mode: Mode,
  stats: Stats
): { modified: boolean; value: string } {
  const result = scanLocalDlp(text);
  if (result.matches.length > 0) addScan(stats, result);
  if (mode === "redact" && result.matches.length > 0) {
    return { modified: true, value: result.redactedText };
  }
  return { modified: false, value: text };
}

function walkValue(
  value: unknown,
  mode: Mode,
  stats: Stats,
  seen: WeakSet<object>
): { modified: boolean; value: unknown } {
  if (Array.isArray(value)) {
    if (seen.has(value)) return { modified: false, value };
    seen.add(value);
    let next: unknown[] | null = null;
    for (let index = 0; index < value.length; index++) {
      const r = walkValue(value[index], mode, stats, seen);
      if (r.modified && !next) next = value.slice(0, index);
      if (next) next[index] = r.value;
    }
    seen.delete(value);
    return { modified: next !== null, value: next ?? value };
  }

  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) {
      return { modified: false, value };
    }
    return walkObject(value as Record<string, unknown>, mode, stats, seen);
  }

  return { modified: false, value };
}

function walkObject(
  obj: Record<string, unknown>,
  mode: Mode,
  stats: Stats,
  seen: WeakSet<object>
): { modified: boolean; value: unknown } {
  if (seen.has(obj)) return { modified: false, value: obj };
  const prototype = Object.getPrototypeOf(obj);
  if (prototype !== null && prototype !== Object.prototype) {
    return { modified: false, value: obj };
  }

  seen.add(obj);
  const entries = Object.entries(obj);
  let next: Record<string, unknown> | null = null;

  for (let index = 0; index < entries.length; index++) {
    const [key, entryValue] = entries[index];
    let r: { modified: boolean; value: unknown };

    if (key === "content") {
      r = scanContent(entryValue, mode, stats, seen);
    } else if (key === "arguments" || key === "args" || key === "text") {
      if (typeof entryValue === "string") {
        r = scanString(entryValue, mode, stats);
      } else {
        r = walkValue(entryValue, mode, stats, seen);
      }
    } else {
      r = walkValue(entryValue, mode, stats, seen);
    }

    if (r.modified && !next) {
      next = Object.create(prototype) as Record<string, unknown>;
      for (let previous = 0; previous < index; previous++) {
        const [previousKey, previousValue] = entries[previous];
        next[previousKey] = previousValue;
      }
    }
    if (next) next[key] = r.value;
  }

  seen.delete(obj);
  return { modified: next !== null, value: next ?? obj };
}

function scanContentPart(
  part: unknown,
  mode: Mode,
  stats: Stats,
  seen: WeakSet<object>
): { modified: boolean; value: unknown } {
  if (typeof part === "string") {
    return scanString(part, mode, stats);
  }

  if (part && typeof part === "object") {
    const prototype = Object.getPrototypeOf(part);
    if (prototype !== null && prototype !== Object.prototype) {
      return { modified: false, value: part };
    }
    return walkObject(part as Record<string, unknown>, mode, stats, seen);
  }

  return { modified: false, value: part };
}

function scanContent(
  value: unknown,
  mode: Mode,
  stats: Stats,
  seen: WeakSet<object>
): { modified: boolean; value: unknown } {
  if (typeof value === "string") {
    return scanString(value, mode, stats);
  }

  if (Array.isArray(value)) {
    let next: unknown[] | null = null;
    for (let index = 0; index < value.length; index++) {
      const r = scanContentPart(value[index], mode, stats, seen);
      if (r.modified && !next) next = value.slice(0, index);
      if (next) next[index] = r.value;
    }
    return { modified: next !== null, value: next ?? value };
  }

  if (value && typeof value === "object") {
    return walkObject(value as Record<string, unknown>, mode, stats, seen);
  }

  return { modified: false, value };
}

function scanPayload(
  payload: unknown,
  mode: Mode,
  stats: Stats
): { modified: boolean; payload: unknown } {
  const seen = new WeakSet<object>();
  if (typeof payload === "string") {
    const r = scanString(payload, mode, stats);
    return { modified: r.modified, payload: r.value };
  }
  if (Array.isArray(payload)) {
    const r = walkValue(payload, mode, stats, seen);
    return { modified: r.modified, payload: r.value };
  }
  if (payload && typeof payload === "object") {
    const r = walkObject(payload as Record<string, unknown>, mode, stats, seen);
    return { modified: r.modified, payload: r.value };
  }
  return { modified: false, payload };
}

const GENERIC_BLOCK_MESSAGE = "Blocked by local DLP policy";

export class LocalDlpModerationGuardrail extends BaseGuardrail {
  constructor(options: { enabled?: boolean; priority?: number } = {}) {
    super("local-dlp-moderation", {
      enabled: options.enabled ?? process.env.DLP_MODERATION_ENABLED === "true",
      priority: options.priority ?? 90,
    });
  }

  async preCall(
    payload: unknown,
    _context: GuardrailContext
  ): Promise<GuardrailResult<unknown> | void> {
    if (process.env.DLP_MODERATION_ENABLED !== "true") {
      return { block: false };
    }

    const rawMode = (process.env.DLP_MODERATION_MODE || "warn").toLowerCase();
    const mode: Mode =
      rawMode === "redact" || rawMode === "block" || rawMode === "warn"
        ? (rawMode as Mode)
        : "warn";

    const stats: Stats = { categories: [], count: 0 };
    const { modified, payload: next } = scanPayload(payload, mode, stats);
    const hasDetections = stats.count > 0;

    if (mode === "block" && hasDetections) {
      return {
        block: true,
        message: GENERIC_BLOCK_MESSAGE,
        meta: { categories: stats.categories, count: stats.count },
      };
    }

    if (mode === "redact" && hasDetections) {
      return {
        block: false,
        modifiedPayload: next,
        meta: { categories: stats.categories, count: stats.count },
      };
    }

    if (hasDetections) {
      return {
        block: false,
        meta: { categories: stats.categories, count: stats.count },
      };
    }

    return { block: false };
  }
}
