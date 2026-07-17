import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAccessibility, validateEvidence, validateProvenance } from "../../scripts/docs/validate-journey-manifests.mjs";

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
  expect(validateEvidence(manifest)).toEqual([]);
  expect(errorsFor((value) => {
    value.evidence.capture!.artifact.createdAt = "2020-01-01T00:00:00Z";
    value.evidence.capture!.artifact.expiresAt = "2020-01-14T23:59:59Z";
  })).toEqual([]);
});

test("rejects a status-only published claim without publication provenance", () => {
  expect(errorsFor((value) => { value.evidence.captureStatus = "published"; }).join("\n")).toMatch(/invalid evidence status/);
});

test("accepts blocked evidence only without capture linkage", () => {
  expect(errorsFor((value) => {
    value.evidence.captureStatus = "blocked";
    value.evidence.blocker = "The deterministic CI lifecycle is unavailable.";
    value.evidence.capture = null;
  })).toEqual([]);
  expect(errorsFor((value) => {
    value.evidence.captureStatus = "blocked";
    value.evidence.blocker = "blocked";
  }).join("\n")).toMatch(/capture set to null/);
});

test("rejects missing linkage and a captured blocker", () => {
  expect(errorsFor((value) => { Reflect.deleteProperty(value.evidence, "capture"); }).join("\n")).toMatch(/needs capture linkage/);
  expect(errorsFor((value) => { value.evidence.blocker = "stale blocker"; }).join("\n")).toMatch(/blocker set to null/);
});

test("rejects malformed immutable identifiers and hashes", () => {
  const invalidIdentifiers: Array<[(value: JourneyManifest) => void, RegExp]> = [
    [(value) => { value.evidence.capture!.sourceCommit = "ABC"; }, /sourceCommit/],
    [(value) => { value.evidence.capture!.workflowRunId = "0"; }, /workflowRunId/],
    [(value) => { value.evidence.capture!.artifact.id = "artifact"; }, /artifact.id/],
    [(value) => { value.evidence.capture!.artifact.name = "wrong"; }, /artifact.name/],
    [(value) => { value.evidence.capture!.files[0].sha256 = "tampered"; }, /SHA-256/],
  ];
  for (const [mutate, expected] of invalidIdentifiers) expect(errorsFor(mutate).join("\n")).toMatch(expected);
});

test("rejects invalid retention timestamps", () => {
  expect(errorsFor((value) => { value.evidence.capture!.artifact.createdAt = "not-a-date"; }).join("\n")).toMatch(/createdAt/);
  expect(errorsFor((value) => { value.evidence.capture!.artifact.expiresAt = "2026-08-01T05:11:46Z"; }).join("\n")).toMatch(/retentionDays/);
  expect(errorsFor((value) => { value.evidence.capture!.artifact.expiresAt = "2026-07-16T05:11:46Z"; }).join("\n")).toMatch(/expiry must follow creation/);
});

test("validates finite retention and allows symmetric one-second rounding", () => {
  expect(errorsFor((value) => { (value.evidence as { retentionDays: unknown }).retentionDays = Number.NaN; }).join("\n")).toMatch(/positive finite/);
  expect(errorsFor((value) => { (value.evidence as { retentionDays: unknown }).retentionDays = "14"; }).join("\n")).toMatch(/positive finite/);
  expect(errorsFor((value) => { value.evidence.capture!.artifact.expiresAt = "2026-07-31T05:11:47Z"; })).toEqual([]);
});

test("guards malformed provenance fields before filesystem and string operations", async () => {
  const root = path.join(os.tmpdir(), `journey-provenance-${crypto.randomUUID()}`);
  await mkdir(path.join(root, "tests", "e2e"), { recursive: true });
  await writeFile(path.join(root, "tests", "e2e", "journey.spec.ts"), "test('capture', async ({ page }) => page.goto('/'));\n");
  const run = async (candidate: any) => {
    const errors: string[] = [];
    const assert = (condition: unknown, file: string, message: string) => { if (!condition) errors.push(`${file}: ${message}`); };
    await validateProvenance(root, candidate, "manifest.json", errors, assert);
    return errors;
  };
  await expect(run({ provenance: { baseBranch: "main", testFile: undefined }, steps: [] })).resolves.toContain("manifest.json: provenance.testFile must reference tests/");
  await expect(run({ provenance: { baseBranch: "main", testFile: "tests/e2e/journey.spec.ts", testTitle: "capture" }, steps: [{ action: "goto", target: null }] }))
    .resolves.toContain("manifest.json: goto step target must be a string before provenance matching");
});

test("rejects parseable but noncanonical or impossible timestamps", () => {
  for (const timestamp of [
    "July 17, 2026 01:52:40 UTC",
    "2026/07/17 01:52:40 UTC",
    "2026-07-17T03:52:40+02:00",
    "2026-07-17T01:52:40.000Z",
    "2026-02-30T01:52:40Z",
  ]) {
    expect(errorsFor((value) => { value.evidence.capture!.artifact.createdAt = timestamp; }).join("\n")).toMatch(/canonical RFC 3339 UTC/);
  }
});

test("requires exact, unique artifact inventory", () => {
  expect(errorsFor((value) => { value.evidence.capture!.files.pop(); }).join("\n")).toMatch(/exactly match/);
  expect(errorsFor((value) => { value.evidence.capture!.files.push({ path: "extra.txt", sha256: "a".repeat(64) }); }).join("\n")).toMatch(/exactly match/);
  expect(errorsFor((value) => { value.evidence.capture!.files[1].path = value.evidence.capture!.files[0].path; }).join("\n")).toMatch(/paths must be unique/);
  expect(errorsFor((value) => { value.evidence.artifacts[1].path = value.evidence.artifacts[0].path; }).join("\n")).toMatch(/artifact paths must be unique/);
});

test("records only the exact substantiated accessibility contract", () => {
  expect(manifest.accessibility.checks).toEqual([
    "document-title", "heading-order", "landmarks", "focus-visible",
    "accessible-names", "contrast", "no-horizontal-overflow", "reduced-motion",
  ]);
  expect(new Set(manifest.accessibility.checks).size).toBe(8);
  expect(validateAccessibility(manifest)).toEqual([]);
  for (const mutate of [
    (value: JourneyManifest) => { value.accessibility.checks.pop(); },
    (value: JourneyManifest) => { value.accessibility.checks.push("contrast"); },
    (value: JourneyManifest) => { value.accessibility.checks[0] = "unsubstantiated"; },
  ]) {
    const candidate = copy();
    mutate(candidate);
    expect(validateAccessibility(candidate).join("\n")).toMatch(/eight-check contract|unsupported accessibility check/);
  }
});
