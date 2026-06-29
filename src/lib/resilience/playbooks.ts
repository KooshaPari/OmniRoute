/**
 * resilience/playbooks.ts — Typed playbook catalog for self-healing.
 *
 * Each playbook is a *closed* enum of typed action variants. The variant
 * discriminator is `action`, and every other field is required (no optional
 * fields, no `any`). This keeps the dispatch surface tight: a developer
 * reading the catalog can enumerate every action the manager can take
 * without reading any other file.
 *
 * The catalog is intentionally tiny (3 actions). Future playbooks (route
 * to emergency fallback, restart sub-process, etc.) get added by
 * extending the `Playbook` discriminated union — TypeScript will then
 * force every consumer to handle the new variant.
 */

export type Playbook =
  | {
      action: "degrade-provider";
      /** Provider id to mark degraded. */
      providerId: string;
      /** Reason code emitted into the health history ledger. */
      reason: string;
      /** Seconds the degradation lasts before automatic recovery. */
      cooloffSec: number;
    }
  | {
      action: "force-proxy-rotation";
      /** Provider id whose proxy should rotate. */
      providerId: string;
      /** Reason code for the rotation event. */
      reason: string;
      /** Number of proxies to rotate through before re-trying the provider. */
      rotateCount: number;
    }
  | {
      action: "drop-cooldown";
      /** Provider id whose cooldown window should be cleared. */
      providerId: string;
      /** Reason code for the clear event. */
      reason: string;
    };

export type PlaybookAction = Playbook["action"];

export const PLAYBOOK_ACTIONS: ReadonlyArray<PlaybookAction> = [
  "degrade-provider",
  "force-proxy-rotation",
  "drop-cooldown",
] as const;

/**
 * Pure validator: returns null when the playbook is well-formed, or a
 * string explaining why it was rejected. Used both at the manager
 * dispatch site and in unit tests.
 */
export function validatePlaybook(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return "playbook must be an object";
  }
  const pb = input as Record<string, unknown>;
  const action = pb.action;
  if (typeof action !== "string") {
    return "playbook.action must be a string";
  }
  if (!PLAYBOOK_ACTIONS.includes(action as PlaybookAction)) {
    return `unknown playbook.action "${action}". Allowed: ${PLAYBOOK_ACTIONS.join(", ")}`;
  }
  if (typeof pb.providerId !== "string" || pb.providerId.length === 0) {
    return "playbook.providerId must be a non-empty string";
  }
  if (typeof pb.reason !== "string" || pb.reason.length === 0) {
    return "playbook.reason must be a non-empty string";
  }
  if (action === "degrade-provider") {
    if (typeof pb.cooloffSec !== "number" || !Number.isFinite(pb.cooloffSec) || pb.cooloffSec <= 0) {
      return "playbook.cooloffSec must be a positive number";
    }
  }
  if (action === "force-proxy-rotation") {
    if (
      typeof pb.rotateCount !== "number" ||
      !Number.isInteger(pb.rotateCount) ||
      pb.rotateCount <= 0
    ) {
      return "playbook.rotateCount must be a positive integer";
    }
  }
  return null;
}

/**
 * Pure narrowing helper: refines an `unknown` into a typed `Playbook` if
 * `validatePlaybook` returns null. Returns null otherwise.
 */
export function parsePlaybook(input: unknown): Playbook | null {
  if (validatePlaybook(input) !== null) return null;
  return input as Playbook;
}