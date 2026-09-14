const DEFAULT_SWEEP_INTERVAL_MS = 300_000;
const INCONCLUSIVE_RECHECK_MIN_MS = 30 * 60_000;
const INCONCLUSIVE_RECHECK_MULTIPLIER = 6;
const INCONCLUSIVE_WARNING_MARKER = "credential validity is inconclusive";

export function isCredentialProbeInconclusive(result: {
  valid?: boolean;
  warning?: unknown;
}): boolean {
  return (
    result.valid === true &&
    typeof result.warning === "string" &&
    result.warning.toLowerCase().includes(INCONCLUSIVE_WARNING_MARKER)
  );
}

export function resolveInconclusiveProbeRecheckDelayMs(sweepIntervalMs: number): number {
  const interval =
    Number.isFinite(sweepIntervalMs) && sweepIntervalMs > 0
      ? sweepIntervalMs
      : DEFAULT_SWEEP_INTERVAL_MS;
  return Math.max(INCONCLUSIVE_RECHECK_MIN_MS, interval * INCONCLUSIVE_RECHECK_MULTIPLIER);
}
