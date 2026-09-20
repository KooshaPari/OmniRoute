"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_RUNTIME_POLL_MS,
  getTauriInvoke,
  isTauri,
  parseRuntimeStatus,
  toErrorMessage,
  type RuntimeStatus,
} from "./tauriBridge";

export { getTauriInvoke, isTauri, parseRuntimeStatus } from "./tauriBridge";
export type { RuntimeState, RuntimeStatus } from "./tauriBridge";

/**
 * React bindings over the Tauri desktop bridge (`./tauriBridge`).
 *
 * Every hook degrades to a no-op on the plain web build — `isDesktop` is false, no
 * timers or invokes are scheduled, and nothing throws. That keeps web behaviour
 * byte-identical when `window.__TAURI__` is absent.
 */

export type RuntimePending = "idle" | "start" | "stop";

export interface UseRuntimeResult {
  /** True only inside the Tauri webview. */
  isDesktop: boolean;
  /** Latest `runtime_readiness` payload, or null before the first successful read. */
  status: RuntimeStatus | null;
  /** Message from the last failed `invoke`, or a malformed-payload complaint. */
  error: string | null;
  /** Which transition is in flight, so the UI can disable both buttons. */
  pending: RuntimePending;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export interface UseDataDirResult {
  isDesktop: boolean;
  dataDir: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseWindowControlsResult {
  isDesktop: boolean;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
}

export interface UseOpenExternalResult {
  openExternal: (url: string) => Promise<void>;
}

const subscribeToNothing = () => () => {};
const getIsTauriClientSnapshot = () => isTauri();
const getIsTauriServerSnapshot = () => false;

/**
 * Reactive `isTauri()` for render gating.
 *
 * The injected global is created before any page script runs and never changes, so the
 * store has no subscription; `useSyncExternalStore` is used to keep the server render
 * (`false`) in sync with the hydrated one.
 */
export function useIsTauri(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    getIsTauriClientSnapshot,
    getIsTauriServerSnapshot
  );
}

/** Tracks mount state so async bridge calls never set state after unmount. */
function useMountedRef() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

/**
 * Runtime lifecycle: start / stop / readiness polling.
 *
 * Polling exists so the badge stays honest when the local server is started or stopped
 * outside the desktop app. Nothing is scheduled on the web build.
 *
 * @param pollIntervalMs pass 0 to read once on mount and never poll again.
 */
export function useRuntime(pollIntervalMs: number = DEFAULT_RUNTIME_POLL_MS): UseRuntimeResult {
  const isDesktop = useIsTauri();
  const mountedRef = useMountedRef();
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RuntimePending>("idle");

  const loadStatus = useCallback(async (): Promise<RuntimeStatus | null> => {
    const invoke = getTauriInvoke();
    if (!invoke) return null;
    return parseRuntimeStatus(await invoke("runtime_readiness"));
  }, []);

  const refresh = useCallback(async () => {
    if (!getTauriInvoke()) return;
    try {
      const next = await loadStatus();
      if (!mountedRef.current) return;
      if (next) {
        setStatus(next);
        setError(null);
      } else {
        setError("Unexpected runtime status payload");
      }
    } catch (cause) {
      if (mountedRef.current) setError(toErrorMessage(cause));
    }
  }, [loadStatus, mountedRef]);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    // Deferred so the first setState lands in a callback, not in the effect body.
    queueMicrotask(tick);
    const timer = pollIntervalMs > 0 ? setInterval(tick, pollIntervalMs) : undefined;
    return () => {
      cancelled = true;
      if (timer !== undefined) clearInterval(timer);
    };
  }, [isDesktop, pollIntervalMs, refresh]);

  const transition = useCallback(
    async (command: "runtime_start" | "runtime_stop", phase: RuntimePending) => {
      const invoke = getTauriInvoke();
      if (!invoke) return;
      setPending(phase);
      try {
        const next = parseRuntimeStatus(await invoke(command));
        if (!mountedRef.current) return;
        if (next) setStatus(next);
        setError(null);
      } catch (cause) {
        if (mountedRef.current) setError(toErrorMessage(cause));
        // The shell marks the runtime stopped when a start fails, so re-read the
        // settled value — but keep the transition error visible for the user.
        try {
          const settled = await loadStatus();
          if (mountedRef.current && settled) setStatus(settled);
        } catch {
          // The readiness probe failed too; the transition error above stands.
        }
      } finally {
        if (mountedRef.current) setPending("idle");
      }
    },
    [loadStatus, mountedRef]
  );

  const start = useCallback(() => transition("runtime_start", "start"), [transition]);
  const stop = useCallback(() => transition("runtime_stop", "stop"), [transition]);

  return { isDesktop, status, error, pending, refresh, start, stop };
}

/** Resolve the desktop application data directory (`runtime_data_dir`). */
export function useDataDir(): UseDataDirResult {
  const isDesktop = useIsTauri();
  const mountedRef = useMountedRef();
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const invoke = getTauriInvoke();
    if (!invoke) return;
    setLoading(true);
    try {
      const dir = await invoke("runtime_data_dir");
      if (!mountedRef.current) return;
      setDataDir(typeof dir === "string" && dir.length > 0 ? dir : null);
      setError(null);
    } catch (cause) {
      if (mountedRef.current) setError(toErrorMessage(cause));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [mountedRef]);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [isDesktop, refresh]);

  return { isDesktop, dataDir, loading, error, refresh };
}

/** Native window controls; no-ops on the web build. */
export function useWindowControls(): UseWindowControlsResult {
  const isDesktop = useIsTauri();

  const send = useCallback((command: string) => {
    const invoke = getTauriInvoke();
    if (!invoke) return;
    void invoke(command).catch((cause: unknown) => {
      console.error(`[tauri] ${command} failed:`, cause);
    });
  }, []);

  const minimize = useCallback(() => send("window_minimize"), [send]);
  const toggleMaximize = useCallback(() => send("window_toggle_maximize"), [send]);
  const close = useCallback(() => send("window_close"), [send]);

  return { isDesktop, minimize, toggleMaximize, close };
}

function openInBrowser(url: string): void {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Open a URL in the user's default browser.
 *
 * On the web build this is a plain `window.open`; inside Tauri it goes through the
 * `open_external` command (http/https only in the shell) and falls back to
 * `window.open` if that rejects.
 */
export function useOpenExternal(): UseOpenExternalResult {
  const openExternal = useCallback(async (url: string) => {
    const invoke = getTauriInvoke();
    if (!invoke) {
      openInBrowser(url);
      return;
    }
    try {
      await invoke("open_external", { url });
    } catch (cause) {
      console.error("[tauri] open_external failed, falling back to window.open:", cause);
      openInBrowser(url);
    }
  }, []);

  return { openExternal };
}
