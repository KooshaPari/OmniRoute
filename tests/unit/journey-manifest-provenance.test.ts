import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateAccessibility, validateEvidence } from "../../scripts/docs/validate-journey-manifests.mjs";

interface CaptureLink {
  sourceCommit: string;
  workflowRunId: string;
  artifact: { id: string; name: string; createdAt: string; expiresAt: string };
  files: Array<{ path: string; sha256: string }>;
}

interface JourneyManifest {
  slug: string;
  accessibility: { checks: string[] };
  evidence: {
    captureStatus: string;
    blocker: string | null;
    artifacts: Array<{ path: string }>;
    retentionDays: number;
    capture: CaptureLink | null;
  };
}

const manifest = JSON.parse(await readFile(new URL("../../docs/journeys/manifests/anonymous-home-smoke.json", import.meta.url))) as JourneyManifest;
const copy = () => structuredClone(manifest);
const errorsFor = (mutate: (candidate: JourneyManifest) => void) => {
  const candidate = copy();
  mutate(candidate);
  return validateEvidence(candidate);
};

test("accepts captured provenance, including an expired historical artifact", () => {
  assert.deepEqual(validateEvidence(manifest), []);
  assert.deepEqual(errorsFor((value) => {
    value.evidence.capture!.artifact.createdAt = "2020-01-01T00:00:00Z";
    value.evidence.capture!.artifact.expiresAt = "2020-01-14T23:59:59Z";
  }), []);
});

test("rejects a status-only published claim without publication provenance", () => {
  assert.match(errorsFor((value) => { value.evidence.captureStatus = "published"; }).join("\n"), /invalid evidence status/);
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
  assert.match(errorsFor((value) => { Reflect.deleteProperty(value.evidence, "capture"); }).join("\n"), /needs capture linkage/);
  assert.match(errorsFor((value) => { value.evidence.blocker = "stale blocker"; }).join("\n"), /blocker set to null/);
});

test("rejects malformed immutable identifiers and hashes", () => {
  const invalidIdentifiers: Array<[(value: JourneyManifest) => void, RegExp]> = [
    [(value) => { value.evidence.capture!.sourceCommit = "ABC"; }, /sourceCommit/],
    [(value) => { value.evidence.capture!.workflowRunId = "0"; }, /workflowRunId/],
    [(value) => { value.evidence.capture!.artifact.id = "artifact"; }, /artifact.id/],
    [(value) => { value.evidence.capture!.artifact.name = "wrong"; }, /artifact.name/],
    [(value) => { value.evidence.capture!.files[0].sha256 = "tampered"; }, /SHA-256/],
  ];
  for (const [mutate, expected] of invalidIdentifiers) assert.match(errorsFor(mutate).join("\n"), expected);
});

test("rejects invalid retention timestamps", () => {
  assert.match(errorsFor((value) => { value.evidence.capture!.artifact.createdAt = "not-a-date"; }).join("\n"), /createdAt/);
  assert.match(errorsFor((value) => { value.evidence.capture!.artifact.expiresAt = "2026-08-01T05:11:46Z"; }).join("\n"), /retentionDays/);
  assert.match(errorsFor((value) => { value.evidence.capture!.artifact.expiresAt = "2026-07-16T05:11:46Z"; }).join("\n"), /expiry must follow creation/);
});

test("rejects parseable but noncanonical or impossible timestamps", () => {
  for (const timestamp of [
    "July 17, 2026 01:52:40 UTC",
    "2026/07/17 01:52:40 UTC",
    "2026-07-17T03:52:40+02:00",
    "2026-07-17T01:52:40.000Z",
    "2026-02-30T01:52:40Z",
  ]) {
    assert.match(errorsFor((value) => { value.evidence.capture!.artifact.createdAt = timestamp; }).join("\n"), /canonical RFC 3339 UTC/);
  }
});

test("requires exact, unique artifact inventory", () => {
  assert.match(errorsFor((value) => { value.evidence.capture!.files.pop(); }).join("\n"), /exactly match/);
  assert.match(errorsFor((value) => { value.evidence.capture!.files.push({ path: "extra.txt", sha256: "a".repeat(64) }); }).join("\n"), /exactly match/);
  assert.match(errorsFor((value) => { value.evidence.capture!.files[1].path = value.evidence.capture!.files[0].path; }).join("\n"), /paths must be unique/);
  assert.match(errorsFor((value) => { value.evidence.artifacts[1].path = value.evidence.artifacts[0].path; }).join("\n"), /artifact paths must be unique/);
});

test("records only the exact substantiated accessibility contract", () => {
  assert.deepEqual(manifest.accessibility.checks, [
    "document-title", "heading-order", "landmarks", "focus-visible",
    "accessible-names", "contrast", "no-horizontal-overflow", "reduced-motion",
  ]);
  assert.equal(new Set(manifest.accessibility.checks).size, 8);
  assert.deepEqual(validateAccessibility(manifest), []);
  for (const mutate of [
    (value: JourneyManifest) => { value.accessibility.checks.pop(); },
    (value: JourneyManifest) => { value.accessibility.checks.push("contrast"); },
    (value: JourneyManifest) => { value.accessibility.checks[0] = "unsubstantiated"; },
  ]) {
    const candidate = copy();
    mutate(candidate);
    assert.match(validateAccessibility(candidate).join("\n"), /eight-check contract|unsupported accessibility check/);
  }
});
