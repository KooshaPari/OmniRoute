import fs from "node:fs";
import path from "node:path";

const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  ".next",
  ".build",
  "dist",
  "dist-electron",
  ".claude",
  "_references",
  "_mono_repo",
]);

export function discoverManifests(root) {
  const out = [];

  function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (EXCLUDED_SEGMENTS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.name === "package.json") {
        out.push(path.relative(root, full).replaceAll(/\\/g, "/"));
      }
    }
  }

  walk(root, 0);
  return out.toSorted();
}

function readManifest(root, relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

function dependencyRecordsFromManifest(root, manifest) {
  const pkg = readManifest(root, manifest);
  if (!pkg) return [];
  const records = [];
  for (const section of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const [name, spec] of Object.entries(pkg[section] || {})) {
      records.push({ name, spec, section, manifest });
    }
  }
  return records;
}

export function collectDependencyRecords(root) {
  return discoverManifests(root).flatMap((manifest) =>
    dependencyRecordsFromManifest(root, manifest)
  );
}

export function collectLocalPackages(root) {
  const packages = new Map();
  for (const manifest of discoverManifests(root)) {
    const pkg = readManifest(root, manifest);
    if (!pkg?.name) continue;
    packages.set(pkg.name, {
      manifest,
      private: pkg.private === true,
      os: Array.isArray(pkg.os) ? pkg.os : [],
      cpu: Array.isArray(pkg.cpu) ? pkg.cpu : [],
    });
  }
  return packages;
}

function npmAliasTarget(spec) {
  if (!spec.startsWith("npm:")) return null;
  const match = spec.slice(4).match(/^(@[^/]+\/[^@]+|[^@]+)@.+$/);
  return match?.[1] || null;
}

/** Classify one dependency using evidence from its declaration and local manifest. */
export function classifyDependency(record, context) {
  const { publicAllowlist, localPackages, aliases, root } = context;
  const aliasTarget = npmAliasTarget(record.spec);
  if (aliasTarget) {
    return aliases.get(record.name) === aliasTarget && publicAllowlist.has(aliasTarget)
      ? "alias"
      : null;
  }

  const local = localPackages.get(record.name);
  if (local?.private && record.spec.startsWith("file:")) {
    const declaredPath = path.resolve(
      root,
      path.dirname(record.manifest),
      record.spec.slice("file:".length)
    );
    const localPath = path.dirname(path.resolve(root, local.manifest));
    if (declaredPath === localPath) return "workspace-private";
  }

  if (
    local?.private &&
    record.section === "optionalDependencies" &&
    local.os.length > 0 &&
    local.cpu.length > 0
  ) {
    return "optional-platform";
  }

  return publicAllowlist.has(record.name) ? "public" : null;
}
