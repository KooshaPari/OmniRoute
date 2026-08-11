/**
 * Graceful Shutdown — E-2 Critical Fix
 *
 * Handles SIGTERM / SIGINT to drain in-flight requests before exit.
 * Critical for Docker containers and Kubernetes pods where hard kills
 * can drop active SSE streams.
 *
 * Usage:
 *   import { initGracefulShutdown } from "@/lib/gracefulShutdown";
 *   initGracefulShutdown();
 *
 * @module lib/gracefulShutdown
 */

import { markServerStopping } from "@/lib/serverLifecycle";

/** Grace period before forced exit (default 30s, configurable) */
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || "30000", 10);

declare global {
  var __omnirouteShutdown:
    { init: boolean; shuttingDown: boolean; activeRequests: number } | undefined;
}

function getShutdownState() {
  if (!globalThis.__omnirouteShutdown) {
    globalThis.__omnirouteShutdown = { init: false, shuttingDown: false, activeRequests: 0 };
  }
  return globalThis.__omnirouteShutdown;
}

/**
 * Check if the server is currently shutting down.
 * Route handlers can use this to reject new requests.
 */
export function isDraining(): boolean {
  return getShutdownState().shuttingDown;
}

/**
 * Track a new in-flight request. Call `done()` when it completes.
 * Returns a done callback.
 */
export function trackRequest(): () => void {
  const state = getShutdownState();
  state.activeRequests++;
  let called = false;
  return () => {
    if (!called) {
      called = true;
      state.activeRequests--;
    }
  };
}

/**
 * Get current active request count (for monitoring/health endpoints).
 */
export function getActiveRequestCount(): number {
  return getShutdownState().activeRequests;
}

/**
 * Wait for all in-flight requests to complete, with timeout.
 */
async function waitForDrain(): Promise<void> {
  const state = getShutdownState();
  const start = Date.now();
  const CHECK_INTERVAL_MS = 250;

  return new Promise((resolve) => {
    const check = () => {
      if (state.activeRequests <= 0) {
        log.info("shutdown: all in-flight requests drained");
        resolve();
        return;
      }

      if (Date.now() - start > SHUTDOWN_TIMEOUT_MS) {
        log.warn(
          { timeoutMs: SHUTDOWN_TIMEOUT_MS, activeRequests: state.activeRequests },
          "shutdown: timeout reached — forcing exit"
        );
        resolve();
        return;
      }

      log.info(
        { activeRequests: state.activeRequests },
        "shutdown: waiting for in-flight requests"
      );
      setTimeout(check, CHECK_INTERVAL_MS);
    };

    check();
  });
}

/**
 * Perform cleanup: close DB connections, flush logs.
 */
async function cleanup(): Promise<void> {
  try {
    const [{ closeAuditDb }, { closeDbInstance }, { flushSpendBatchWriter }, { closeLogRotation }] =
      await Promise.all([
        import("@omniroute/open-sse/mcp-server/audit.ts"),
        import("@/lib/db/core"),
        import("@/lib/spend/batchWriter"),
        import("@/lib/logRotation"),
      ]);
    const flushResult = await flushSpendBatchWriter();
    if (flushResult.flushedEntries > 0) {
      log.info(
        { flushedEntries: flushResult.flushedEntries },
        "shutdown: spend batch writer flushed"
      );
    }
    if (closeAuditDb()) {
      log.info("shutdown: MCP audit database checkpointed and closed");
    }
    if (closeDbInstance()) {
      log.info("shutdown: SQLite database checkpointed and closed");
    }
    closeLogRotation();
    console.log("[Shutdown] Log rotation timer stopped.");

    // Tear down any persistent VNC login browser containers so they don't leak
    // past the server process. Best-effort; no-op if the feature was never used
    // or the docker CLI is unavailable.
    try {
      const { stopAllSessions, listSessions } = await import("@/lib/vncSession/service");
      if (listSessions().length > 0) {
        await stopAllSessions();
        console.log("[Shutdown] VNC login sessions stopped.");
      }
    } catch {
      /* feature unused / docker missing */
    }
  } catch (err) {
    log.error({ err: (err as Error).message }, "shutdown: cleanup error");
  }
}

/**
 * Initialize graceful shutdown handlers.
 * Should be called once during server startup.
 */
export function initGracefulShutdown(): void {
  const state = getShutdownState();
  if (state.init) return;
  state.init = true;

  const shutdown = async (signal: string) => {
    if (state.shuttingDown) return;
    state.shuttingDown = true;
    markServerStopping();

    log.info(
      { signal, activeRequests: state.activeRequests },
      "shutdown: received signal, draining"
    );

    await waitForDrain();
    await cleanup();

    log.info("shutdown: complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  // #8045: on Windows, closing the console window delivers CTRL_CLOSE_EVENT, which
  // Node/libuv maps to a JS-visible "SIGHUP" event — without this listener, closing
  // the window never runs cleanup() (WAL checkpoint + closeDbInstance()), leaving
  // storage.sqlite's WAL un-checkpointed for the next launch.
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  log.info("shutdown: graceful shutdown handlers registered");
}
