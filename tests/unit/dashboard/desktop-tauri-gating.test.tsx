// @vitest-environment jsdom
//
// Desktop-integration gating guard for the Tauri shell.
//
// The SPA is served two ways: as the plain web build (no `window.__TAURI__`) and from
// the Tauri webview (`withGlobalTauri: true`). Every desktop surface must render
// NOTHING on the web build — that is the "no behaviour change on web" contract — and
// must wire the real bridge commands when the global is present.
//
// Assertions use the raw i18n keys: `next-intl` is mocked to return the key, so the
// translated strings themselves are covered by `npm run i18n:check-ui-coverage`.
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  // Keys only, plus any interpolation values, so the test can prove a value reached
  // the translator (e.g. the shell's `detail` note). The translated text itself is
  // covered by the i18n coverage gate.
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const { default: WindowControls } = await import("../../../src/shared/components/WindowControls");
const { default: HomeDesktopRuntimePanel } =
  await import("../../../src/app/(dashboard)/dashboard/HomeDesktopRuntimePanel");
const { default: DesktopDataDirSetting } =
  await import("../../../src/app/(dashboard)/dashboard/settings/components/DesktopDataDirSetting");

let container: HTMLDivElement;
let root: Root;

function stubBridge(impl: Invoke) {
  const invoke = vi.fn(impl);
  vi.stubGlobal("__TAURI__", { core: { invoke } });
  return invoke;
}

function render(element: React.ReactElement) {
  act(() => {
    root.render(element);
  });
}

function buttons(): string[] {
  return Array.from(container.querySelectorAll("button")).map(
    (button) => button.getAttribute("aria-label") ?? button.textContent ?? ""
  );
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("web build (no window.__TAURI__) renders no desktop surface", () => {
  it("WindowControls renders nothing", () => {
    render(<WindowControls />);
    expect(container.innerHTML).toBe("");
  });

  it("HomeDesktopRuntimePanel renders nothing", () => {
    render(<HomeDesktopRuntimePanel />);
    expect(container.innerHTML).toBe("");
  });

  it("DesktopDataDirSetting renders nothing", () => {
    render(<DesktopDataDirSetting />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Tauri webview wires the real bridge", () => {
  it("WindowControls renders minimize/maximize/close and invokes the shell commands", () => {
    const invoke = stubBridge(async () => undefined);
    render(<WindowControls />);

    expect(buttons()).toEqual(["minimizeWindow", "maximizeWindow", "closeWindow"]);

    const [minimize, maximize, close] = Array.from(container.querySelectorAll("button"));
    act(() => {
      minimize.click();
      maximize.click();
      close.click();
    });

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      "window_minimize",
      "window_toggle_maximize",
      "window_close",
    ]);
  });

  it("HomeDesktopRuntimePanel shows the polled state and drives start/stop", async () => {
    const invoke = stubBridge(async (command) => {
      if (command === "runtime_start") {
        return { state: "running", origin: "http://localhost:20128", port: 20128 };
      }
      if (command === "runtime_stop") {
        return { state: "stopped", origin: "http://localhost:20128", port: 20128 };
      }
      return {
        state: "stopped",
        origin: "http://localhost:20128",
        port: 20128,
        detail: "child exited with status 1",
      };
    });

    render(<HomeDesktopRuntimePanel />);
    await act(async () => {});

    expect(container.textContent).toContain("desktopStateStopped");
    expect(container.textContent).toContain("http://localhost:20128");
    // `detail` from the shell is surfaced, not dropped on the floor.
    expect(container.textContent).toContain("desktopStateDetail");
    expect(container.textContent).toContain("child exited with status 1");

    const start = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("desktopStartServer")
    );
    await act(async () => {
      start?.click();
    });

    expect(invoke).toHaveBeenCalledWith("runtime_start");
    expect(container.textContent).toContain("desktopStateRunning");
  });

  it("DesktopDataDirSetting shows the resolved data directory", async () => {
    stubBridge(async () => "/Users/example/Library/Application Support/omniroute");
    render(<DesktopDataDirSetting />);
    await act(async () => {});

    expect(container.textContent).toContain("/Users/example/Library/Application Support/omniroute");
    expect(container.textContent).toContain("dataDirectory");
  });
});
