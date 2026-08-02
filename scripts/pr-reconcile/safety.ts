import { Buffer } from "node:buffer";

export interface DispatchDecisionInput {
  skip?: boolean;
  skipReason?: string;
  duplicate?: boolean;
  isDuplicate?: boolean;
  headShaMatches?: boolean;
  expectedHeadSha?: string;
  actualHeadSha?: string;
  pullRequest?: { headSha?: string };
}

export interface DispatchDecision {
  dispatch: boolean;
  reason?: string;
}

/** Return one bounded page without mutating the source collection. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): T[] {
  if (!Number.isFinite(page) || !Number.isFinite(pageSize) || page < 1 || pageSize < 1) {
    return [];
  }
  const start = (Math.floor(page) - 1) * Math.floor(pageSize);
  if (!Number.isSafeInteger(start) || start >= items.length) return [];
  return items.slice(start, start + Math.floor(pageSize));
}

/** Cap a string by encoded UTF-8 bytes without emitting a partial code point. */
export function capUtf8Bytes(value: string, maxBytes: number): string {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return "";
  const limit = Math.floor(maxBytes);
  if (Buffer.byteLength(value, "utf8") <= limit) return value;
  let bytes = 0;
  let result = "";
  for (const character of value) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > limit) break;
    result += character;
    bytes += size;
  }
  return result;
}

/** Compare non-empty commit SHAs while tolerating GitHub's casing. */
export function compareHeadSha(expected: string, actual: string): boolean {
  const left = expected.trim();
  const right = actual.trim();
  return left.length > 0 && right.length > 0 && left.toLowerCase() === right.toLowerCase();
}

/** Test event identity against a caller-owned set without mutating that set. */
export function isDuplicateEvent(
  event: string | { id?: string; eventId?: string; deliveryId?: string },
  seen: ReadonlySet<string> | readonly string[]
): boolean {
  const eventId = typeof event === "string" ? event : event.eventId ?? event.deliveryId ?? event.id;
  if (typeof eventId !== "string" || eventId.length === 0) return false;
  return Array.isArray(seen) ? seen.includes(eventId) : seen.has(eventId);
}

/** Apply dispatch safety gates in a stable order before any webhook call. */
export function getDispatchDecision(input: DispatchDecisionInput): DispatchDecision {
  if (input.skip) return { dispatch: false, reason: input.skipReason ?? "policy_skip" };
  if (input.duplicate || input.isDuplicate) return { dispatch: false, reason: "duplicate_event" };
  if (typeof input.headShaMatches === "boolean" && !input.headShaMatches) {
    return { dispatch: false, reason: "head_sha_mismatch" };
  }
  if (input.expectedHeadSha !== undefined || input.actualHeadSha !== undefined) {
    if (!compareHeadSha(input.expectedHeadSha ?? "", input.actualHeadSha ?? "")) {
      return { dispatch: false, reason: "head_sha_mismatch" };
    }
  }
  if (input.pullRequest?.headSha !== undefined && input.actualHeadSha !== undefined) {
    if (!compareHeadSha(input.pullRequest.headSha, input.actualHeadSha)) {
      return { dispatch: false, reason: "head_sha_mismatch" };
    }
  }
  return { dispatch: true };
}
