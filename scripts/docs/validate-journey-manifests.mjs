import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const ID = /^[1-9]\d*$/;
const UTC = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/;
const ACTIONS = new Set(["goto", "click", "fill", "press", "observe"]);
const CHECKS = new Set([
  "document-title",
  "heading-order",
  "landmarks",
  "focus-visible",
  "accessible-names",
  "contrast",
  "no-horizontal-overflow",
  "reduced-motion",
]);

const canonicalTime = (value) => {
  if (typeof value !== "string" || !UTC.test(value)) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value.replace("Z", ".000Z")
    ? parsed
    : Number.NaN;
};

export function validateAccessibility(manifest, relative = "<manifest>") {
  const errors = [];
  const assert = (condition, message) => {
    if (!condition) errors.push(`${relative}: ${message}`);
  };
  const checks = Array.isArray(manifest.accessibility?.checks) ? manifest.accessibility.checks : [];
  assert(manifest.accessibility?.keyboardOnly === true, "keyboardOnly must be true");
  assert(manifest.accessibility?.reducedMotion === true, "reducedMotion must be true");
  assert(
    checks.length === CHECKS.size &&
      new Set(checks).size === CHECKS.size &&
      [...CHECKS].every((check) => checks.includes(check)),
    "accessibility checks must exactly match the substantiated eight-check contract"
  );
  return errors;
}

export function validateEvidence(manifest, relative = "<manifest>") {
  const errors = [];
  const assert = (condition, message) => {
    if (!condition) errors.push(`${relative}: ${message}`);
  };
  const evidence = manifest.evidence ?? {};
  const artifacts = Array.isArray(evidence.artifacts) ? evidence.artifacts : [];
  const artifactPaths = artifacts.map((artifact) => artifact?.path);
  assert(["blocked", "captured"].includes(evidence.captureStatus), "invalid evidence status");
  assert(artifacts.length > 0, "at least one evidence artifact is required");
  assert(
    artifactPaths.every(
      (value) => typeof value === "string" && value.startsWith("journey-evidence/")
    ),
    "every evidence artifact path must start with journey-evidence/"
  );
  assert(
    new Set(artifactPaths).size === artifactPaths.length,
    "evidence artifact paths must be unique"
  );

  if (evidence.captureStatus === "blocked") {
    assert(
      typeof evidence.blocker === "string" && evidence.blocker.trim().length > 0,
      "blocked evidence needs a blocker"
    );
    assert(evidence.capture === null, "blocked evidence must have capture set to null");
    return errors;
  }
  if (evidence.captureStatus !== "captured") return errors;

  assert(evidence.blocker === null, "captured evidence must have blocker set to null");
  const capture = evidence.capture;
  assert(
    capture && typeof capture === "object" && !Array.isArray(capture),
    "captured evidence needs capture linkage"
  );
  if (!capture || typeof capture !== "object" || Array.isArray(capture)) return errors;
  assert(
    COMMIT.test(capture.sourceCommit ?? ""),
    "capture.sourceCommit must be a lowercase 40-character SHA"
  );
  assert(
    ID.test(capture.workflowRunId ?? ""),
    "capture.workflowRunId must be a positive decimal ID string"
  );
  assert(
    ID.test(capture.artifact?.id ?? ""),
    "capture.artifact.id must be a positive decimal ID string"
  );
  assert(
    capture.artifact?.name === `${manifest.slug}-${capture.sourceCommit}`,
    "capture.artifact.name must equal <slug>-<sourceCommit>"
  );
  const created = canonicalTime(capture.artifact?.createdAt);
  const expires = canonicalTime(capture.artifact?.expiresAt);
  const days = evidence.retentionDays;
  assert(Number.isFinite(created), "capture.artifact.createdAt must be canonical RFC 3339 UTC");
  assert(Number.isFinite(expires), "capture.artifact.expiresAt must be canonical RFC 3339 UTC");
  assert(Number.isInteger(days) && days > 0, "retentionDays must be a positive integer");
  if (Number.isFinite(created) && Number.isFinite(expires) && Number.isInteger(days) && days > 0) {
    assert(expires > created, "capture artifact expiry must follow creation");
    assert(
      Math.abs(expires - created - days * 86_400_000) <= 1000,
      "capture artifact dates must match retentionDays within one second"
    );
  }
  const files = Array.isArray(capture.files) ? capture.files : [];
  const capturedPaths = files.map((file) => file?.path);
  assert(files.length > 0, "capture.files must not be empty");
  assert(
    capturedPaths.every(
      (value) => typeof value === "string" && value.startsWith("journey-evidence/")
    ),
    "every capture file path must start with journey-evidence/"
  );
  assert(
    files.every((file) => SHA256.test(file?.sha256 ?? "")),
    "every capture file needs a lowercase SHA-256 digest"
  );
  assert(new Set(capturedPaths).size === capturedPaths.length, "capture file paths must be unique");
  assert(
    artifactPaths.length === capturedPaths.length &&
      artifactPaths.every((artifactPath) => capturedPaths.includes(artifactPath)),
    "capture file inventory must exactly match evidence.artifacts"
  );
  return errors;
}

