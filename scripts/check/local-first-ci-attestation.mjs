#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(root, ".ci/local-first-ci-manifest.json");
const proofDir = resolve(root, ".ci", "local-first-ci-gates");
const requiredGates = [
  {
    name: "typecheck-core",
    command:
      "bunx --no-install tsc --noEmit --noCheck --ignoreDeprecations 6.0 -p open-sse/tsconfig.json",
  },
  {
    name: "integrity-manifest",
    command: "bun run integrity:manifest:write",
  },
  {
    name: "t11-any-budget-push",
    command: "bun scripts/check/check-t11-any-budget.mjs",
  },
  {
    name: "cycles-push",
    command: "bun scripts/check/check-cycles.mjs",
  },
];
const excludedTrackedPrefixes = [".ci/"];
const MODE_RECORD = "--record";
const MODE_WRITE = "--write";

export function sourceTreeDigestFromLsTree(value) {
  const separator = value.includes("\0") ? "\0" : /\r?\n/u;
  return textSha256(
    value
      .split(separator)
      .filter(Boolean)
      .filter((entry) => {
        const tab = entry.indexOf("\t");
        const path = tab === -1 ? "" : entry.slice(tab + 1).replaceAll("\\", "/");
        return isAttestedTrackedPath(path);
      })
      .sort()
      .join("\n"),
  );
}

export function isAttestedTrackedPath(path) {
  const normalized = String(path).replaceAll("\\", "/").replace(/^\.\//u, "");
  return normalized !== ".ci" && !excludedTrackedPrefixes.some((prefix) => normalized.startsWith(prefix));
}

export function trackedInputPathsFromLsFiles(value) {
  const separator = value.includes("\0") ? "\0" : /\r?\n/u;
  return value
    .split(separator)
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"))
    .filter(isAttestedTrackedPath)
    .sort();
}

export function evidenceBindingFailures({
  proof,
  actualLogHash,
  expectedInputHash,
  expectedSourceTreeHash,
  manifestProofHash,
  actualProofHash,
}) {
  const failures = [];
  if (actualLogHash && proof.log?.sha256 !== actualLogHash) failures.push("log hash mismatch");
  if (expectedInputHash && proof.input?.hash !== expectedInputHash) failures.push("input hash mismatch");
  if (expectedSourceTreeHash && proof.input?.sourceTreeSha256 !== expectedSourceTreeHash) {
    failures.push("source-tree hash mismatch");
  }
  if (manifestProofHash && actualProofHash !== manifestProofHash) failures.push("proof hash mismatch");
  return failures;
}

function buildSourceTreeDigest() {
  const tree = spawnSync("git", ["ls-tree", "-r", "-z", "--full-tree", "HEAD"], {
    encoding: "utf8",
    cwd: root,
  });
  if (tree.status !== 0) {
    throw new Error(`Could not read attestation input tree: ${tree.stderr}`);
  }
  return sourceTreeDigestFromLsTree(tree.stdout);
}

function getFlagValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[idx + 1];
}

function getArgFlag(flag) {
  return process.argv.includes(flag);
}

function fileSha256(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function textSha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function buildIntegrityDigest() {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached"], {
    encoding: "utf8",
    cwd: root,
  });
  if (listed.status !== 0) {
    throw new Error(`Could not enumerate tracked attestation inputs: ${listed.stderr}`);
  }
  const files = trackedInputPathsFromLsFiles(listed.stdout);

  const digestEntries = [];
  for (const file of files) {
    try {
      digestEntries.push(`${file}:${await fileSha256(resolve(root, file))}`);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Tracked attestation input is missing from the filesystem: ${file}`);
      }
      throw error;
    }
  }

  const digest = createHash("sha256").update(digestEntries.sort().join("\n")).digest("hex");
  return {
    hash: digest,
    fileCount: files.length,
    trackedFiles: files.sort(),
  };
}

function proofPaths(gateName) {
  return {
    proofPath: resolve(proofDir, `${gateName}.proof.json`),
    proofRelativePath: relative(root, resolve(proofDir, `${gateName}.proof.json`)).replaceAll("\\", "/"),
    logPath: resolve(proofDir, `${gateName}.log.txt`),
    logRelativePath: relative(root, resolve(proofDir, `${gateName}.log.txt`)).replaceAll("\\", "/"),
  };
}

function requiredGateByName(name) {
  return requiredGates.find((gate) => gate.name === name);
}

function normalizeProofStatus(status) {
  return String(status || "").toLowerCase();
}

async function runGate(gate, command) {
  const input = await buildIntegrityDigest();
  const sourceTreeSha256 = buildSourceTreeDigest();
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, {
    encoding: "utf8",
    cwd: root,
    shell: true,
  });
  const finishedAt = new Date().toISOString();
  const { proofPath, logPath, logRelativePath, proofRelativePath } = proofPaths(gate.name);
  await mkdir(proofDir, { recursive: true });

  const logPayload = [
    `command: ${command}`,
    `startedAt: ${startedAt}`,
    `finishedAt: ${finishedAt}`,
    `exitCode: ${result.status}`,
    `signal: ${result.signal ?? "none"}`,
    `inputSha256: ${input.hash}`,
    `sourceTreeSha256: ${sourceTreeSha256}`,
    "stdout:",
    result.stdout || "",
    "stderr:",
    result.stderr || "",
  ].join("\n");
  await writeFile(logPath, `${logPayload}\n`);

  const proof = {
    schemaVersion: 2,
    name: gate.name,
    status: result.status === 0 ? "passed" : "failed",
    command: gate.command,
    exitCode: result.status,
    signal: result.signal ?? null,
    generatedAt: new Date().toISOString(),
    input: {
      algorithm: "sha256",
      hash: input.hash,
      fileCount: input.fileCount,
      sourceTreeSha256,
    },
    log: {
      path: logRelativePath,
      sha256: await fileSha256(logPath),
      bytes: logPayload.length,
    },
  };
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`);

  console.log(
    `Wrote ${proofRelativePath} and ${logRelativePath} (${result.status === 0 ? "passed" : "failed"})`,
  );

  return {
    status: proof.status,
    proofPath: proofRelativePath,
    proofHash: textSha256(JSON.stringify(proof, null, 2) + "\n"),
  };
}

