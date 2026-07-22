/**
 * resilience/selfHealingManager.ts — Self-healing coordinator.
 *
 * Wires together:
 *   - selfHealingSettings (tunables)
 *   - providerHealthHistory (DB persistence)
 *   - anomalyDetector (pure-function anomaly detection)
 *   - playbooks (typed action catalog)
 *
 * On boot, the manager hydrates the in-memory ring buffer from the DB.
 * Per provider health sample, the manager:
 *   1. Appends to the rolling window
 *   2. Asks the detector if a recent sample is anomalous
 *   3. If so, persists an AnomalyEvent + a Playbook, and (when not in
 *      dryRun) executes the playbook against the provider manager
 *
 * The manager is intentionally framework-free (no Express, no Next.js).
 * Engine glue in `engine.ts` calls `recordHealthSample` on every
 * completed provider request.
 */

import type { AnomalyDetector } from "./anomalyDetector";
import type { SelfHealingSettings } from "./selfHealingSettings";
import {
  type ProviderHealthSample,
  appendHealthSample,
  recentSamplesFor,
  pruneSamplesBefore,
} from "@/lib/db/providerHealthHistory";
import type { Playbook } from "./playbooks";

export interface HealthSample {
  providerId: string;
  metric: "latency" | "error_rate";
  value: number;
  timestamp: number;
}

export interface ProviderProbe {
  /**
   * Mark a provider as degraded for `cooloffSec`. Implementations should
   * route around the provider for that window.
   */
  degrade(providerId: string, cooloffSec: number, reason: string): Promise<void> | void;
  /**
   * Rotate the provider's proxy. `rotateCount` proxies should be tried
   * in order before falling back.
   */
  rotateProxy(providerId: string, rotateCount: number, reason: string): Promise<void> | void;
  /**
   * Drop any active cooldown window for a provider.
   */
  dropCooldown(providerId: string, reason: string): Promise<void> | void;
}

export interface SelfHealingManagerOptions {
  settings: SelfHealingSettings;
  detector: AnomalyDetector;
  /** Provider mutator interface — defaults to a no-op stub in tests. */
  probe?: ProviderProbe;
  /** Override "now" for deterministic tests. */
  clock?: () => number;
}

const DEFAULT_COOLOFF_SEC = 300;
const NOOP_PROBE: ProviderProbe = {
  degrade: () => undefined,
  rotateProxy: () => undefined,
  dropCooldown: () => undefined,
};

export class SelfHealingManager {
  private settings: SelfHealingSettings;
  private readonly detector: AnomalyDetector;
  private readonly probe: ProviderProbe;
  private readonly clock: () => number;

  /** Per-provider ring buffer of recent samples (in addition to DB). */
  private readonly windows = new Map<string, ProviderHealthSample[]>();

  /** Providers currently being acted on so we don't double-dispatch. */
  private readonly inflight = new Set<string>();

  constructor(opts: SelfHealingManagerOptions) {
    this.settings = opts.settings;
    this.detector = opts.detector;
    this.probe = opts.probe ?? NOOP_PROBE;
    this.clock = opts.clock ?? Date.now;
  }

  /**
   * Reconfigure on settings change. Returns a boolean indicating whether
   * the detector config actually changed.
   */
  updateSettings(next: SelfHealingSettings): boolean {
    const prev = this.settings;
    this.settings = next;
    return (
      prev.windowSize !== next.windowSize ||
      prev.warnThreshold !== next.warnThreshold ||
      prev.criticalThreshold !== next.criticalThreshold ||
      prev.minSamplesForDetection !== next.minSamplesForDetection
    );
  }

  /** Hydrate the in-memory window for a provider from the DB. */
  async hydrateProvider(providerId: string): Promise<void> {
    const samples = recentSamplesFor(providerId, this.settings.windowSize);
    this.windows.set(providerId, samples);
  }

