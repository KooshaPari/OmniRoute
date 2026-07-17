import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

export const EXPECTED_BUN_VERSION = "1.3.14";

const bunPackages = [
  "packages/api-contracts",
  "packages/design-tokens",
  "apps/bff",
  "apps/web",
  "apps/desktop",
  "sveltekit-dashboard",
  "desktop-electrobun",
];
const bunTypesPackages = [".", "apps/bff", "apps/desktop", "desktop-electrobun"];

async function json(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

export async function checkBunParity(root = process.cwd()) {
  const failures = [];
  const rootManifest = await json(root, "package.json");
  const rootLock = await json(root, "package-lock.json");
  const rootLockManifest = rootLock.packages?.[""];

  if (rootManifest.devDependencies?.bun !== EXPECTED_BUN_VERSION) {
    failures.push(`package.json devDependencies.bun must equal ${EXPECTED_BUN_VERSION}`);
  }
  if (rootLockManifest?.devDependencies?.bun !== EXPECTED_BUN_VERSION) {
    failures.push(`package-lock.json root Bun declaration must equal ${EXPECTED_BUN_VERSION}`);
  }
  if (rootLock.packages?.["node_modules/bun"]?.version !== EXPECTED_BUN_VERSION) {
    failures.push(`package-lock.json resolved Bun must equal ${EXPECTED_BUN_VERSION}`);
  }
  for (const [name, metadata] of Object.entries(rootLock.packages ?? {})) {
    if (name.startsWith("node_modules/@oven/bun-") && metadata.version !== EXPECTED_BUN_VERSION) {
      failures.push(`${name} resolves ${metadata.version}; expected ${EXPECTED_BUN_VERSION}`);
    }
  }

  for (const directory of bunPackages) {
    const manifest = await json(root, `${directory}/package.json`);
    if (manifest.packageManager !== `bun@${EXPECTED_BUN_VERSION}`) {
      failures.push(`${directory}/package.json packageManager must equal bun@${EXPECTED_BUN_VERSION}`);
    }
    if (manifest.engines?.bun !== EXPECTED_BUN_VERSION) {
      failures.push(`${directory}/package.json engines.bun must equal ${EXPECTED_BUN_VERSION}`);
    }
    const lockfile = await readFile(path.join(root, directory, "bun.lock"), "utf8");
    if (!/"lockfileVersion"\s*:\s*1\b/.test(lockfile)) {
      failures.push(`${directory}/bun.lock must use the expected text lockfile format`);
    }
  }

  for (const directory of bunTypesPackages) {
    const manifestPath = directory === "." ? "package.json" : `${directory}/package.json`;
    const manifest = await json(root, manifestPath);
    if (manifest.devDependencies?.["@types/bun"] !== EXPECTED_BUN_VERSION) {
      failures.push(`${manifestPath} @types/bun must equal ${EXPECTED_BUN_VERSION}`);
    }
    if (directory === ".") {
      if (rootLock.packages?.["node_modules/@types/bun"]?.version !== EXPECTED_BUN_VERSION) {
        failures.push(`package-lock.json resolved @types/bun must equal ${EXPECTED_BUN_VERSION}`);
      }
      if (rootLock.packages?.["node_modules/bun-types"]?.version !== EXPECTED_BUN_VERSION) {
        failures.push(`package-lock.json resolved bun-types must equal ${EXPECTED_BUN_VERSION}`);
      }
    } else {
      const lockfile = await readFile(path.join(root, directory, "bun.lock"), "utf8");
      if (!lockfile.includes(`"@types/bun@${EXPECTED_BUN_VERSION}"`) ||
          !lockfile.includes(`"bun-types@${EXPECTED_BUN_VERSION}"`)) {
        failures.push(`${directory}/bun.lock must resolve @types/bun and bun-types ${EXPECTED_BUN_VERSION}`);
      }
    }
  }

  const workflowDir = path.join(root, ".github", "workflows");
  for (const entry of await readdir(workflowDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
    const workflow = await readFile(path.join(workflowDir, entry.name), "utf8");
    if (!workflow.includes("oven-sh/setup-bun@")) continue;
    const versions = [...workflow.matchAll(/bun-version:\s*['\"]?([^'\"\s}]+)/g)].map((match) => match[1]);
    if (versions.length === 0) failures.push(`.github/workflows/${entry.name} must contain an exact bun-version pin`);
    for (const version of versions) {
      if (version !== EXPECTED_BUN_VERSION) {
        failures.push(`.github/workflows/${entry.name} pins Bun ${version}; expected ${EXPECTED_BUN_VERSION}`);
      }
    }
  }

  if (process.versions.bun && process.versions.bun !== EXPECTED_BUN_VERSION) {
    failures.push(`running Bun ${process.versions.bun}; expected ${EXPECTED_BUN_VERSION}`);
  }
  return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = await checkBunParity(process.argv[2] ? path.resolve(process.argv[2]) : process.cwd());
  if (failures.length) {
    for (const failure of failures) console.error(`Bun parity check failed: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Bun ${EXPECTED_BUN_VERSION} is aligned across manifests, locks, workflows, and runtime`);
  }
}