async function loadGateProof(gateName) {
  const def = requiredGateByName(gateName);
  if (!def) {
    throw new Error(`Unknown local-first gate: ${gateName}`);
  }

  const { proofPath, logPath } = proofPaths(gateName);
  let raw;
  try {
    raw = await readFile(proofPath, "utf8");
  } catch (error) {
    throw new Error(`Missing proof artifact for gate ${gateName}: ${proofPath}`);
  }

  let proof;
  try {
    proof = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid proof JSON for gate ${gateName}: ${error.message}`);
  }

  if (proof.name !== gateName) {
    throw new Error(`Proof gate mismatch: expected ${gateName} got ${proof.name}`);
  }

  if (proof.command !== def.command) {
    throw new Error(`Proof command mismatch for ${gateName}: ${proof.command}`);
  }

  if (normalizeProofStatus(proof.status) !== "passed") {
    throw new Error(`Required gate ${gateName} did not pass according to proof (status=${proof.status})`);
  }

  const proofHash = textSha256(raw);
  if (proof.schemaVersion !== 2) {
    throw new Error(`Unsupported proof schemaVersion for ${gateName}: ${proof.schemaVersion}`);
  }
  if (proof.input?.algorithm !== "sha256" || !/^[a-f0-9]{64}$/.test(proof.input?.hash || "")) {
    throw new Error(`Missing or invalid input digest in proof for ${gateName}`);
  }
  if (!/^[a-f0-9]{64}$/.test(proof.input?.sourceTreeSha256 || "")) {
    throw new Error(`Missing or invalid source-tree digest in proof for ${gateName}`);
  }

  const proofLogPath = proof?.log?.path ? resolve(root, proof.log.path) : logPath;
  if (!existsSync(proofLogPath)) {
    throw new Error(`Missing proof log for ${gateName}: ${proof.log.path}`);
  }

  const actualLogHash = await fileSha256(proofLogPath);
  if (evidenceBindingFailures({ proof, actualLogHash }).length > 0) {
    throw new Error(`Proof log hash mismatch for ${gateName}`);
  }

  return {
    proof,
    proofHash,
  };
}

async function buildGateResults(expectedInputHash, expectedSourceTreeHash) {
  const gateResults = [];
  for (const gate of requiredGates) {
    const { proof, proofHash } = await loadGateProof(gate.name);
    if (proof.input.hash !== expectedInputHash) {
      throw new Error(
        `Gate ${gate.name} proof input mismatch: ${proof.input.hash} (required ${expectedInputHash})`,
      );
    }
    if (proof.input.sourceTreeSha256 !== expectedSourceTreeHash) {
      throw new Error(
        `Gate ${gate.name} proof source-tree mismatch: ${proof.input.sourceTreeSha256} (required ${expectedSourceTreeHash})`,
      );
    }
    gateResults.push({
      name: gate.name,
      status: proof.status,
      command: proof.command,
      proofPath: proofPaths(gate.name).proofRelativePath,
      proofHash,
      executedAt: proof.generatedAt,
    });
  }
  return gateResults;
}

async function writeManifest() {
  const contentHash = await buildIntegrityDigest();
  const sourceTreeSha256 = buildSourceTreeDigest();
  const gateResults = await buildGateResults(contentHash.hash, sourceTreeSha256);
  const manifest = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    gateResults,
    content: {
      algorithm: "sha256",
      hash: contentHash.hash,
      fileCount: contentHash.fileCount,
      trackedFiles: contentHash.trackedFiles,
      sourceTreeSha256,
    },
  };
  await mkdir(resolve(root, ".ci"), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${relative(root, manifestPath)} with ${manifest.content.fileCount} tracked files and ${manifest.gateResults.length} gate proofs.`,
  );
}

