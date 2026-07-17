import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateEvidence } from "../../scripts/docs/validate-journey-manifests.mjs";

const manifest = JSON.parse(await readFile(new URL("../../docs/journeys/manifests/anonymous-home-smoke.json", import.meta.url)));
const copy = () => structuredClone(manifest);
const errorsFor = (mutate) => {
  const candidate = copy();
  mutate(candidate);
  return validateEvidence(candidate);
};

test("accepts captured and published provenance, including an expired historical artifact", () => {
  assert.deepEqual(validateEvidence(manifest), []);
  assert.deepEqual(errorsFor((value) => { value.evidence.captureStatus = "published"; }), []);
  assert.deepEqual(errorsFor((value) => {
    value.evidence.capture.artifact.createdAt = "2020-01-01T00:00:00Z";
    value.evidence.capture.artifact.expiresAt = "2020-01-14T23:59:59Z";
  }), []);
});

test("accepts blocked evidence only without capture linkage", () => {
  assert.deepEqual(errorsFor((value) => {
    value.evidence.captureStatus = "blocked";
    value.evidence.blocker = "The deterministic CI lifecycle is unavailable.";
    value.evidence.capture = null;
  }), []);
  assert.match(errorsFor((value) => {
    value.evidence.captureStatus = "blocked";
    value.evidence.blocker = "blocked";
  }).join("\n"), /capture set to null/);
});

test("rejects missing linkage and a captured blocker", () => {
  assert.match(errorsFor((value) => { delete value.evidence.capture; }).join("\n"), /needs capture linkage/);
  assert.match(errorsFor((value) => { value.evidence.blocker = "stale blocker"; }).join("\n"), /blocker set to null/);
});

test("rejects malformed immutable identifiers and hashes", () => {
  for (const [mutate, expected] of [
    [(value) => { value.evidence.capture.sourceCommit = "ABC"; }, /sourceCommit/],
    [(value) => { value.evidence.capture.workflowRunId = "0"; }, /workflowRunId/],
    [(value) => { value.evidence.capture.artifact.id = "artifact"; }, /artifact.id/],
    [(value) => { value.evidence.capture.artifact.name = "wrong"; }, /artifact.name/],
    [(value) => { value.evidence.capture.files[0].sha256 = "tampered"; }, /SHA-256/],
  ]) assert.match(errorsFor(mutate).join("\n"), expected);
});

test("rejects invalid retention timestamps", () => {
  assert.match(errorsFor((value) => { value.evidence.capture.artifact.createdAt = "not-a-date"; }).join("\n"), /createdAt/);
  assert.match(errorsFor((value) => { value.evidence.capture.artifact.expiresAt = "2026-08-01T01:52:40Z"; }).join("\n"), /retentionDays/);
  assert.match(errorsFor((value) => { value.evidence.capture.artifact.expiresAt = "2026-07-16T01:52:40Z"; }).join("\n"), /expiry must follow creation/);
});

test("requires exact, unique artifact inventory", () => {
  assert.match(errorsFor((value) => { value.evidence.capture.files.pop(); }).join("\n"), /exactly match/);
  assert.match(errorsFor((value) => { value.evidence.capture.files.push({ path: "extra.txt", sha256: "a".repeat(64) }); }).join("\n"), /exactly match/);
  assert.match(errorsFor((value) => { value.evidence.capture.files[1].path = value.evidence.capture.files[0].path; }).join("\n"), /paths must be unique/);
  assert.match(errorsFor((value) => { value.evidence.artifacts[1].path = value.evidence.artifacts[0].path; }).join("\n"), /artifact paths must be unique/);
});
