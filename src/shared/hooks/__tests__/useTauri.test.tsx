// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTauriInvoke,
  isTauri,
  parseRuntimeStatus,
  useDataDir,
  useOpenExternal,
  useRuntime,
  useWindowControls,
} from "../useTauri";

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const cleanupCallbacks: Array<() => void> = [];

/** Stub the global Tauri injects into the webview (`withGlobalTauri: true`). */
function stubTauriBridge(impl: Invoke) {
  const invoke = vi.fn(impl);
  vi.stubGlobal("__TAURI__", { core: { invoke } });
  return invoke;
}

/** Mount a hook and expose a live reader for its latest return value. */
function renderHook<T>(useHook: () => T) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  cleanupCallbacks.push(() => container.remove());
  const root = createRoot(container);
  const box: { current: T | null } = { current: null };

  function Probe() {
    box.current = useHook();
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });

  return {
    read: (): T => {
      if (box.current === null) throw new Error("hook did not render");
      return box.current;
    },
    rerender: () => {
      act(() => {
        root.render(<Probe />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  while (cleanupCallbacks.length > 0) cleanupCallbacks.pop()?.();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tauri bridge detection", () => {
  it("reports no bridge on the plain web build", () => {
    expect(isTauri()).toBe(false);
    expect(getTauriInvoke()).toBeNull();
  });

  it("requires the invoke surface, not just the global object", () => {
    vi.stubGlobal("__TAURI__", { core: {} });
    expect(isTauri()).toBe(false);
    expect(getTauriInvoke()).toBeNull();
  });

  it("detects a usable bridge", () => {
    stubTauriBridge(async () => "ok");
    expect(isTauri()).toBe(true);
    expect(typeof getTauriInvoke()).toBe("function");
  });
});

describe("parseRuntimeStatus", () => {
  it("accepts the Rust payload and derives the port from the origin", () => {
    // lifecycle.rs serializes { state, origin, port, pid, supervised, detail }; the
    // shape only ever gains fields, so an older { state, origin } payload still parses.
    expect(parseRuntimeStatus({ state: "running", origin: "http://localhost:20128" })).toEqual({
      state: "running",
      origin: "http://localhost:20128",
      port: 20128,
      detail: null,
    });
    expect(
      parseRuntimeStatus({
        state: "running",
        origin: "http://localhost:20128",
        port: 20128,
        pid: 4242,
        supervised: true,
        detail: null,
      })
    ).toEqual({
      state: "running",
      origin: "http://localhost:20128",
      port: 20128,
      detail: null,
    });
  });

  it("keeps the shell detail note and drops an empty one", () => {
    expect(
      parseRuntimeStatus({
        state: "stopped",
        origin: "http://localhost:20128",
        detail: "child exited with status 1",
      })
    ).toEqual({
      state: "stopped",
      origin: "http://localhost:20128",
      port: 20128,
      detail: "child exited with status 1",
    });
    expect(
      parseRuntimeStatus({ state: "stopped", origin: "http://localhost:20128", detail: "" })?.detail
    ).toBeNull();
  });

  it("keeps an explicit port when the payload carries one", () => {
    expect(
      parseRuntimeStatus({ state: "stopped", origin: "http://127.0.0.1:8080", port: 9000 })
    ).toEqual({ state: "stopped", origin: "http://127.0.0.1:8080", port: 9000, detail: null });
  });

  it("tolerates a missing origin and rejects unknown states", () => {
    expect(parseRuntimeStatus({ state: "stopped" })).toEqual({
      state: "stopped",
      origin: "",
      port: null,
      detail: null,
    });
    // RuntimeState has no wire-level "error" variant; a failure is a rejected invoke.
    expect(parseRuntimeStatus({ state: "error", origin: "http://localhost:20128" })).toBeNull();
  });

  it("rejects malformed payloads", () => {
    expect(parseRuntimeStatus(null)).toBeNull();
    expect(parseRuntimeStatus("running")).toBeNull();
    expect(parseRuntimeStatus({})).toBeNull();
  });
});

describe("web build no-op safety", () => {
  it("useRuntime never throws and stays idle without the bridge", async () => {
    const hook = renderHook(() => useRuntime(0));
    expect(hook.read().isDesktop).toBe(false);
    expect(hook.read().status).toBeNull();

    await act(async () => {
      await hook.read().refresh();
      await hook.read().start();
      await hook.read().stop();
    });

    expect(hook.read().status).toBeNull();
    expect(hook.read().error).toBeNull();
    expect(hook.read().pending).toBe("idle");
  });

  it("useDataDir resolves nothing without the bridge", async () => {
    const hook = renderHook(() => useDataDir());
    await act(async () => {
      await hook.read().refresh();
    });
    expect(hook.read().isDesktop).toBe(false);
    expect(hook.read().dataDir).toBeNull();
    expect(hook.read().error).toBeNull();
  });

  it("useWindowControls is inert without the bridge", () => {
    const hook = renderHook(() => useWindowControls());
    expect(() => {
      hook.read().minimize();
      hook.read().toggleMaximize();
      hook.read().close();
    }).not.toThrow();
    expect(hook.read().isDesktop).toBe(false);
  });

  it("useOpenExternal falls back to window.open with noopener", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const hook = renderHook(() => useOpenExternal());

    await act(async () => {
      await hook.read().openExternal("https://example.com/docs");
    });

    expect(open).toHaveBeenCalledWith("https://example.com/docs", "_blank", "noopener,noreferrer");
  });
});

describe("tauri bridge behaviour", () => {
  it("useRuntime reads readiness on mount and drives start/stop", async () => {
    const invoke = stubTauriBridge(async (command) => {
      if (command === "runtime_start")
        return { state: "running", origin: "http://localhost:20128" };
      if (command === "runtime_stop") return { state: "stopped", origin: "http://localhost:20128" };
      return { state: "starting", origin: "http://localhost:20128" };
    });

    const hook = renderHook(() => useRuntime(0));
    expect(hook.read().isDesktop).toBe(true);

    await act(async () => {});
    expect(hook.read().status?.state).toBe("starting");
    expect(invoke).toHaveBeenCalledWith("runtime_readiness");

    await act(async () => {
      await hook.read().start();
    });
    expect(hook.read().status?.state).toBe("running");
    expect(hook.read().pending).toBe("idle");

    await act(async () => {
      await hook.read().stop();
    });
    expect(hook.read().status?.state).toBe("stopped");
  });

  it("useRuntime surfaces a rejected invoke and re-reads the settled state", async () => {
    const invoke = stubTauriBridge(async (command) => {
      if (command === "runtime_start") throw "connection refused";
      return { state: "stopped", origin: "http://localhost:20128" };
    });

    const hook = renderHook(() => useRuntime(0));
    await act(async () => {});
    await act(async () => {
      await hook.read().start();
    });

    expect(hook.read().error).toBe("connection refused");
    expect(hook.read().status?.state).toBe("stopped");
    expect(invoke).toHaveBeenCalledWith("runtime_readiness");
  });

  it("useDataDir resolves the desktop data directory", async () => {
    stubTauriBridge(async () => "/Users/example/Library/Application Support/omniroute");
    const hook = renderHook(() => useDataDir());

    await act(async () => {});
    expect(hook.read().dataDir).toBe("/Users/example/Library/Application Support/omniroute");
    expect(hook.read().loading).toBe(false);
    expect(hook.read().error).toBeNull();
  });

  it("useDataDir records a failure without throwing", async () => {
    stubTauriBridge(async () => {
      throw "application data directory unavailable";
    });
    const hook = renderHook(() => useDataDir());

    await act(async () => {});
    expect(hook.read().dataDir).toBeNull();
    expect(hook.read().error).toBe("application data directory unavailable");
  });

  it("useWindowControls invokes the native window commands", () => {
    const invoke = stubTauriBridge(async () => undefined);
    const hook = renderHook(() => useWindowControls());

    hook.read().minimize();
    hook.read().toggleMaximize();
    hook.read().close();

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      "window_minimize",
      "window_toggle_maximize",
      "window_close",
    ]);
    expect(hook.read().isDesktop).toBe(true);
  });

  it("useOpenExternal prefers the bridge and falls back when it rejects", async () => {
    const invoke = stubTauriBridge(async () => undefined);
    const hook = renderHook(() => useOpenExternal());

    await act(async () => {
      await hook.read().openExternal("https://example.com/a");
    });
    expect(invoke).toHaveBeenCalledWith("open_external", { url: "https://example.com/a" });

    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal("__TAURI__", {
      core: {
        invoke: vi.fn(async () => {
          throw "opener denied";
        }),
      },
    });
    const failing = renderHook(() => useOpenExternal());
    await act(async () => {
      await failing.read().openExternal("https://example.com/b");
    });
    expect(open).toHaveBeenCalledWith("https://example.com/b", "_blank", "noopener,noreferrer");
  });
});