async function verifyManifest() {
  const expectedContent = await buildIntegrityDigest();
  const expectedSourceTreeSha256 = buildSourceTreeDigest();
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(
        "Missing local-first CI manifest. Regenerate gates and manifest with: bunx lefthook run pre-push && bun run local-ci:attest:write",
      );
      process.exitCode = 1;
      return;
    }
    console.error(`Unable to read local-first CI manifest: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const missingRequired = requiredGates
    .map((g) => g.name)
    .filter((name) => !manifest.gateResults?.some((gate) => gate?.name === name));
  if (missingRequired.length > 0) {
    console.error(`Manifest missing required gate results: ${missingRequired.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (manifest.schemaVersion !== 2) {
    console.error(`Unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
    process.exitCode = 1;
    return;
  }

  if (!manifest.content || manifest.content.hash !== expectedContent.hash) {
    console.error("Manifest content hash mismatch.");
    console.error(
      "Re-run and commit with: bunx lefthook run pre-push && bun run local-ci:attest:write",
    );
    process.exitCode = 1;
    return;
  }
  if (manifest.content.sourceTreeSha256 !== expectedSourceTreeSha256) {
    console.error("Manifest source-tree hash mismatch.");
    process.exitCode = 1;
    return;
  }

  const proofValidationFailures = [];
  for (const requiredGate of requiredGates) {
    const result = manifest.gateResults.find((entry) => entry?.name === requiredGate.name);
    if (!result) {
      proofValidationFailures.push(`Missing gate result in manifest: ${requiredGate.name}`);
      continue;
    }

    if (normalizeProofStatus(result.status) !== "passed") {
      proofValidationFailures.push(`Manifest marks gate as ${result.status}: ${requiredGate.name}`);
    }
    if (!result.proofPath || !result.proofHash) {
      proofValidationFailures.push(`Manifest is missing proofPath/proofHash for ${requiredGate.name}`);
      continue;
    }

    let proof;
    let proofHash;
    try {
      const loaded = await loadGateProof(requiredGate.name);
      proof = loaded.proof;
      proofHash = loaded.proofHash;
    } catch (error) {
      proofValidationFailures.push(error.message);
      continue;
    }

    const bindingFailures = evidenceBindingFailures({
      proof,
      expectedInputHash: expectedContent.hash,
      expectedSourceTreeHash: expectedSourceTreeSha256,
      manifestProofHash: result.proofHash,
      actualProofHash: proofHash,
    });
    proofValidationFailures.push(
      ...bindingFailures.map((failure) => `Proof ${requiredGate.name} ${failure}`),
    );

    if (result.proofPath) {
      const proofPath = resolve(root, result.proofPath);
      if (!existsSync(proofPath)) {
        proofValidationFailures.push(`Missing manifest-referenced proof artifact for ${requiredGate.name}`);
      }
    }
  }

  if (proofValidationFailures.length > 0) {
    console.error("Manifest proof validation failed:");
    proofValidationFailures.forEach((entry) => console.error(`  - ${entry}`));
    console.error("Regenerate with: bunx lefthook run pre-push && bun run local-ci:attest:write");
    process.exitCode = 1;
    return;
  }

  console.log(
    `local-first-ci manifest verified for input ${manifest.content.hash} with ${manifest.content.fileCount} files and ${manifest.gateResults.length} gate proofs.`,
  );
}

async function recordMode() {
  const gateName = getFlagValue("--gate");
  const command = getFlagValue("--command");
  if (!gateName || !command) {
    console.error("Usage: ... --record --gate <name> --command <cmd>");
    process.exitCode = 2;
    return;
  }
  const gate = requiredGateByName(gateName);
  if (!gate) {
    console.error(`Unknown required gate: ${gateName}`);
    process.exitCode = 2;
    return;
  }
  if (command !== gate.command) {
    console.error(`Refusing to run non-canonical command for ${gateName}. Expected: ${gate.command}`);
    process.exitCode = 2;
    return;
  }
  const outcome = await runGate(gate, command);
  if (normalizeProofStatus(outcome.status) !== "passed") {
    process.exitCode = 1;
  }
}

async function main() {
  if (getArgFlag(MODE_RECORD)) {
    await recordMode();
    return;
  }

  if (getArgFlag(MODE_WRITE)) {
    await writeManifest();
    return;
  }

  await verifyManifest();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
