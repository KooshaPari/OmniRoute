/**
 * phenotype-desktop Electrobun shell — main process template
 *
 * Features out of the box:
 *  - One-click service boot: runs `process-compose up -d` if SERVICES_COMPOSE_FILE is set
 *  - Loads renderer from RENDERER_URL env or falls back to bundled views://app/index.html
 *  - Standard window with hiddenInset title bar, 1400x900 default
 *  - Minimal app menu wired to webview JS dispatch
 */
import { BrowserWindow, ApplicationMenu, Tray, Utils } from "electrobun/bun";
import { $ } from "bun";
import { dirname, join, resolve } from "node:path";

// ── Config ────────────────────────────────────────────────────────────────────
const APP_NAME = process.env.APP_NAME ?? "OmniRoute";
// Bundled fallback page (polls + redirects to the live dev server).
const FALLBACK_RENDERER_URL = "views://app/index.html";
// Live dev server (HMR) the window navigates to once reachable.
const DEV_URL = process.env.RENDERER_URL ?? "http://localhost:3000";

/**
 * Path to process-compose.yml (absolute or relative to CWD).
 * Set SERVICES_COMPOSE_FILE env var, e.g.:
 *   SERVICES_COMPOSE_FILE=/path/to/repo/process-compose.yml
 * Leave unset to skip service boot.
 */
const SERVICES_COMPOSE_FILE = process.env.SERVICES_COMPOSE_FILE;
const SERVER_PORT = Number(process.env.OMNIROUTE_PORT ?? "20128");
let nextServer: ReturnType<typeof Bun.spawn> | undefined;
let rendererServer: ReturnType<typeof Bun.spawn> | undefined;

function stopSpawnedServer(
  server: ReturnType<typeof Bun.spawn> | undefined,
): ReturnType<typeof Bun.spawn> | undefined {
  if (!server) return undefined;
  try {
    server.kill();
  } catch (error) {
    console.warn("Failed to stop local server", { app: APP_NAME, error });
  }
  return undefined;
}

/** Resolve the backend from both Bun's worker path and the native launcher path.
 *
 * Electrobun starts the app entrypoint in a Worker. Depending on whether the
 * app was opened by Finder or launched from the terminal, `import.meta.dir`
 * and `process.argv0` can refer to different bundle roots. Keep the lookup
 * deterministic and fail closed when no packaged server is present.
 */
async function resolveBundledBackendDir(): Promise<string | undefined> {
  const candidates = [
    process.env.OMNIROUTE_BFF_DIR,
    resolve(import.meta.dir, "../backend"),
    resolve(dirname(process.argv0), "../Resources/app/backend"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await Bun.file(join(candidate, "server.mjs")).exists()) return candidate;
  }
  return undefined;
}

async function bootRendererServer(): Promise<string | undefined> {
  const candidates = [
    process.env.OMNIROUTE_RENDERER_DIR,
    resolve(import.meta.dir, "../renderer"),
    resolve(dirname(process.argv0), "../Resources/app/renderer"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  let rendererDir: string | undefined;
  for (const candidate of candidates) {
    if (await Bun.file(join(candidate, "index.js")).exists()) {
      rendererDir = candidate;
      break;
    }
  }
  if (!rendererDir) return undefined;
  const port = Number(process.env.OMNIROUTE_RENDERER_PORT ?? "20129");
  try {
    rendererServer = Bun.spawn(
      [process.env.OMNIROUTE_BUN ?? process.execPath, join(rendererDir, "index.js")],
      {
        cwd: rendererDir,
        env: {
          ...process.env,
          PORT: String(port),
          HOST: "127.0.0.1",
          ORIGIN: `http://127.0.0.1:${port}`,
        },
        stdout: "inherit",
        stderr: "inherit",
      },
    );
  } catch (error) {
    console.warn("Failed to start bundled Svelte renderer; using bundled fallback", {
      app: APP_NAME,
      error,
    });
    return undefined;
  }
  const url = `http://127.0.0.1:${port}`;
  const readinessUrl = `${url}/healthz`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(readinessUrl, { signal: AbortSignal.timeout(500) });
      if (response.ok) return url;
    } catch {
      // The gateway may still be starting; retry after the bounded delay below.
    }
    await Bun.sleep(250);
  }
  rendererServer = stopSpawnedServer(rendererServer);
  return undefined;
}

