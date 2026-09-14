"use strict";

/**
 * HTTP client-abort crash guard (#fix-dev-server-aborted).
 *
 * Node's http.Server turns an 'error' event on an IncomingMessage/ServerResponse
 * into an uncaughtException (and therefore a process exit) WHENEVER the emitter
 * has no listener. The single most common such error is a *client* abort: the
 * browser closes the TCP socket (navigation, Back/Forward cache, HMR reconnect,
 * cancelling a fetch) while the server is still streaming the response. Node
 * emits `Error: aborted` / `ERR_STREAM_PREMATURE_CLOSE` / `ECONNRESET` on the
 * request stream, and absent a handler it kills the whole server process.
 *
 * That surfaced as "login succeeds, then the dashboard hangs with a wall of
 * `net::ERR_CONNECTION_REFUSED`": after auth the SPA opens many polling
 * connections + a live WebSocket; stray client-side socket closes during
 * navigation/HMR were taking the dev server down.
 *
 * Two layers:
 *   1. `attachRequestStreamGuards(req, res)` — per-request listeners that absorb
 *      client-abort errors so they never bubble to the process level. Call it
 *      inside every `http.createServer((req, res) => …)` request listener.
 *   2. `installProcessCrashGuard()` — a last-resort safety net on
 *      `process.on('uncaughtException' | 'unhandledRejection')` that swallows
 *      the same benign client-abort errors but otherwise preserves the existing
 *      crash semantics (so genuine bugs still surface). Idempotent.
 *
 * Kept as a `.mjs` module (no build step) so it is importable both from the
 * Node-only dev server (`scripts/dev/run-next.mjs`) and from the TypeScript
 * servers under `src/` (tsconfig `allowJs: true`).
 *
 * @module
 */

/**
 * @param {unknown} err
 * @returns {boolean} true when `err` represents a client closing the
 *   connection rather than a server-side fault.
 */
export function isClientAbortError(err) {
  if (!err || typeof err !== "object") return false;
  const e = /** @type {NodeJS.ErrnoException} */ (err);
  // Node emits `Error: aborted` (no code) from http.Server#abortIncoming.
  if (e.message === "aborted" || e.message === "Aborted") return true;
  // OmniRoute's SSE teardown aborts in-flight legs with
  // `Error [AbortError]: request_signal_aborted` on client disconnects
  // (open-sse/utils/streamHandler.ts), and fetch/DOM cancellation surfaces as
  // `AbortError` with an abort-flavoured message. Same benign class as
  // `Error: aborted` — an emitter-left 'error' event on any of these used to
  // kill the process (#fix-dev-server-aborted).
  if (e.name === "AbortError" && /abort/i.test(String(e.message))) return true;
  switch (e.code) {
    case "ERR_STREAM_PREMATURE_CLOSE":
    case "ECONNRESET":
    case "EPIPE":
    case "ECONNABORTED":
    case "ETIMEDOUT":
    case "ENOTCONN":
    case "ECANCELED":
      return true;
    default:
      return false;
  }
}

/**
 * Decide whether a process-level uncaughtException/unhandledRejection should be
 * swallowed (benign client-abort) or allowed to surface (genuine bug).
 *
 * Pure + exported so it can be unit-tested without poking process listeners.
 *
 * @param {unknown} err
 * @param {string | undefined} origin  Node's uncaughtException origin (e.g.
 *   "uncaughtException" / "unhandledRejection"); absent/empty for rejections.
 * @returns {boolean} true => swallow (log only), false => re-throw / let crash.
 */
export function shouldSwallowUncaught(err, origin) {
  if (!isClientAbortError(err)) return false;
  // Only swallow when the origin matches what the guard installed for. If some
  // other subsystem raised it (e.g. a deliberate `throw` in a domain), keep the
  // existing crash semantics.
  return !origin || origin === "uncaughtException" || origin === "unhandledRejection";
}

/**
 * Attach `error` listeners to a request/response pair that swallow client-abort
 * errors. Idempotent per (req, res) pair via a Symbol flag.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export function attachRequestStreamGuards(req, res) {
  const flag = Symbol.for("omniroute.requestAbortGuard");
  if (req[flag] || res[flag]) return;
  req[flag] = true;
  res[flag] = true;

  req.on("error", (err) => {
    if (!isClientAbortError(err)) {
      // Re-emit a genuine request error through the normal channel so it is
      // still observable in logs, but never as an uncaughtException.
      console.error("[server] request stream error:", err);
    }
  });

  res.on("error", (err) => {
    if (!isClientAbortError(err)) {
      console.error("[server] response stream error:", err);
    }
  });
}

let crashGuardInstalled = false;

/**
 * Install process-level safety nets. Idempotent. Benign client-abort errors are
 * logged once and swallowed; everything else is re-thrown on a fresh stack so
 * the process keeps its current crash semantics (genuine bugs still crash/hang
 * loudly, and a supervisor or test harness sees them).
 *
 * @param {(level: "warn" | "error", ...args: unknown[]) => void} [log]
 */
export function installProcessCrashGuard(log) {
  if (crashGuardInstalled) return;
  crashGuardInstalled = true;

  // `console` is an object, not a callable: `log ?? console` followed by
  // `logger("warn", ...)` throws TypeError and kills the process on the very
  // abort the guard exists to swallow. Default to console.warn as a function.
  const logger = typeof log === "function" ? log : console.warn.bind(console);

  process.on("uncaughtException", (err, origin) => {
    if (shouldSwallowUncaught(err, origin)) {
      logger("warn", "[server] swallowed client-abort uncaughtException:", err?.message ?? err);
      return;
    }
    throw err;
  });

  process.on("unhandledRejection", (reason) => {
    if (shouldSwallowUncaught(reason, "unhandledRejection")) {
      logger(
        "warn",
        "[server] swallowed client-abort unhandledRejection:",
        reason?.message ?? reason
      );
      return;
    }
    throw reason;
  });
}
