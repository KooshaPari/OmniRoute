/**
 * Wire tier-resolver + reconciler changes to the compliance audit log.
 *
 * Emits an audit event with action='polyglot.tier_change' every time
 * an edge's tier is forced, env-overridden, kill-switch-flipped, or
 * pressure-relaxed. Complies with the SOC2 / FedRAMP audit trail
 * requirement captured in docs/security/COMPLIANCE.md.
 *
 * @see src/lib/compliance/index.ts::logAuditEvent
 * @see docs/adr/0032-polyglot-binding-tiers.md § "Audit-log hook"
 */

import { logAuditEvent } from "@/lib/compliance";
import type { TierChangeReason } from "./tierResolver";

export interface TierChangeRecord {
  edge: string;
  oldTier: "T1" | "T2" | "T3" | null;
  newTier: "T1" | "T2" | "T3";
  reason: TierChangeReason;
  actor: string;
  ts: number;
  detail?: string;
}

/**
 * Emit a `polyglot.tier_change` audit event.
 *
 * Non-blocking: fires the event via the compliance module's queue and
 * returns immediately. Failures are logged at WARN level but never
 * block the calling path (audit must NEVER break the hot path).
 */
export function emitTierChangeAudit(rec: TierChangeRecord): void {
  try {
    logAuditEvent({
      action: "polyglot.tier_change",
      target: rec.edge,
      actor: rec.actor,
      metadata: {
        old_tier: rec.oldTier,
        new_tier: rec.newTier,
        reason: rec.reason,
        ts: rec.ts,
        detail: rec.detail ?? null,
      },
    });
  } catch (err) {
    // Never block — the audit logger is best-effort by design.
    // Use plain console.warn to avoid the pino-async-shutdown trap.
    if (typeof console !== "undefined") {
      console.warn("[polyglot] audit emit failed (non-fatal):", err);
    }
  }
}
