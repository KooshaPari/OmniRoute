#!/usr/bin/env node

import { cp, mkdir, rm, access, writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const root = path.resolve(import.meta.dirname, "../..");
const bunExecutable = path.basename(process.env.npm_execpath ?? "").startsWith("bun")
  ? process.env.npm_execpath
  : "bun";
const source = path.join(root, "apps/web/.svelte-kit/output/client");
const destination = path.join(root, "desktop-electrobun/generated/web");
const rendererBuild = path.join(root, "apps/web/build");

try {
  await access(path.join(source, "_app/version.json"));
} catch {
  console.error(
    `[electrobun] apps/web client build output is missing at ${source}. ` +
      "Run `bun --cwd apps/web run build` before preparing the desktop shell."
  );
  process.exit(1);
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await access(path.join(rendererBuild, "index.js"));
const rendererDestination = path.join(root, "desktop-electrobun/generated/renderer");
await cp(rendererBuild, rendererDestination, { recursive: true });
// adapter-node serves browser assets from a sibling `client` directory.
// Keep the same immutable asset tree in the SSR bundle; the Electrobun static
// copy remains for diagnostics and future native-shell consumers.
await cp(source, path.join(rendererDestination, "client"), { recursive: true });

// adapter-node intentionally leaves framework runtime packages external. The
// desktop artifact must carry those packages; relying on a developer's
// workspace node_modules makes the installed app fail with a blank/404 page.
// Install only the SSR runtime closure (not the full web development tree).
const webLock = await readFile(path.join(root, "apps/web/bun.lock"), "utf8");

// Resolve exact versions from the web lockfile instead of carrying caret ranges
// into the installed desktop artifact. This keeps the renderer/runtime pair
// reproducible even when the workspace lockfile is refreshed later.
const pinnedVersion = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = webLock.match(new RegExp(`\\"${escaped}\\": \\[\\"${escaped}@([^\\"]+)`));
  if (!match) throw new Error(`missing locked version for renderer dependency ${name}`);
  return match[1];
};
const runtimeDependencies = {
  "@sveltejs/kit": pinnedVersion("@sveltejs/kit"),
  "@trpc/client": pinnedVersion("@trpc/client"),
  "web-vitals": pinnedVersion("web-vitals"),
};
const runtimePackage = {
  name: "@argismonitor/desktop-renderer-runtime",
  private: true,
  type: "module",
  dependencies: runtimeDependencies,
};
await writeFile(
  path.join(rendererDestination, "package.json"),
  JSON.stringify(runtimePackage, null, 2)
);
try {
  // Generate a lock for the reduced runtime package, then install strictly
  // from that lock. `--no-save` does not emit a lockfile with Bun, so retain the
  // generated lock alongside node_modules in the packaged renderer.
  await execFileAsync(
    bunExecutable,
    ["install", "--production", "--lockfile-only", "--ignore-scripts"],
    {
      cwd: rendererDestination,
    }
  );
  await execFileAsync(
    bunExecutable,
    ["install", "--production", "--frozen-lockfile", "--ignore-scripts"],
    {
      cwd: rendererDestination,
    }
  );
} catch (error) {
  console.error("[electrobun] failed to install renderer runtime dependencies:", error);
  process.exit(1);
}
for (const dependency of Object.keys(runtimeDependencies)) {
  await access(path.join(rendererDestination, "node_modules", dependency));
}
await access(path.join(rendererDestination, "bun.lock"));
console.log(`[electrobun] staged apps/web renderer at ${path.relative(root, rendererDestination)}`);

// The desktop app owns its local control plane: package the Hono/Bun BFF next
// to the static Svelte renderer so the app does not depend on a dev server.
const backendSource = path.join(root, "apps/bff/dist/index.js");
const backendDestination = path.join(root, "desktop-electrobun/generated/backend");
try {
  // Invoke Bun's compiler directly instead of re-entering its package-script
  // runner. The desktop CI deliberately installs dependencies with
  // --ignore-scripts; `bun run build` can then attempt to initialize Bun's
  // package-manager shim and fail before the BFF build command runs.
  await execFileAsync(bunExecutable, ["build", "src/index.ts", "--target=bun", "--outdir=dist"], {
    cwd: path.join(root, "apps/bff"),
  });
  await access(backendSource);
} catch (error) {
  console.error("[electrobun] failed to build Hono/Bun backend:", error);
  process.exit(1);
}
await rm(backendDestination, { recursive: true, force: true });
await mkdir(backendDestination, { recursive: true });
await cp(backendSource, path.join(backendDestination, "index.js"));
await writeFile(
  path.join(backendDestination, "server.mjs"),
  `import app from "./index.js";\n` +
    `const port = Number(process.env.PORT ?? 20128);\n` +
    `const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: app.fetch });\n` +
    `console.log("[omniroute-bff] listening on http://127.0.0.1:" + server.port);\n`
);
console.log(`[electrobun] staged Hono/Bun backend at ${path.relative(root, backendDestination)}`);
