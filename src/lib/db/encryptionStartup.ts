/**
 * Startup-canary entry point for field-level encryption.
 *
 * Wraps `validateEncryptionAtStartup()` (in `./encryption.ts`) in a thin
 * async seam so non-Node entry points (CLI scripts, worker processes,
 * Next.js `instrumentation.ts`) can call it uniformly.
 *
 * Behaviour mirrors §4.3 / §6.7 of `plans/encryption-failclosed-spec.md`:
 *   - No `STORAGE_ENCRYPTION_KEY` set: warn and continue (State A).
 *   - Key set and canary fails: log fatal and `process.exit(1)`.
 *   - Key set and canary passes: log info and continue.
 *
 * The `process.exit(1)` lives here (not in `validateEncryptionAtStartup`)
 * so unit tests can call the canary directly and assert on the throw
 * without the test runner being killed.
 */

import {
  StartupEncryptionError,
  validateEncryptionAtStartup,
} from "./encryption";

/**
 * Run the startup encryption canary. If the canary throws and the failure
 * is `StartupEncryptionError`, log a final fatal line and `process.exit(1)`.
 *
 * Non-Node runtimes (Edge) should not call this; the entry point in
 * `src/instrumentation.ts` already gates on `NEXT_RUNTIME === "nodejs"`.
 */
export function runEncryptionStartupCheck(): void {
  try {
    validateEncryptionAtStartup();
  } catch (err: unknown) {
    if (err instanceof StartupEncryptionError) {
      // Re-log the fatal so the line is unambiguous in the log stream
      // even if the canary's own log was buffered/redirected.
      // eslint-disable-next-line no-console
      console.error(
        `[Encryption] FATAL — startup canary failed: ${err.message}. ` +
          `Refusing to start. Regenerate STORAGE_ENCRYPTION_KEY with: ` +
          `openssl rand -base64 32`
      );
      if (typeof process !== "undefined" && typeof process.exit === "function") {
        process.exit(1);
      }
      return;
    }
    throw err;
  }
}

/**
 * Async wrapper for callers that prefer `await`. Throws `StartupEncryptionError`
 * on failure rather than calling `process.exit` — useful for test contexts
 * and for callers that want to handle the failure themselves.
 */
export async function runEncryptionStartupCanary(): Promise<void> {
  validateEncryptionAtStartup();
}

export { StartupEncryptionError, validateEncryptionAtStartup };
