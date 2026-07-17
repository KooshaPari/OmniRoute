import { readFile } from "node:fs/promises";
import process from "node:process";

export const declaredChecks = [
  "document-title", "heading-order", "landmarks", "focus-visible",
  "accessible-names", "contrast", "no-horizontal-overflow", "reduced-motion",
];

export function validateJourneyAccessibilityReport(report) {
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(message); };
  assert(report?.schemaVersion === 2, "schemaVersion must be 2");
  assert(Number.isInteger(report?.viewport?.width) && Number.isInteger(report?.viewport?.height), "viewport must be recorded");
  for (const check of declaredChecks) assert(report?.checks?.[check]?.status === "passed", `${check} must be passed`);
  assert(report?.checks?.landmarks?.main === 1, "exactly one main landmark is required");
  assert(report?.checks?.landmarks?.navigation === 1, "exactly one navigation landmark is required");
  const targets = report?.checks?.["focus-visible"]?.targets;
  assert(Array.isArray(targets) && targets.length > 0, "focus-visible targets are required");
  for (const target of targets ?? []) {
    assert(target.focusVisible === true, "every focus target must match :focus-visible");
    assert(Array.isArray(target.changedProperties) && target.changedProperties.length > 0, "every focus target needs a style delta");
  }
  assert((targets ?? []).every((target, index) => target.index === index), "focus target inventory must be ordered and contiguous");
  assert(Array.isArray(report?.axe?.violations) && report.axe.violations.length === 0, "axe violations must be empty");
  assert(Array.isArray(report?.axe?.incomplete) && report.axe.incomplete.length === 0, "axe incomplete results must be empty");
  const reviewedRules = report?.axe?.rules?.map(({ id }) => id) ?? [];
  assert(new Set(reviewedRules).size === reviewedRules.length, "axe rule inventory must be unique");
  assert(reviewedRules.every((id, index) => index === 0 || reviewedRules[index - 1].localeCompare(id) <= 0), "axe rule inventory must be sorted");
  for (const rule of ["color-contrast", "button-name", "image-alt", "landmark-one-main"]) assert(reviewedRules.includes(rule), `axe review ${rule} is required`);
  assert(!JSON.stringify(report).includes('"html"'), "raw HTML fields are forbidden");
  return errors;
}

if (process.argv[1]?.endsWith("validate-journey-accessibility-report.mjs")) {
  const file = process.argv[2];
  if (!file) throw new Error("usage: validate-journey-accessibility-report.mjs <report.json>");
  const report = JSON.parse(await readFile(file, "utf8"));
  const errors = validateJourneyAccessibilityReport(report);
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log(`Validated ${declaredChecks.length} journey accessibility checks.`);
}
