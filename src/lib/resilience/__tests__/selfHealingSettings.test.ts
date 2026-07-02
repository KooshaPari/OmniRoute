/**
 * Tests for selfHealingSettings normalizer.
 */

import { describe, test, expect } from "vitest";
import {
  DEFAULT_SELF_HEALING_SETTINGS,
  normalizeSelfHealingSettings,
  selfHealingSettingsToJson,
} from "../selfHealingSettings";

describe("normalizeSelfHealingSettings", () => {
  test("returns defaults on null / non-object input", () => {
    expect(normalizeSelfHealingSettings(null)).toEqual(
      DEFAULT_SELF_HEALING_SETTINGS
    );
    expect(normalizeSelfHealingSettings("not-an-object")).toEqual(
      DEFAULT_SELF_HEALING_SETTINGS
    );
    expect(normalizeSelfHealingSettings([])).toEqual(
      DEFAULT_SELF_HEALING_SETTINGS
    );
  });

  test("clamps windowSize to [5, 4000]", () => {
    expect(normalizeSelfHealingSettings({ windowSize: 1 }).windowSize).toBe(5);
    expect(normalizeSelfHealingSettings({ windowSize: 999999 }).windowSize).toBe(
      4000
    );
  });

  test("warnThreshold and criticalThreshold are floats in [1, 20]", () => {
    const a = normalizeSelfHealingSettings({
      warnThreshold: 3.5,
      criticalThreshold: 5.5,
    });
    expect(a.warnThreshold).toBeCloseTo(3.5, 10);
    expect(a.criticalThreshold).toBeCloseTo(5.5, 10);

    const b = normalizeSelfHealingSettings({
      warnThreshold: "0.5",
      criticalThreshold: 999,
    });
    expect(b.warnThreshold).toBeCloseTo(1.0, 10);
    expect(b.criticalThreshold).toBeCloseTo(20.0, 10);
  });

  test("enabled and playbookEnabled are boolean-only — no truthy coercion", () => {
    const a = normalizeSelfHealingSettings({
      enabled: 1,
      playbookEnabled: "yes",
    });
    expect(a.enabled).toBe(DEFAULT_SELF_HEALING_SETTINGS.enabled);
    expect(a.playbookEnabled).toBe(DEFAULT_SELF_HEALING_SETTINGS.playbookEnabled);

    const b = normalizeSelfHealingSettings({ enabled: false, playbookEnabled: false });
    expect(b.enabled).toBe(false);
    expect(b.playbookEnabled).toBe(false);
  });

  test("retentionSeconds floors to >= 60 seconds", () => {
    expect(
      normalizeSelfHealingSettings({ retentionSeconds: 10 }).retentionSeconds
    ).toBe(60);
    expect(
      normalizeSelfHealingSettings({ retentionSeconds: 999999999 }).retentionSeconds
    ).toBe(7 * 86_400);
  });
});

describe("selfHealingSettingsToJson", () => {
  test("round-trips through normalize", () => {
    const settings = normalizeSelfHealingSettings({
      enabled: true,
      windowSize: 120,
      warnThreshold: 3.0,
      criticalThreshold: 5.0,
      minSamplesForDetection: 20,
      retentionSeconds: 3_600,
      playbookEnabled: false,
      minSignalsPerDispatch: 2,
      interActionCooldownMs: 30_000,
    });
    const roundTripped = normalizeSelfHealingSettings(
      selfHealingSettingsToJson(settings)
    );
    expect(roundTripped).toEqual(settings);
  });
});
