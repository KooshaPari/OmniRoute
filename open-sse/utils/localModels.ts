/**
 * Resolve an explicitly installed local-model companion entry from runtime anchors.
 *
 * This deliberately avoids `import.meta.url`: standalone bundles freeze it to the
 * build machine. Besides ordinary `node_modules`, npm's global layout places the
 * CLI in `<prefix>/bin` and packages in `<prefix>/lib/node_modules`.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_MODELS_PATH = ["@omniroute", "local-models"] as const;
const MAX_WALK_UP = 8;

type CompanionManifest = {
  exports?: Record<string, string | { default?: string }>;
};

function packageDirCandidates(dir: string): string[] {
  const candidates = [path.join(dir, "node_modules", ...LOCAL_MODELS_PATH)];
  if (path.basename(dir) === "node_modules") candidates.push(path.join(dir, ...LOCAL_MODELS_PATH));
  candidates.push(path.join(dir, "lib", "node_modules", ...LOCAL_MODELS_PATH));
  return candidates;
}

/** Runtime anchors that remain meaningful in a bundled server or global CLI. */
export function localModelsRuntimeAnchors(): string[] {
  const anchors = [process.cwd()];
  const argv1 = process.argv[1];
  if (typeof argv1 === "string" && argv1) anchors.push(path.dirname(argv1));
  return anchors;
}

/**
 * Return an absolute file URL for a companion export, or null when it was not
 * explicitly installed. The same URL can be passed directly to dynamic import.
 */
export function resolveLocalModelsEntry(
  exportName: string,
  anchors: string[] = localModelsRuntimeAnchors()
): string | null {
  for (const anchor of anchors) {
    if (!anchor) continue;
    let dir = path.resolve(anchor);
    for (let i = 0; i <= MAX_WALK_UP; i++) {
      for (const packageDir of packageDirCandidates(dir)) {
        const manifestPath = path.join(packageDir, "package.json");
        if (!fs.existsSync(manifestPath)) continue;
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CompanionManifest;
          const exported = manifest.exports?.[exportName];
          const target = typeof exported === "string" ? exported : exported?.default;
          if (!target) continue;
          const entry = path.resolve(packageDir, target);
          if (fs.existsSync(entry)) return pathToFileURL(entry).href;
        } catch {
          // Invalid/partial package manifests are indistinguishable from an absent companion.
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}
