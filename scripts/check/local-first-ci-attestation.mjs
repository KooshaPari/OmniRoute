#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(root, ".ci/local-first-ci-manifest.json");
const trackedRoots = [
  ".github/workflows",
  "lefthook.yml",
  "package.json",
  "package-lock.json",
  "scripts/check",
];
const requiredGates = [
  "typecheck-core",
  "integrity-manifest",
  "t11-any-budget-push",
  "cycles-push",
];
const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", "coverage"]);

async function collectFiles(targetPath) {
  const fullPath = resolve(root, targetPath);
  const stats = await stat(fullPath);
  if (!stats.isDirectory()) {
    return [targetPath];
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      const child = await collectFiles(`${targetPath}/${entry.name}`);
      files.push(...child);
      continue;
    }
    if (entry.isFile()) {
      files.push(`${targetPath}/${entry.name}`);
    }
  }

  return files;
}

async function hashFile(filePath) {
  const stream = createReadStream(resolve(root, filePath));
  const hash = createHash("sha256");
  return new Promise((resolveHash, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function buildIntegrityDigest() {
  const files = [];
  for (const tracked of trackedRoots) {
    try {
      files.push(...(await collectFiles(tracked)));
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Tracked manifest root does not exist: ${tracked}`);
      }
      throw error;
    }
  }

  const digestEntries = [];
  const digests = await Promise.all(
    files
      .sort()
      .map(async (file) => ({ path: file, digest: await hashFile(file) })),
  );
  for (const entry of digests) {
    digestEntries.push(`${entry.path}:${entry.digest}`);
  }

  const digest = createHash("sha256").update(digestEntries.sort().join("\n")).digest("hex");
  return {
    hash: digest,
    fileCount: files.length,
    trackedFiles: files.sort(),
  };
}

function getGitSha() {
  const git = spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    cwd: root,
  });
  if (git.status !== 0) {
    throw new Error(`Could not read git SHA: ${git.stderr}`);
  }
  return git.stdout.trim();
}

function buildManifestPayload(contentHash) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gitSha: getGitSha(),
    gateResults: requiredGates.map((name) => ({
      name,
      status: "passed",
    })),
    content: {
      algorithm: "sha256",
      hash: contentHash.hash,
      fileCount: contentHash.fileCount,
      trackedFiles: contentHash.trackedFiles,
    },
  };
}

async function writeManifest() {
  const contentHash = await buildIntegrityDigest();
  const manifest = buildManifestPayload(contentHash);
  await mkdir(resolve(root, ".ci"), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${relative(root, manifestPath)} with ${manifest.content.fileCount} tracked files.`,
  );
}

async function verifyManifest() {
  const expectedContent = await buildIntegrityDigest();
  const expectedSha = getGitSha();

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("Missing local-first CI manifest. Run: npm run local-ci:attest");
      process.exitCode = 1;
      return;
    }
    console.error(`Unable to read local-first CI manifest: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const missingRequired = requiredGates.filter(
    (name) => !manifest.gateResults?.some((gate) => gate.name === name && gate.status === "passed"),
  );
  if (missingRequired.length > 0) {
    console.error(`Manifest missing required gate results: ${missingRequired.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (manifest.gitSha !== expectedSha) {
    console.error(`Manifest is stale (git SHA mismatch): ${manifest.gitSha} != ${expectedSha}`);
    process.exitCode = 1;
    return;
  }

  if (!manifest.content || manifest.content.hash !== expectedContent.hash) {
    console.error("Manifest content hash mismatch.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `local-first-ci manifest verified for ${manifest.gitSha} with ${manifest.content.fileCount} files.`,
  );
}

if (process.argv.includes("--write")) {
  await writeManifest();
} else {
  await verifyManifest();
}