  /** Record a new health sample for a provider and run anomaly detection. */
  async recordHealthSample(sample: HealthSample): Promise<Playbook | null> {
    if (sample.providerId.length === 0) {
      throw new Error("providerId must be non-empty");
    }

    // 1. Append to DB and in-memory window
    const persistedSample = toProviderHealthSample(sample);
    appendHealthSample(persistedSample);
    const window = this.windows.get(sample.providerId) ?? [];
    window.push(persistedSample);
    while (window.length > this.settings.windowSize) window.shift();
    this.windows.set(sample.providerId, window);

    // 2. Detect
    if (window.length < this.settings.minSamplesForDetection) return null;
    const prior = window.slice(0, -1);
    const signals = this.detector.detect(persistedSample, prior, {
      windowSize: this.settings.windowSize,
      warnThreshold: this.settings.warnThreshold,
      criticalThreshold: this.settings.criticalThreshold,
      minSamplesForDetection: this.settings.minSamplesForDetection,
    });
    const detected = signals[0];
    if (!detected) return null;

    // 3. Build playbook
    const playbook = buildPlaybookFor(sample, detected);
    if (!playbook) return null;

    if (!this.settings.playbookEnabled || this.inflight.has(sample.providerId)) {
      return playbook;
    }
    this.inflight.add(sample.providerId);
    try {
      await this.dispatch(playbook);
    } finally {
      this.inflight.delete(sample.providerId);
    }
    return playbook;
  }

  /** Execute the side-effects encoded in a playbook against the probe. */
  async dispatch(playbook: Playbook): Promise<void> {
    switch (playbook.action) {
      case "degrade-provider":
        await this.probe.degrade(playbook.providerId, playbook.cooloffSec, playbook.reason);
        return;
      case "force-proxy-rotation":
        await this.probe.rotateProxy(playbook.providerId, playbook.rotateCount, playbook.reason);
        return;
      case "drop-cooldown":
        await this.probe.dropCooldown(playbook.providerId, playbook.reason);
        return;
      default: {
        const _exhaustive: never = playbook;
        throw new Error(`Unknown playbook action: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  /** Prune DB rows older than the configured TTL. Returns rows pruned. */
  async pruneStale(ttlSec: number): Promise<number> {
    return pruneSamplesBefore(this.clock() / 1000 - ttlSec);
  }

  /** Prune DB rows older than the manager's configured retentionSeconds.
   *  Called on boot and periodically by the engine. */
  async prune(): Promise<number> {
    const ttlSec = this.settings.retentionSeconds ?? 86_400;
    return this.pruneStale(ttlSec);
  }

  /** Read-only snapshot of in-memory windows for tests. */
  peekWindow(providerId: string): readonly ProviderHealthSample[] {
    return this.windows.get(providerId) ?? [];
  }
}

function buildPlaybookFor(
  sample: HealthSample,
  detected: { zScore: number; dimension: string },
): Playbook | null {
  const cooloffSec = DEFAULT_COOLOFF_SEC;
  if (sample.metric === "latency") {
    return {
      action: "force-proxy-rotation",
      providerId: sample.providerId,
      reason: `anomaly:${detected.dimension}:z=${detected.zScore.toFixed(2)}`,
      rotateCount: 2,
    };
  }
  if (sample.metric === "error_rate") {
    return {
      action: "degrade-provider",
      providerId: sample.providerId,
      reason: `anomaly:${detected.dimension}:z=${detected.zScore.toFixed(2)}`,
      cooloffSec,
    };
  }
  return null;
}

function toProviderHealthSample(sample: HealthSample): ProviderHealthSample {
  return {
    providerKey: sample.providerId,
    sampledAt: sample.timestamp,
    errorRate: sample.metric === "error_rate" ? sample.value : 0,
    p95LatencyMs: sample.metric === "latency" ? sample.value : 0,
    activeComboCount: 0,
    consecutiveFailures: 0,
    samplesWindow: 1,
  };
}