async function bootNextServer(): Promise<string | undefined> {
  const standaloneDir = await resolveBundledBackendDir();
  if (!standaloneDir) {
    console.warn(`[${APP_NAME}] No bundled backend server.mjs found; using bundled fallback`);
    return undefined;
  }
  const serverEntry = join(standaloneDir, "server.mjs");
  const serverUrl = `http://127.0.0.1:${SERVER_PORT}`;
  try {
    nextServer = Bun.spawn([process.env.OMNIROUTE_BUN ?? process.execPath, serverEntry], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        HOSTNAME: "127.0.0.1",
        BFF_ORIGIN: serverUrl,
        PUBLIC_OMNIROUTE_BFF_URL: serverUrl,
      },
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch (error) {
    console.warn("Failed to start bundled Hono/Bun backend; using bundled fallback", {
      app: APP_NAME,
      error,
    });
    return undefined;
  }
  const url = `http://127.0.0.1:${SERVER_PORT}`;
  const readinessUrl = `${url}/healthz`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(readinessUrl, { signal: AbortSignal.timeout(500) });
      if (response.ok) return url;
    } catch {
      // The backend may still be starting; retry after the bounded delay below.
    }
    await Bun.sleep(250);
  }
  console.warn(`[${APP_NAME}] Next standalone server did not become ready; using bundled fallback`);
  nextServer = stopSpawnedServer(nextServer);
  return undefined;
}

// ── Service boot ─────────────────────────────────────────────────────────────
async function bootServices(): Promise<void> {
  if (!SERVICES_COMPOSE_FILE) {
    console.log(`[${APP_NAME}] SERVICES_COMPOSE_FILE not set — skipping service boot`);
    return;
  }
  console.log(`[${APP_NAME}] Booting services: process-compose up -d`);
  try {
    const result = await $`process-compose up -d --config ${SERVICES_COMPOSE_FILE}`.quiet();
    console.log(`[${APP_NAME}] Services:`, result.text().trim());
  } catch (err) {
    console.warn(
      `[${APP_NAME}] process-compose boot skipped (not found or services already running):`,
      (err as Error).message,
    );
  }
}

// ── Window ───────────────────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: APP_NAME,
    url: FALLBACK_RENDERER_URL,
    frame: {
      x: 0,
      y: 0,
      width: parseInt(process.env.WINDOW_WIDTH ?? "1400"),
      height: parseInt(process.env.WINDOW_HEIGHT ?? "900"),
    },
    titleBarStyle: "hiddenInset",
  });
  // Electrobun does not guarantee activation from the constructor when launched
  // by Finder/LaunchServices. Explicitly show and focus the window.
  win.show();
  try {
    win.webview.executeJavascript(`window.__RENDERER_URL__ = ${JSON.stringify(DEV_URL)};`);
  } catch {
    /* webview not ready yet — fallback page uses its baked-in default */
  }
  return win;
}

function setupTray(win: BrowserWindow): Tray | undefined {
  try {
    const tray = new Tray({ title: "OmniRoute", template: true });
    tray.setMenu([
      { type: "normal", label: "Open OmniRoute", action: "open" },
      { type: "normal", label: "Reload", action: "reload" },
      { type: "separator" },
      { type: "normal", label: "Quit OmniRoute", action: "quit" },
    ]);
    tray.on("tray-clicked", (event: any) => {
      const action = event?.data?.action ?? event?.action;
      if (action === "open") {
        win.show();
        win.focus();
      } else if (action === "reload") {
        win.webview.loadURL(win.webview.url ?? FALLBACK_RENDERER_URL);
      } else if (action === "quit") {
        Utils.quit();
      }
    });
    return tray;
  } catch (error) {
    console.warn(`[${APP_NAME}] Tray unavailable; application menu remains available`, error);
    return undefined;
  }
}

// ── Menu ─────────────────────────────────────────────────────────────────────
function setupMenu(win: BrowserWindow): void {
  ApplicationMenu.setApplicationMenu([
    {
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // Add app-specific menus below this line
    // Example — dispatch to webview via executeJavaScript:
    // {
    //   label: "File",
    //   submenu: [
    //     {
    //       label: "New",
    //       accelerator: "CmdOrCtrl+N",
    //       click: () => win.webview.executeJavaScript("window.__app?.onNew?.()"),
    //     },
    //   ],
    // },
  ]);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await bootServices();
  const bundledUrl = await bootNextServer();
  const rendererUrl = await bootRendererServer();
  const win = createMainWindow();
  if (rendererUrl) win.webview.loadURL(rendererUrl);
  setupMenu(win);
  setupTray(win);
  console.log(
    `[${APP_NAME}] Launched → ${rendererUrl ?? bundledUrl ?? DEV_URL} (fallback ${FALLBACK_RENDERER_URL})`,
  );
}

process.on("exit", () => {
  nextServer = stopSpawnedServer(nextServer);
  rendererServer = stopSpawnedServer(rendererServer);
});
main().catch((err) => {
  console.error(`[${APP_NAME}] Fatal:`, err);
  process.exit(1);
});
