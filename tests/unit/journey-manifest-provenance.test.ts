import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  validateAccessibility,
  validateEvidence,
  validateProvenance,
  validateRepository,
} from "../../scripts/docs/validate-journey-manifests.mjs";

const manifest = JSON.parse(
  await readFile(
    new URL("../../docs/journeys/manifests/anonymous-landing-smoke.json", import.meta.url)
  )
);
const copy = () => structuredClone(manifest);
const errorsFor = (mutate: (candidate: any) => void) => {
  const candidate = copy();
  mutate(candidate);
  return validateEvidence(candidate);
};

test("accepts the truthful blocked current-main manifest", async () => {
  assert.deepEqual(validateEvidence(manifest), []);
  assert.deepEqual(validateAccessibility(manifest), []);
  assert.deepEqual(await validateRepository(), { errors: [], count: 1 });
});

test("rejects captured status without immutable linkage", () => {
  assert.match(
    errorsFor((value) => {
      value.evidence.captureStatus = "captured";
    }).join("\n"),
    /needs capture linkage/
  );
});

test("rejects unsupported publication claims", () => {
  assert.match(
    errorsFor((value) => {
      value.evidence.captureStatus = "published";
    }).join("\n"),
    /invalid evidence status/
  );
});

test("requires an exact unique artifact inventory", () => {
  const candidate = copy();
  candidate.evidence.captureStatus = "captured";
  candidate.evidence.blocker = null;
  candidate.evidence.capture = {
    sourceCommit: "a".repeat(40),
    workflowRunId: "1",
    artifact: {
      id: "2",
      name: `anonymous-landing-smoke-${"a".repeat(40)}`,
      createdAt: "2026-07-18T00:00:00Z",
      expiresAt: "2026-08-01T00:00:00Z",
    },
    files: candidate.evidence.artifacts.map((artifact: any) => ({
      path: artifact.path,
      sha256: "b".repeat(64),
    })),
  };
  assert.deepEqual(validateEvidence(candidate), []);
  candidate.evidence.capture.files.pop();
  assert.match(validateEvidence(candidate).join("\n"), /exactly match/);
});

test("rejects noncanonical timestamps and malformed identifiers", () => {
  const base = copy();
  base.evidence.captureStatus = "captured";
  base.evidence.blocker = null;
  base.evidence.capture = {
    sourceCommit: "bad",
    workflowRunId: "0",
    artifact: { id: "x", name: "bad", createdAt: "July 18", expiresAt: "2026-08-01T00:00:00Z" },
    files: [],
  };
  const errors = validateEvidence(base).join("\n");
  assert.match(errors, /sourceCommit/);
  assert.match(errors, /workflowRunId/);
  assert.match(errors, /canonical RFC 3339 UTC/);
});

test("guards malformed provenance before path and string operations", async () => {
  const root = path.join(os.tmpdir(), `journey-provenance-${crypto.randomUUID()}`);
  await mkdir(path.join(root, "tests"), { recursive: true });
  await writeFile(
    path.join(root, "tests", "journey.spec.ts"),
    "test('capture', () => page.goto('/landing'));\n"
  );
  const errors: string[] = [];
  const record = (condition: unknown, file: string, message: string) => {
    if (!condition) errors.push(`${file}: ${message}`);
  };
  await validateProvenance(
    root,
    { provenance: { baseBranch: "main", testFile: undefined }, steps: [] },
    "manifest.json",
    errors,
    record
  );
  assert.ok(errors.some((error) => error.includes("must reference tests/")));
});

test("requires the exact eight-check accessibility contract", () => {
  const candidate = copy();
  candidate.accessibility.checks.pop();
  assert.match(validateAccessibility(candidate).join("\n"), /eight-check contract/);
});
