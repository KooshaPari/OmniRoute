#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const evidenceRoot = resolve(root, ".ci");
const outputRoot = resolve(root, ".local-first-ci-artifact");
const sha = process.env.GITHUB_SHA || "";

if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error("GITHUB_SHA must be a full lowercase commit SHA");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

await mkdir(outputRoot, { recursive: true });
const evidenceFiles = await filesUnder(evidenceRoot);
const checksums = [];
for (const path of evidenceFiles) {
  const content = await readFile(path);
  const artifactPath = relative(root, path).replaceAll("\\", "/");
  checksums.push(`${sha256(content)}  ${artifactPath}`);
}

const manifest = JSON.parse(
  await readFile(resolve(evidenceRoot, "local-first-ci-manifest.json"), "utf8")
);
const provenance = {
  schemaVersion: 1,
  artifact: `local-first-ci-${sha}`,
  commitSha: sha,
  sourceTreeSha256: manifest.content?.sourceTreeSha256,
  filesystemSha256: manifest.content?.hash,
  trackedInputCount: manifest.content?.fileCount,
  workflow: process.env.GITHUB_WORKFLOW || "",
  workflowRef: process.env.GITHUB_WORKFLOW_REF || "",
  runId: process.env.GITHUB_RUN_ID || "",
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || "",
  eventName: process.env.GITHUB_EVENT_NAME || "",
  repository: process.env.GITHUB_REPOSITORY || "",
};

if (!/^[0-9a-f]{64}$/u.test(provenance.sourceTreeSha256 || "")) {
  throw new Error("generated manifest is missing source-tree provenance");
}
if (!/^[0-9a-f]{64}$/u.test(provenance.filesystemSha256 || "")) {
  throw new Error("generated manifest is missing filesystem provenance");
}

await writeFile(resolve(outputRoot, "checksums.sha256"), `${checksums.join("\n")}\n`, "utf8");
await writeFile(
  resolve(outputRoot, "provenance.json"),
  `${JSON.stringify(provenance, null, 2)}\n`,
  "utf8"
);
console.log(
  `Prepared ${basename(outputRoot)} for ${sha} with ${evidenceFiles.length} evidence files.`
);
