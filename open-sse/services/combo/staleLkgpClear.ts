/**
 * Clear persisted LKGP pins when a combo target fails or is skipped for exhaustion,
 * cooldown or unavailability (#11911 #919).
 *
 * Non-blocking by design: the fallback loop never waits on these SQLite writes. A
 * failed clear is not silent — it logs a warning carrying the combo and the
 * execution key. The returned promise never rejects: routing callers ignore it,
 * tests await it.
 *
 * @internal — re-exported by combo.ts as `clearStaleLKGP`.
 */

type WarnLogger = { warn?: (tag: string, msg: string, data?: unknown) => void } | null;
type ClearLkgp = (comboName: string, modelKey: string) => Promise<void>;

async function clearPins(
  comboName: string,
  executionKey: string | null | undefined,
  comboId: string | null | undefined,
  clearLKGP: ClearLkgp | undefined
): Promise<void> {
  const clear = clearLKGP ?? (await import("@/lib/db/settings")).clearLKGP;
  const keys = [comboId || comboName, ...(executionKey ? [executionKey] : [])];
  await Promise.all(keys.map((key) => clear(comboName, key)));
}

export function clearStaleLKGP(
  comboName: string,
  executionKey?: string | null,
  comboId?: string | null,
  log?: WarnLogger,
  tag: string = "COMBO",
  /** Test seam; the routing path always resolves clearLKGP from @/lib/db/settings. */
  clearLKGP?: ClearLkgp
): Promise<void> {
  return clearPins(comboName, executionKey, comboId, clearLKGP).catch((err: unknown) => {
    log?.warn?.(tag, "Failed to clear Last Known Good Provider. This is non-fatal.", {
      combo: comboName,
      comboId: comboId ?? null,
      executionKey: executionKey ?? null,
      err,
    });
  });
}
