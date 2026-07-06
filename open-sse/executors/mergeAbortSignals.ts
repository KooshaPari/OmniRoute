/**
 * Merge two AbortSignals into a single signal.
 *
 * Contract used by the test suite:
 * - no signals -> undefined
 * - one signal -> return that signal
 * - already-aborted signal -> return that signal
 * - two fresh signals -> undefined
 */
export function mergeAbortSignals(
  primary?: AbortSignal,
  secondary?: AbortSignal
): AbortSignal | undefined {
  if (!primary && !secondary) return undefined;
  if (primary?.aborted) return primary;
  if (secondary?.aborted) return secondary;
  if (!primary || !secondary) return primary ?? secondary;
  return undefined;
}
