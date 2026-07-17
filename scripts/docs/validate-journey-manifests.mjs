import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const shaPattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const idPattern = /^[1-9]\d*$/;
const canonicalUtcPattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/;
const allowedActions = new Set(["goto", "click", "fill", "press", "observe"]);
const allowedChecks = new Set([
  "document-title", "heading-order", "landmarks", "focus-visible",
  "accessible-names", "contrast", "no-horizontal-overflow", "reduced-motion",
]);

export function validateAccessibility(manifest, relative = "<manifest>") {
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(`${relative}: ${message}`); };
  assert(manifest.accessibility?.reducedMotion === true, "reducedMotion must be true");
  const checks = Array.isArray(manifest.accessibility?.checks) ? manifest.accessibility.checks : [];
  for (const check of checks) assert(allowedChecks.has(check), `unsupported accessibility check ${check}`);
  assert(checks.length === allowedChecks.size && new Set(checks).size === allowedChecks.size
    && [...allowedChecks].every((check) => checks.includes(check)),
  "accessibility checks must exactly match the substantiated eight-check contract");
  return errors;
}

export function validateEvidence(manifest, relative = "<manifest>") {
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(`${relative}: ${message}`); };
  const evidence = manifest.evidence ?? {};
  const artifacts = Array.isArray(evidence.artifacts) ? evidence.artifacts : [];
  assert(["blocked", "captured"].includes(evidence.captureStatus), "invalid evidence status");
  assert(artifacts.length > 0, "at least one evidence artifact is required");
  const artifactPaths = artifacts.map((artifact) => artifact?.path);
  assert(artifactPaths.every((artifactPath) => typeof artifactPath === "string" && artifactPath.length > 0), "every evidence artifact needs a path");
  assert(new Set(artifactPaths).size === artifactPaths.length, "evidence artifact paths must be unique");

  if (evidence.captureStatus === "blocked") {
    assert(typeof evidence.blocker === "string" && evidence.blocker.trim().length > 0, "blocked evidence needs a blocker");
    assert(evidence.capture === null, "blocked evidence must have capture set to null");
    return errors;
  }
  if (evidence.captureStatus === "captured") {
    assert(evidence.blocker === null, `${evidence.captureStatus} evidence must have blocker set to null`);
    const capture = evidence.capture;
    assert(capture && typeof capture === "object" && !Array.isArray(capture), `${evidence.captureStatus} evidence needs capture linkage`);
    if (!capture || typeof capture !== "object" || Array.isArray(capture)) return errors;
    assert(commitPattern.test(capture.sourceCommit ?? ""), "capture.sourceCommit must be a lowercase 40-character SHA");
    assert(idPattern.test(capture.workflowRunId ?? ""), "capture.workflowRunId must be a positive decimal ID string");
    assert(idPattern.test(capture.artifact?.id ?? ""), "capture.artifact.id must be a positive decimal ID string");
    assert(capture.artifact?.name === `${manifest.slug}-${capture.sourceCommit}`, "capture.artifact.name must equal <slug>-<sourceCommit>");
    const parseCanonicalUtc = (value) => {
      if (!canonicalUtcPattern.test(value ?? "")) return Number.NaN;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) && new Date(parsed).toISOString() === value.replace("Z", ".000Z") ? parsed : Number.NaN;
    };
    const createdAt = parseCanonicalUtc(capture.artifact?.createdAt);
    const expiresAt = parseCanonicalUtc(capture.artifact?.expiresAt);
    const retentionDays = evidence.retentionDays;
    const validRetentionDays = typeof retentionDays === "number" && Number.isFinite(retentionDays) && retentionDays > 0;
    assert(Number.isFinite(createdAt), "capture.artifact.createdAt must be canonical RFC 3339 UTC with whole-second precision");
    assert(Number.isFinite(expiresAt), "capture.artifact.expiresAt must be canonical RFC 3339 UTC with whole-second precision");
    assert(validRetentionDays, "retentionDays must be a positive finite number");
    if (Number.isFinite(createdAt) && Number.isFinite(expiresAt) && validRetentionDays) {
      const retentionMs = retentionDays * 86_400_000;
      assert(expiresAt > createdAt, "capture artifact expiry must follow creation");
      assert(Math.abs((expiresAt - createdAt) - retentionMs) <= 1000,
        "capture artifact dates must match retentionDays (allowing one-second platform rounding)");
    }
    const files = Array.isArray(capture.files) ? capture.files : [];
    assert(files.length > 0, "capture.files must not be empty");
    const capturedPaths = files.map((file) => file?.path);
    assert(capturedPaths.every((filePath) => typeof filePath === "string" && filePath.length > 0), "every capture file needs a path");
    assert(files.every((file) => shaPattern.test(file?.sha256 ?? "")), "every capture file needs a lowercase SHA-256 digest");
    assert(new Set(capturedPaths).size === capturedPaths.length, "capture file paths must be unique");
    assert(artifactPaths.length === capturedPaths.length && artifactPaths.every((artifactPath) => capturedPaths.includes(artifactPath)),
      "capture file inventory must exactly match evidence.artifacts");
  }
  return errors;
}

