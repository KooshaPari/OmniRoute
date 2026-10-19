/**
 * Cursor Agent CLI version constant — dependency-free.
 *
 * Wire header: `x-cursor-client-version: cli-${id}` where `id` is a dated
 * build like `2026.07.08-0c04a8a` (not the IDE `3.x` semver).
 *
 * This module is deliberately separate from ./cursorAgentCliVersion.ts.
 * That file resolves the version from disk and therefore imports `node:fs`,
 * `node:os` and `node:path` at module top level. Consumers that need ONLY the
 * string (e.g. src/lib/oauth/constants/oauth.ts, which is reachable from the
 * login page's client bundle) must not pull those node builtins into the
 * browser build — doing so made webpack fail with
 * `UnhandledSchemeError: Reading from "node:fs" is not handled by plugins`
 * and returned HTTP 500 for every page route.
 */

/**
 * Pinned Agent CLI build id used when no local install is found (typical
 * headless OmniRoute). Bump when refreshing Cursor CLI impersonation.
 */
export const CURSOR_AGENT_CLI_VERSION = "2026.07.08-0c04a8a";
