import assert from "node:assert/strict";
import test from "node:test";
import { declaredChecks, validateJourneyAccessibilityReport } from "../../scripts/docs/validate-journey-accessibility-report.mjs";

const valid = () => ({
  schemaVersion: 2,
  viewport: { width: 1280, height: 800 },
  checks: Object.fromEntries(declaredChecks.map((check) => [check, { status: "passed" }])) as Record<string, unknown>,
  axe: { violations: [] as unknown[], incomplete: [] as unknown[], rules: ["button-name", "color-contrast", "image-alt", "landmark-one-main"].map((id) => ({ id, result: "passed" })) },
});

test("accepts complete journey accessibility evidence", () => {
  const report = valid();
  report.checks.landmarks = { status: "passed", main: 1, navigation: 1 };
  report.checks["focus-visible"] = { status: "passed", targets: [{ index: 0, focusVisible: true, changedProperties: ["outlineWidth"] }] };
  assert.deepEqual(validateJourneyAccessibilityReport(report), []);
});

test("rejects missing checks, axe review gaps, focus gaps, and raw HTML", () => {
  const report = valid() as ReturnType<typeof valid> & { html?: string };
  report.checks.landmarks = { status: "passed", main: 1, navigation: 1 };
  report.checks["focus-visible"] = { status: "passed", targets: [] };
  report.axe.incomplete = [{ id: "color-contrast" }];
  report.html = "<main>unsafe</main>";
  delete report.checks.contrast;
  const errors = validateJourneyAccessibilityReport(report).join("\n");
  assert.match(errors, /contrast must be passed/);
  assert.match(errors, /focus-visible targets are required/);
  assert.match(errors, /axe incomplete results must be empty/);
  assert.match(errors, /raw HTML fields are forbidden/);
});
