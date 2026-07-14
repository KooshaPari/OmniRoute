import { readFile } from "node:fs/promises";

const v4Packages = [
  "packages/api-contracts",
  "packages/design-tokens",
  "apps/bff",
  "apps/web",
  "apps/desktop",
];
const bunWorkflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/argismonitor-ci.yml",
  ".github/workflows/release.yml",
];

const failures = [];
const versions = new Set();

for (const directory of v4Packages) {
  const manifest = JSON.parse(await readFile(`${directory}/package.json`, "utf8"));
  const packageManager = manifest.packageManager;
  const packageManagerMatch = /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager ?? "");
  const engineVersion = manifest.engines?.bun;

  if (!packageManagerMatch) {
    failures.push(`${directory}/package.json must pin packageManager to bun@<exact version>`);
    continue;
  }

  const version = packageManagerMatch[1];
  versions.add(version);
  if (engineVersion !== version) {
    failures.push(`${directory}/package.json engines.bun must equal ${version}`);
  }

  const lockfile = await readFile(`${directory}/bun.lock`, "utf8");
  if (!/"lockfileVersion"\s*:\s*1\b/.test(lockfile)) {
    failures.push(`${directory}/bun.lock must use the expected text lockfile format`);
  }
}

if (versions.size !== 1) {
  failures.push(`v4 packageManager pins disagree: ${[...versions].sort().join(", ")}`);
}

const [expectedVersion] = versions;
for (const workflow of bunWorkflows) {
  const source = await readFile(workflow, "utf8");
  const workflowVersions = [...source.matchAll(/bun-version:\s*([0-9]+\.[0-9]+\.[0-9]+)/g)].map(
    (match) => match[1],
  );

  if (workflowVersions.length === 0) {
    failures.push(`${workflow} must contain an exact bun-version pin`);
  }
  for (const version of workflowVersions) {
    if (version !== expectedVersion) {
      failures.push(`${workflow} pins Bun ${version}; expected ${expectedVersion}`);
    }
  }
}

if (process.versions.bun && process.versions.bun !== expectedVersion) {
  failures.push(`running Bun ${process.versions.bun}; expected ${expectedVersion}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Bun parity check failed: ${failure}`);
  process.exit(1);
}

console.log(`Bun ${expectedVersion} is aligned across v4 manifests, locks, workflows, and runtime`);
