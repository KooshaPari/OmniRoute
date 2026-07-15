import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestDir = path.join(root, "docs", "journeys", "manifests");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedActions = new Set(["goto", "click", "fill", "press", "observe"]);
const allowedChecks = new Set([
  "document-title", "heading-order", "landmarks", "focus-visible",
  "accessible-names", "contrast", "no-horizontal-overflow",
]);
const errors = [];
const assert = (condition, file, message) => {
  if (!condition) errors.push(`${file}: ${message}`);
};

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

  assert(manifest.schemaVersion === 1, relative, "schemaVersion must be 1");
  assert(slugPattern.test(manifest.slug ?? ""), relative, "slug must be kebab-case");
  assert(file === `${manifest.slug}.json`, relative, "filename must equal <slug>.json");
  for (const key of ["title", "persona", "purpose"]) {
    assert(typeof manifest[key] === "string" && manifest[key].trim(), relative, `${key} is required`);
  }
  assert(Array.isArray(manifest.preconditions) && manifest.preconditions.length > 0, relative, "preconditions are required");
  assert(manifest.fixture?.secrets === false, relative, "fixture.secrets must be false");
  assert(["blocked", "mocked", "local-only"].includes(manifest.fixture?.network), relative, "fixture.network must be isolated");
  assert(Number.isInteger(manifest.viewport?.width) && manifest.viewport.width >= 320, relative, "viewport.width is invalid");
  assert(Number.isInteger(manifest.viewport?.height) && manifest.viewport.height >= 480, relative, "viewport.height is invalid");
  assert(Array.isArray(manifest.steps) && manifest.steps.length > 0, relative, "steps are required");
  for (const step of manifest.steps ?? []) {
    assert(slugPattern.test(step.id ?? ""), relative, "step id must be kebab-case");
    assert(allowedActions.has(step.action), relative, `unsupported action ${step.action}`);
    assert(typeof step.target === "string" && step.target.length > 0, relative, "step target is required");
    assert(Array.isArray(step.assertions) && step.assertions.length > 0, relative, "each step needs assertions");
  }
  assert(manifest.accessibility?.reducedMotion === true, relative, "reducedMotion must be true");
  for (const check of manifest.accessibility?.checks ?? []) {
    assert(allowedChecks.has(check), relative, `unsupported accessibility check ${check}`);
  }
  assert(manifest.redaction?.reviewRequired === true, relative, "human redaction review is required");
  assert(Array.isArray(manifest.redaction?.denyPatterns) && manifest.redaction.denyPatterns.length > 0, relative, "denyPatterns are required");
  assert(["blocked", "captured", "published"].includes(manifest.evidence?.captureStatus), relative, "invalid evidence status");
  if (manifest.evidence?.captureStatus === "blocked") {
    assert(typeof manifest.evidence.blocker === "string" && manifest.evidence.blocker.length > 0, relative, "blocked evidence needs a blocker");
  }
  assert(manifest.provenance?.baseBranch === "main", relative, "provenance.baseBranch must be main");
  assert(/^tests\//.test(manifest.provenance?.testFile ?? ""), relative, "provenance.testFile must reference tests/");
  try {
    const testSource = await readFile(path.join(root, manifest.provenance.testFile), "utf8");
    assert(testSource.includes(manifest.provenance.testTitle), relative, "referenced test title was not found");
    const gotoTargets = (manifest.steps ?? []).filter((step) => step.action === "goto").map((step) => step.target);
    for (const target of gotoTargets) {
      assert(testSource.includes(`goto('${target}')`) || testSource.includes(`goto("${target}")`), relative, `route ${target} is not present in the referenced test`);
    }
  } catch (error) {
    errors.push(`${relative}: cannot verify test provenance: ${error.message}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${files.length} deterministic journey manifest(s).`);
