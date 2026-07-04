/**
 * Strip the OmniRoute provider prefix from versioned built-in tool model
 * fields (e.g. `cc/claude-opus-4-8` → `claude-opus-4-8`).
 *
 * Anthropic's `tools[]` entries with a *versioned* built-in `type` (e.g.
 * `advisor_20260301`, `bash_20250124`) carry a `model` field on the tool
 * itself. The real Claude CLI always sends a bare model id there (e.g.
 * `claude-opus-4-8`) — never a `<provider>/<model>` prefixed one. When a
 * request enters OmniRoute with an OmniRoute-style provider prefix still
 * attached, the upstream Anthropic API rejects the request. This helper
 * surgically removes the prefix on those specific tool entries.
 *
 * Behavior:
 *   - Non-array input is silently ignored.
 *   - Each entry is checked: only when `type` matches
 *     `^[a-z][a-z0-9_]*_\d{8}$` (lowercase name, optional digits/underscores,
 *     underscore, 8 digits) AND `model` is a string containing `/`, is the
 *     prefix stripped.
 *   - The match is greedy on the *last* `/`: `t.model.split("/").pop()`,
 *     so `cc/claude-opus-4-8` → `claude-opus-4-8`,
 *     `a/b/claude-opus-4-8` → `claude-opus-4-8`.
 *   - Entries whose `type` is not a versioned built-in tool are left
 *     untouched (e.g. `web_search_20250305` is matched; `web_search` is not).
 *   - Mutates the input array in place; returns nothing.
 *
 * @param tools - The `tools` array from an Anthropic request body, treated
 *                as `unknown` to keep this helper a no-op for unrelated
 *                call sites that pass non-tool values.
 */
export function stripVersionedToolModelPrefix(tools: unknown): void {
  if (!Array.isArray(tools)) return;
  for (const t of tools as Array<Record<string, unknown>>) {
    if (
      typeof t.type === "string" &&
      /^[a-z][a-z0-9_]*_\d{8}$/.test(t.type) &&
      typeof t.model === "string" &&
      t.model.includes("/")
    ) {
      t.model = t.model.split("/").pop();
    }
  }
}
