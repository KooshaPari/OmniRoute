/**
 * Policy for whether a combo fallback should persist connection unavailability.
 *
 * Combo-managed transient 429s stay in-memory for Antigravity because that path
 * has dedicated quota handling. Other providers should persist the cooldown so
 * the same connection is skipped on later requests, not just within the current
 * combo attempt.
 */
export function shouldPersistUnavailableStateForComboFailure(options: {
  isCombo?: boolean;
  provider?: string | null;
  status: number;
  failureKind?: string | null;
}): boolean {
  const isAntigravityComboTransient429 =
    options.isCombo === true &&
    options.provider === "antigravity" &&
    options.status === 429 &&
    (options.failureKind === "rate_limit" || options.failureKind === "transient");

  return !isAntigravityComboTransient429;
}