export async function validateProvenance(root, manifest, relative, errors, assert) {
  assert(
    manifest.provenance?.baseBranch === "main",
    relative,
    "provenance.baseBranch must be main"
  );
  const testFile = manifest.provenance?.testFile;
  assert(
    typeof testFile === "string" && testFile.startsWith("tests/"),
    relative,
    "provenance.testFile must reference tests/"
  );
  if (typeof testFile !== "string" || !testFile.startsWith("tests/")) return;
  try {
    const testSource = await readFile(path.join(root, testFile), "utf8");
    assert(
      typeof manifest.provenance.testTitle === "string" &&
        testSource.includes(manifest.provenance.testTitle),
      relative,
      "referenced test title was not found"
    );
    for (const step of manifest.steps ?? []) {
      if (step.action !== "goto") continue;
      if (typeof step.target !== "string") {
        assert(false, relative, "goto step target must be a string before provenance matching");
        continue;
      }
      const escaped = step.target.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
      assert(
        new RegExp(String.raw`goto\(\s*["']${escaped}["']\s*[,)]`).test(testSource),
        relative,
        `route ${step.target} is not present in the referenced test`
      );
    }
  } catch (error) {
    errors.push(`${relative}: cannot verify test provenance: ${error.message}`);
  }
}

export async function validateRepository(root = process.cwd()) {
  const errors = [];
  const assert = (condition, file, message) => {
    if (!condition) errors.push(`${file}: ${message}`);
  };
  const manifestDir = path.join(root, "docs", "journeys", "manifests");
  const files = (await readdir(manifestDir)).filter((name) => name.endsWith(".json")).sort();
  assert(files.length > 0, manifestDir, "at least one manifest is required");
  for (const file of files) {
    const relative = path.posix.join("docs/journeys/manifests", file);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(path.join(manifestDir, file), "utf8"));
    } catch (error) {
      errors.push(`${relative}: invalid JSON: ${error.message}`);
      continue;
    }
    assert(manifest.schemaVersion === 2, relative, "schemaVersion must be 2");
    assert(SLUG.test(manifest.slug ?? ""), relative, "slug must be kebab-case");
    assert(file === `${manifest.slug}.json`, relative, "filename must equal <slug>.json");
    assert(
      Array.isArray(manifest.steps) && manifest.steps.length > 0,
      relative,
      "steps are required"
    );
    for (const step of manifest.steps ?? []) {
      assert(SLUG.test(step.id ?? ""), relative, "step id must be kebab-case");
      assert(ACTIONS.has(step.action), relative, `unsupported action ${step.action}`);
      assert(
        typeof step.target === "string" && step.target.length > 0,
        relative,
        "step target is required"
      );
    }
    errors.push(...validateAccessibility(manifest, relative));
    assert(manifest.fixture?.secrets === false, relative, "fixture.secrets must be false");
    assert(
      manifest.redaction?.reviewRequired === true,
      relative,
      "human redaction review is required"
    );
    errors.push(...validateEvidence(manifest, relative));
    await validateProvenance(root, manifest, relative, errors, assert);
  }
  return { errors, count: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, count } = await validateRepository();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(`Validated ${count} deterministic journey manifest(s).`);
}
