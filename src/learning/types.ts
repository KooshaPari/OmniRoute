/**
 * learning/types.ts — Phase 3 self-healing v2 shared types.
 *
 * The SelfHealingManager, AnomalyDetector, and playbook dispatcher all
 * pass these types around. Keeping them in one file avoids a circular
 * import triangle between db/providerHealthHistory.ts,
 * resilience/anomalyDetector.ts, and resilience/selfHealing.ts.
 */

import type { ProviderHealthSample } from "@/lib/db/providerHealthHistory";

/** Severity tiers used by AnomalyDetector and playbooks. */
export type AnomalySeverity = "info" | "warn" | "critical";

/** The class of metric that triggered the anomaly. */
export type AnomalyDimension = "error_rate" | "p95_latency_ms" | "consecutive_failures";

/** A flagged outlier from AnomalyDetector.detect(). */
export interface AnomalySignal {
  providerKey: string;
  dimension: AnomalyDimension;
  /** Snapshot value at sampledAt. */
  value: number;
  /** Z-score for the rolling window the value was scored against. */
  zScore: number;
  /** Rolling mean + stdev at the time of detection (debug / audit). */
  mean: number;
  stdev: number;
  /** Sample count backing the rolling mean/stdev. */
  sampleCount: number;
  /** Most-recent sample timestamp used as the scoring anchor. */
  sampledAt: number;
  severity: AnomalySeverity;
}

/**
 * The shape an AnomalyDetector consumes — newest sample + history of
 * the same dimension for one provider, sorted oldest -> newest.
 */
export interface AnomalyWindow {
  providerKey: string;
  dimension: AnomalyDimension;
  samples: ProviderHealthSample[];
}

/** AnomalyDetector configuration. Wires straight to SelfHealingSettings. */
export interface AnomalyDetectorConfig {
  /** Rolling window length (samples) for each dimension. */
  windowSize: number;
  /** Z-score above which a sample is flagged. */
  warnThreshold: number;
  /** Z-score above which a sample is escalated to "critical". */
  criticalThreshold: number;
  /** Below this many samples, the detector is dormant (cold start). */
  minSamplesForDetection: number;
  /** Optional per-dimension overrides. */
  perDimension?: Partial<Record<AnomalyDimension, {
    warnThreshold?: number;
    criticalThreshold?: number;
    minSamplesForDetection?: number;
  }>>;
}

/**
 * Tunnel-vision description of a playbook action. SelfHealingManager hands
 * these to the executor — the executor is the only thing that knows how to
 * actually execute them.
 */
export type PlaybookAction =
  | { kind: "wait"; durationMs: number; reason: string }
  | { kind: "cooldown_provider"; providerKey: string; cooldownMs: number }
  | { kind: "rotate_combo"; providerKey: string; reason: string }
  | { kind: "reroute_through"; fromProviderKey: string; toProviderKey: string; reason: string }
  | { kind: "drop_combo"; providerKey: string; reason: string };

/** How a playbook executed. */
export type PlaybookOutcome =
  | { kind: "noop"; reason: string }
  | { kind: "executed"; action: PlaybookAction; appliedAt: number; sequenceId: string }
  | { kind: "throttled"; reason: string; retryAt: number }
  | { kind: "rejected"; reason: string };

/** A sample's worth of metadata persisted for audit / explainability. */
export interface SelfHealingEvent {
  providerKey: string;
  anomaly: AnomalySignal;
  outcome: PlaybookOutcome;
  recordedAt: number;
}
