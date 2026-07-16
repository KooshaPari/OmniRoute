/**
 * hasActiveClaudeThinking — leaf predicate for "is the model currently thinking?".
 *
 * Extracted from `open-sse/executors/base.ts` (PR-015) so the check can be
 * imported, unit-tested, and reused without pulling in the 1.4k-line base
 * executor. The function is intentionally tiny and side-effect free.
 *
 * Semantics
 * ---------
 * Returns `true` when the request body carries a Claude-shape `thinking`
 * block whose `type` is one of the values that mean "the model is currently
 * doing extended thinking right now":
 *
 *   - `"enabled"`  — classic manual extended thinking (Opus 4.6, Sonnet 4.6,
 *                    etc. — the historical default).
 *   - `"adaptive"` — adaptive thinking (Opus 4.7+, Fable 5+; replaces manual
 *                    mode after Anthropic's 2026-05-19 migration).
 *
 * Any other `type` (notably `"disabled"`) means the model is NOT thinking,
 * and the function returns `false`. Missing or non-object `thinking` blocks
 * also yield `false`.
 *
 * Scope
 * -----
 * This leaf does NOT read `getThinkingBudgetConfig()`. The budget module
 * (open-sse/services/thinkingBudget.ts) operates one level up the pipeline,
 * transforming the request body before it reaches the dispatch point that
 * calls this predicate. By the time `hasActiveClaudeThinking` is invoked,
 * the body has already been normalized, so the leaf only needs to inspect
 * the final `thinking.type` value.
 *
 * @param body - Request body (Claude-shape). Typed as `Record<string, unknown>`
 *               so the leaf is safe to call from any executor without
 *               importing the heavier executor types.
 * @returns `true` when Claude extended thinking is active for this request.
 */
export function hasActiveClaudeThinking(body: Record<string, unknown>): boolean {
  const thinking = body.thinking as Record<string, unknown> | undefined;
  return thinking?.type === "enabled" || thinking?.type === "adaptive";
}
