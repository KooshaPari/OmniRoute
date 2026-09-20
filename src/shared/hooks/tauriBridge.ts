/**
 * Low-level Tauri 2 bridge: global detection, command invocation and payload
 * parsing. No React here — the hook bindings live in `./useTauri`.
 *
 * The desktop shell (`apps/desktop/src-tauri`) builds with `withGlobalTauri: true`,
 * so Tauri injects `window.__TAURI__` and `window.__TAURI__.core.invoke` into the
 * webview. There is deliberately no `@tauri-apps/api` dependency: the injected global
 * is the only entry point this SPA uses.
 *
 * Web build contract: with no `window.__TAURI__` (plain `next start`, Docker, the E2E
 * harness) every function here returns null / false and never throws.
 *
 * Wire contract, implemented in `apps/desktop/src-tauri/src/commands.rs`:
 *   runtime_start / runtime_stop / runtime_readiness -> RuntimeStatus
 *   runtime_data_dir   -> string
 *   dashboard_origin   -> string
 *   window_minimize / window_toggle_maximize / window_close -> void
 *   open_external({ url }) -> void
 */

/**
 * Runtime states emitted by `RuntimeState` in `src-tauri/src/lifecycle.rs`.
 *
 * The Rust enum is `#[serde(rename_all = "snake_case")]` over exactly
 * `Stopped | Starting | Running` — there is no wire-level "error" variant, so a
 * failure arrives either as a rejected `invoke` or as `detail` on a stopped status.
 */
export type RuntimeState = "stopped" | "starting" | "running";

/** Normalized `RuntimeStatus`; `port` is derived from `origin` when absent. */
export interface RuntimeStatus {
  state: RuntimeState;
  origin: string;
  port: number | null;
  /**
   * `RuntimeStatus.detail` from the shell: the spawn error, or how a supervised
   * child exited. Null when there is nothing to report.
   */
  detail: string | null;
}

interface TauriCore {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

interface TauriGlobal {
  core?: Partial<TauriCore>;
}

type WindowWithTauri = Window & { __TAURI__?: TauriGlobal };

/** Default readiness poll interval for `useRuntime`. */
export const DEFAULT_RUNTIME_POLL_MS = 5000;

function readTauriCore(): TauriCore | null {
  if (typeof window === "undefined") return null;
  const global = (window as WindowWithTauri).__TAURI__;
  const core = global?.core;
  return core && typeof core.invoke === "function" ? (core as TauriCore) : null;
}

/**
 * SSR-safe detection of a usable Tauri bridge.
 *
 * Gated on `core.invoke`, not merely on the `__TAURI__` object: the SPA must not
 * render desktop controls that would then be inert, and must not crash if the global
 * appears without the invoke surface.
 */
export function isTauri(): boolean {
  return readTauriCore() !== null;
}

/** The raw bridge invoke, or null on the plain web build. */
export function getTauriInvoke(): TauriCore["invoke"] | null {
  return readTauriCore()?.invoke ?? null;
}

/** Normalize any thrown value from the bridge into a displayable message. */
export function toErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string" && cause.length > 0) return cause;
  return "Unknown desktop bridge error";
}

const RUNTIME_STATES: readonly string[] = ["stopped", "starting", "running"];

function portFromOrigin(origin: string): number | null {
  if (!origin) return null;
  try {
    const port = Number.parseInt(new URL(origin).port, 10);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

/**
 * Normalize a `RuntimeStatus` payload; null when the shape is unrecognized.
 *
 * The shell serializes `{ state, origin, port, pid, supervised, detail }` and only ever
 * gained fields (see `src-tauri/src/lifecycle.rs`), so unknown keys are ignored and the
 * port falls back to the one in `origin`.
 *
 * Exported for tests — the SPA must degrade instead of trusting the webview.
 */
export function parseRuntimeStatus(value: unknown): RuntimeStatus | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.state !== "string" || !RUNTIME_STATES.includes(record.state)) return null;
  const origin = typeof record.origin === "string" ? record.origin : "";
  const port =
    typeof record.port === "number" && Number.isInteger(record.port) && record.port > 0
      ? record.port
      : portFromOrigin(origin);
  const detail =
    typeof record.detail === "string" && record.detail.length > 0 ? record.detail : null;
  return { state: record.state as RuntimeState, origin, port, detail };
}