const validateManifestFields = (manifest, relative, assert) => {
  assert(manifest.schemaVersion === 2, relative, "schemaVersion must be 2");
  assert(slugPattern.test(manifest.slug ?? ""), relative, "slug must be kebab-case");
  for (const key of ["title", "persona", "purpose"]) assert(typeof manifest[key] === "string" && manifest[key].trim(), relative, `${key} is required`);
  assert(Array.isArray(manifest.preconditions) && manifest.preconditions.length > 0, relative, "preconditions are required");
  assert(manifest.fixture?.secrets === false, relative, "fixture.secrets must be false");
  assert(["blocked", "mocked", "local-only"].includes(manifest.fixture?.network), relative, "fixture.network must be isolated");
  assert(Number.isInteger(manifest.viewport?.width) && manifest.viewport.width >= 320, relative, "viewport.width is invalid");
  assert(Number.isInteger(manifest.viewport?.height) && manifest.viewport.height >= 480, relative, "viewport.height is invalid");
};

const validateSteps = (manifest, relative, assert) => {
  assert(Array.isArray(manifest.steps) && manifest.steps.length > 0, relative, "steps are required");
  for (const step of manifest.steps ?? []) {
    assert(slugPattern.test(step.id ?? ""), relative, "step id must be kebab-case");
    assert(allowedActions.has(step.action), relative, `unsupported action ${step.action}`);
    assert(typeof step.target === "string" && step.target.length > 0, relative, "step target is required");
    assert(Array.isArray(step.assertions) && step.assertions.length > 0, relative, "each step needs assertions");
  }
};

export const validateProvenance = async (root, manifest, relative, errors, assert) => {
  assert(manifest.provenance?.baseBranch === "main", relative, "provenance.baseBranch must be main");
  assert(/^tests\//.test(manifest.provenance?.testFile ?? ""), relative, "provenance.testFile must reference tests/");
  const testFile = manifest.provenance?.testFile;
  if (typeof testFile !== "string" || !/^tests\//.test(testFile)) return;
  try {
    const testSource = await readFile(path.join(root, testFile), "utf8");
    assert(testSource.includes(manifest.provenance.testTitle), relative, "referenced test title was not found");
    const routeTargets = [];
    for (const step of manifest.steps ?? []) {
      if (step.action !== "goto") continue;
      if (typeof step.target !== "string") {
        assert(false, relative, "goto step target must be a string before provenance matching");
        continue;
      }
      routeTargets.push(step.target);
    }
    for (const target of routeTargets) {
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
      const routePattern = new RegExp(String.raw`goto\(\s*["']${escaped}["']\s*[,)]`);
      assert(routePattern.test(testSource), relative, `route ${target} is not present in the referenced test`);
    }
  } catch (error) {
    errors.push(`${relative}: cannot verify test provenance: ${error.message}`);
  }
};

export async function validateRepository(root = process.cwd()) {
  const errors = [];
  const assert = (condition, file, message) => { if (!condition) errors.push(`${file}: ${message}`); };
  const manifestDir = path.join(root, "docs", "journeys", "manifests");
  const files = (await readdir(manifestDir)).filter((name) => name.endsWith(".json")).sort();
  assert(files.length > 0, manifestDir, "at least one manifest is required");
  for (const file of files) {
    const relative = path.posix.join("docs/journeys/manifests", file);
    let manifest;
    try { manifest = JSON.parse(await readFile(path.join(manifestDir, file), "utf8")); }
    catch (error) { errors.push(`${relative}: invalid JSON: ${error.message}`); continue; }
    validateManifestFields(manifest, relative, assert);
    assert(file === `${manifest.slug}.json`, relative, "filename must equal <slug>.json");
    validateSteps(manifest, relative, assert);
    errors.push(...validateAccessibility(manifest, relative));
    assert(manifest.redaction?.reviewRequired === true, relative, "human redaction review is required");
    assert(Array.isArray(manifest.redaction?.denyPatterns) && manifest.redaction.denyPatterns.length > 0, relative, "denyPatterns are required");
    errors.push(...validateEvidence(manifest, relative));
    await validateProvenance(root, manifest, relative, errors, assert);
  }
  return { errors, count: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, count } = await validateRepository();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log(`Validated ${count} deterministic journey manifest(s).`);
}
