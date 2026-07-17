import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const declaredChecks = [
  "document-title", "heading-order", "landmarks", "focus-visible",
  "accessible-names", "contrast", "no-horizontal-overflow", "reduced-motion",
];

const forbiddenMarkupKeys = new Set(["html", "innerhtml", "outerhtml", "markup", "rawhtml"]);

const isAsciiLetter = (character) => {
  const code = character?.toLowerCase().codePointAt(0);
  return code >= 97 && code <= 122;
};

export function containsRawMarkup(text) {
  const lower = text.toLowerCase();
  if (lower.includes("-->")) return true;
  let cursor = 0;
  while (cursor < text.length) {
    const opening = text.indexOf("<", cursor);
    if (opening === -1) return false;
    if (lower.startsWith("<!--", opening) || lower.startsWith("<!doctype", opening)) return true;
    let nameStart = opening + 1;
    if (text[nameStart] === "/") nameStart += 1;
    if (isAsciiLetter(text[nameStart]) && text.includes(">", nameStart + 1)) return true;
    cursor = opening + 1;
  }
  return false;
}

export function findForbiddenMarkup(value, location = "report", seen = new Set()) {
  const findings = [];
  if (typeof value === "string") {
    if (containsRawMarkup(value)) findings.push(`${location} contains raw HTML content`);
    return findings;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) return findings;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (forbiddenMarkupKeys.has(key.toLowerCase())) findings.push(`${childLocation} is a forbidden raw HTML field`);
    findings.push(...findForbiddenMarkup(child, childLocation, seen));
  }
  return findings;
}

const validateTopLevelEvidence = (report, assert) => {
  assert(report?.schemaVersion === 2, "schemaVersion must be 2");
  assert(Number.isInteger(report?.viewport?.width) && report.viewport.width > 0 && Number.isInteger(report?.viewport?.height) && report.viewport.height > 0, "positive viewport dimensions must be recorded");
  for (const check of declaredChecks) assert(report?.checks?.[check]?.status === "passed", `${check} must be passed`);
  assert(typeof report?.checks?.["document-title"]?.title === "string" && report.checks["document-title"].title.trim().length > 0, "document title evidence must be non-empty");
  assert(Number.isInteger(report?.checks?.["heading-order"]?.headingCount) && report.checks["heading-order"].headingCount > 0, "heading count must be a positive integer");
  assert(report?.checks?.["heading-order"]?.hasHeadingSkip === false, "heading order must not contain a skip");
  assert(report?.checks?.landmarks?.main === 1, "exactly one main landmark is required");
  assert(report?.checks?.landmarks?.navigation === 1, "exactly one navigation landmark is required");
  assert(report?.checks?.contrast?.axeRule === "color-contrast", "contrast evidence must identify color-contrast");
  assert(report?.checks?.["no-horizontal-overflow"]?.horizontalOverflow === false, "horizontal overflow must be false");
  assert(report?.checks?.["reduced-motion"]?.reducedMotion === true, "reduced motion must be enabled");
};

const validateFocusEvidence = (report, assert) => {
  const targets = report?.checks?.["focus-visible"]?.targets;
  assert(report?.checks?.["focus-visible"]?.keyboardOnly === true, "focus traversal must be keyboard-only");
  assert(Array.isArray(targets) && targets.length > 0, "focus-visible targets are required");
  for (const target of targets ?? []) {
    assert(target.focusVisible === true, "every focus target must match :focus-visible");
    assert(Array.isArray(target.changedProperties) && target.changedProperties.length > 0, "every focus target needs a style delta");
  }
  assert((targets ?? []).every((target, index) => target.index === index), "focus target inventory must be ordered and contiguous");
};

const validateAxeFinding = (finding, assert) => {
  assert(typeof finding?.id === "string" && finding.id.length > 0, "every axe finding id must be a non-empty string");
  assert(finding?.impact === null || ["minor", "moderate", "serious", "critical"].includes(finding?.impact), "every axe finding impact must be null or valid");
  assert(typeof finding?.help === "string" && finding.help.length > 0, "every axe finding help must be non-empty");
  assert(Number.isInteger(finding?.targetCount) && finding.targetCount > 0, "every axe finding targetCount must be a positive integer");
};

const validateAxeRule = (rule, assert) => {
  assert(typeof rule?.id === "string" && rule.id.length > 0, "every axe rule id must be a non-empty string");
  assert(["passed", "inapplicable"].includes(rule?.result), "every axe rule result must be passed or inapplicable");
};

const validateAxeEvidence = (report, assert) => {
  const violations = Array.isArray(report?.axe?.violations) ? report.axe.violations : [];
  const incomplete = Array.isArray(report?.axe?.incomplete) ? report.axe.incomplete : [];
  assert(Array.isArray(report?.axe?.violations) && violations.length === 0, "axe violations must be empty");
  assert(Array.isArray(report?.axe?.incomplete) && incomplete.length === 0, "axe incomplete results must be empty");
  for (const finding of [...violations, ...incomplete]) validateAxeFinding(finding, assert);
  const rules = Array.isArray(report?.axe?.rules) ? report.axe.rules : [];
  const accessibleRules = Array.isArray(report?.checks?.["accessible-names"]?.axeRules) ? report.checks["accessible-names"].axeRules : [];
  assert(Array.isArray(report?.axe?.rules), "axe rule inventory must be an array");
  assert(accessibleRules.length > 0, "accessible-name axe rule evidence is required");
  for (const rule of [...rules, ...accessibleRules]) validateAxeRule(rule, assert);
  const ids = rules.filter(({ id }) => typeof id === "string").map(({ id }) => id);
  assert(new Set(ids).size === ids.length, "axe rule inventory must be unique");
  assert(ids.every((id, index) => index === 0 || ids[index - 1].localeCompare(id) <= 0), "axe rule inventory must be sorted");
  assert(accessibleRules.every(({ id }) => ids.includes(id)), "accessible-name rules must exist in the axe inventory");
  for (const required of ["color-contrast", "button-name", "image-alt", "landmark-one-main"]) assert(ids.includes(required), `axe review ${required} is required`);
};

export function validateJourneyAccessibilityReport(report) {
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(message); };
  validateTopLevelEvidence(report, assert);
  validateFocusEvidence(report, assert);
  validateAxeEvidence(report, assert);
  errors.push(...findForbiddenMarkup(report));
  return errors;
}

const isContained = (root, target) => {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
};

export async function resolveJourneyAccessibilityReportPath(candidate, evidenceRoot = path.resolve("journey-evidence", "anonymous-home-smoke"), workingDirectory = process.cwd()) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    throw new Error("report path must be a non-empty relative path");
  }
  const resolvedRoot = path.resolve(evidenceRoot);
  const resolvedTarget = path.resolve(workingDirectory, candidate);
  if (!isContained(resolvedRoot, resolvedTarget)) throw new Error("report path escapes the journey evidence root");
  const [realRoot, realTarget] = await Promise.all([realpath(resolvedRoot), realpath(resolvedTarget)]);
  if (!isContained(realRoot, realTarget)) throw new Error("report real path escapes the journey evidence root");
  return realTarget;
}

if (process.argv[1]?.endsWith("validate-journey-accessibility-report.mjs")) {
  const file = process.argv[2];
  if (!file) throw new Error("usage: validate-journey-accessibility-report.mjs <report.json>");
  const safeFile = await resolveJourneyAccessibilityReportPath(file);
  const report = JSON.parse(await readFile(safeFile, "utf8"));
  const errors = validateJourneyAccessibilityReport(report);
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log(`Validated ${declaredChecks.length} journey accessibility checks.`);
}
