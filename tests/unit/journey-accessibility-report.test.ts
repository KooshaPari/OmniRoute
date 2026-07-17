import { expect, test } from "bun:test";
import { mkdtemp, mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { containsRawMarkup, resolveJourneyAccessibilityReportPath, validateJourneyAccessibilityReport } from "../../scripts/docs/validate-journey-accessibility-report.mjs";

const valid = () => ({
  schemaVersion: 2,
  viewport: { width: 1280, height: 800 },
  checks: {
    "document-title": { status: "passed", title: "argismonitor v4" },
    "heading-order": { status: "passed", headingCount: 2, hasHeadingSkip: false },
    landmarks: { status: "passed", main: 1, navigation: 1 },
    "focus-visible": { status: "passed", keyboardOnly: true, targets: [{ index: 0, focusVisible: true, changedProperties: ["outlineWidth"] }] },
    "accessible-names": { status: "passed", axeRules: [{ id: "button-name", result: "passed" }] },
    contrast: { status: "passed", axeRule: "color-contrast" },
    "no-horizontal-overflow": { status: "passed", horizontalOverflow: false },
    "reduced-motion": { status: "passed", reducedMotion: true },
  } as Record<string, any>,
  axe: { violations: [] as unknown[], incomplete: [] as unknown[], rules: ["button-name", "color-contrast", "image-alt", "landmark-one-main"].map((id) => ({ id, result: "passed" })) },
});

test("accepts complete journey accessibility evidence", () => {
  const report = valid();
  expect(validateJourneyAccessibilityReport(report)).toEqual([]);
});

test("rejects missing checks, axe review gaps, focus gaps, and raw HTML", () => {
  const report = valid() as ReturnType<typeof valid> & { html?: string };
  report.checks["focus-visible"] = { status: "passed", targets: [] };
  report.axe.incomplete = [{ id: "color-contrast" }];
  report.html = "<main>unsafe</main>";
  delete report.checks.contrast;
  const errors = validateJourneyAccessibilityReport(report).join("\n");
  expect(errors).toMatch(/contrast must be passed/);
  expect(errors).toMatch(/focus-visible targets are required/);
  expect(errors).toMatch(/axe incomplete results must be empty/);
  expect(errors).toMatch(/forbidden raw HTML field/);
});

test("rejects contradictory evidence and malformed axe inventories", () => {
  const report = valid();
  report.checks["document-title"].title = " ";
  report.checks["heading-order"].headingCount = 0;
  report.checks["heading-order"].hasHeadingSkip = true;
  report.checks["no-horizontal-overflow"].horizontalOverflow = true;
  report.checks["reduced-motion"].reducedMotion = false;
  report.axe.rules = [{ id: "button-name", result: "failed" }, { result: "passed" } as any];
  const errors = validateJourneyAccessibilityReport(report).join("\n");
  expect(errors).toMatch(/document title evidence must be non-empty/);
  expect(errors).toMatch(/heading count must be a positive integer/);
  expect(errors).toMatch(/heading order must not contain a skip/);
  expect(errors).toMatch(/horizontal overflow must be false/);
  expect(errors).toMatch(/reduced motion must be enabled/);
  expect(errors).toMatch(/every axe rule id must be a non-empty string/);
  expect(errors).toMatch(/every axe rule result must be passed or inapplicable/);
});

test("rejects malformed axe findings before enforcing zero findings", () => {
  const report = valid();
  report.axe.violations = [{ id: "", impact: "unknown", help: "", targetCount: -1 }];
  const errors = validateJourneyAccessibilityReport(report).join("\n");
  expect(errors).toMatch(/axe violations must be empty/);
  expect(errors).toMatch(/every axe finding id must be a non-empty string/);
  expect(errors).toMatch(/every axe finding impact must be null or valid/);
  expect(errors).toMatch(/every axe finding help must be non-empty/);
  expect(errors).toMatch(/every axe finding targetCount must be a positive integer/);
});

test("rejects forbidden markup structurally without false-positive html text", () => {
  expect(validateJourneyAccessibilityReport({ ...valid(), note: 'the word "html" is legal' })).toEqual([]);
  for (const tamper of [
    { innerHTML: "safe-looking" },
    { nested: { markup: "safe-looking" } },
    { note: "<main>opening tag</main>" },
    { note: "closing only </main>" },
    { note: "<!-- comment -->" },
    { note: "<!DOCTYPE html>" },
  ]) expect(validateJourneyAccessibilityReport({ ...valid(), ...tamper }).join("\n")).toMatch(/raw HTML/);
});

test("scans markup deterministically without regex backtracking", () => {
  for (const legal of [
    "plain html text", "2 < 3 and 4 > 1", "unfinished <", "unfinished <main", "unfinished </main", "< main>", "<123>",
    "https://example.test/?q=%3Cmain%3E", "<é>", "<😀>", "😀 < 3", "x".repeat(100_000),
  ]) {
    expect(containsRawMarkup(legal)).toBe(false);
  }
  for (const markup of [
    "<main>", "</main>", "<custom-element data-x='1'/>", "<ScRiPt>alert(1)</sCrIpT>", "<!--open", "closed-->",
    "<!DOCTYPE html>", "<!DoCtYpE HTML>",
  ]) {
    expect(containsRawMarkup(markup)).toBe(true);
  }
  expect(containsRawMarkup("<".repeat(100_000))).toBe(false);
});

test("confines report reads to the real journey evidence root", async () => {
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
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }
  } finally { /* temporary directory is owned by the operating system */ }
});
