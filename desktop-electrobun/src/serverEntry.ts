import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve the Next standalone entrypoint for the desktop shell.
 *
 * The peer-stamp wrapper is required for local-only API routes. Older build
 * artifacts do not contain it, so retain the plain Next entrypoint fallback.
 */
export function resolveServerEntry(
  standaloneDir: string,
  fileExists: (path: string) => boolean = existsSync
): string {
  return fileExists(join(standaloneDir, "server-ws.mjs")) ? "server-ws.mjs" : "server.js";
}
