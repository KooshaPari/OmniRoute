const MS_PER_SECOND = 1000;

type FusionTuning = Record<string, number | undefined>;
type ComboRuntimeConfig = Record<string, unknown> & { fusionTuning?: FusionTuning };

export function msToOptionalSecondsInput(value: unknown): string {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  return String(Math.round(ms / MS_PER_SECOND));
}

export function secondsInputToOptionalMs(value: unknown, maxSeconds = 86400): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.min(maxSeconds, Math.round(seconds)) * MS_PER_SECOND;
}

/** Return a config with only finite Fusion tuning values. */
export function updateFusionTuning(
  config: ComboRuntimeConfig,
  field: string,
  rawValue: unknown
): ComboRuntimeConfig {
  const value = rawValue === "" ? undefined : Number(rawValue);
  const next = { ...config.fusionTuning, [field]: value };
  const pruned = Object.fromEntries(
    Object.entries(next).filter(([, entry]) => Number.isFinite(entry))
  );
  return { ...config, fusionTuning: Object.keys(pruned).length > 0 ? pruned : undefined };
}
