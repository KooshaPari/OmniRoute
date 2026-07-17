import { expect } from "@playwright/test";
import { mkdtemp, mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { declaredChecks, resolveJourneyAccessibilityReportPath, validateJourneyAccessibilityReport } from "../../scripts/docs/validate-journey-accessibility-report.mjs";

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
  expect(validateJourneyAccessibilityReport(report)).toEqual([]);
});

test("rejects missing checks, axe review gaps, focus gaps, and raw HTML", () => {
  const report = valid() as ReturnType<typeof valid> & { html?: string };
  report.checks.landmarks = { status: "passed", main: 1, navigation: 1 };
  report.checks["focus-visible"] = { status: "passed", targets: [] };
  report.axe.incomplete = [{ id: "color-contrast" }];
  report.html = "<main>unsafe</main>";
  delete report.checks.contrast;
  const errors = validateJourneyAccessibilityReport(report).join("\n");
  expect(errors).toMatch(/contrast must be passed/);
  expect(errors).toMatch(/focus-visible targets are required/);
  expect(errors).toMatch(/axe incomplete results must be empty/);
  expect(errors).toMatch(/raw HTML fields are forbidden/);
});

test("confines report reads to the real journey evidence root", async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), "journey-report-boundary-"));
  const root = path.join(sandbox, "journey-evidence", "anonymous-home-smoke");
  const sibling = path.join(sandbox, "journey-evidence", "anonymous-home-smoke-copy");
  const outside = path.join(sandbox, "outside");
  await Promise.all([mkdir(root, { recursive: true }), mkdir(sibling, { recursive: true }), mkdir(outside, { recursive: true })]);
  const validPath = path.join(root, "accessibility-smoke.json");
  const siblingPath = path.join(sibling, "accessibility-smoke.json");
  const outsidePath = path.join(outside, "accessibility-smoke.json");
  await Promise.all([validPath, siblingPath, outsidePath].map((file) => writeFile(file, "{}\n")));
  try {
    await expect(resolveJourneyAccessibilityReportPath("journey-evidence/anonymous-home-smoke/accessibility-smoke.json", root, sandbox)).resolves.toBe(await realpath(validPath));
    await expect(resolveJourneyAccessibilityReportPath("../outside/accessibility-smoke.json", root, sandbox)).rejects.toThrow(/escapes|relative/);
    await expect(resolveJourneyAccessibilityReportPath(outsidePath, root)).rejects.toThrow(/relative/);
    await expect(resolveJourneyAccessibilityReportPath("journey-evidence/anonymous-home-smoke-copy/accessibility-smoke.json", root, sandbox)).rejects.toThrow(/escapes/);

    const link = path.join(root, "linked-outside");
    try {
      await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
      await expect(resolveJourneyAccessibilityReportPath("journey-evidence/anonymous-home-smoke/linked-outside/accessibility-smoke.json", root, sandbox)).rejects.toThrow(/real path escapes/);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") t.diagnostic("symlink creation unavailable; realpath guard remains covered on supported platforms");
      else throw error;
    }
  } finally { /* temporary directory is owned by the operating system */ }
});
