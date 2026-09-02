// Regression guard for the missing cli-skill-collector catalog entry
// (#710): cli-skill-collector was added to CLI_SKILL_IDS, the tests, and the
// generated skills/**, but the CURATED_SKILLS entry was missing. That made
// getCatalog() return 20 CLI skills instead of 21 and broke four catalog tests.
import { test } from "node:test";
import assert from "node:assert";
import { getCatalog, filterCatalog, computeCoverage, CLI_SKILL_IDS } from "../../src/lib/agentSkills/catalog";

test("getCatalog() contains exactly 21 cli skills", () => {
  const cliSkills = getCatalog().filter((s) => s.category === "cli");
  assert.equal(cliSkills.length, 21);
});

test("filterCatalog({ category: 'cli' }) returns 21 cli skills", () => {
  const skills = filterCatalog({ category: "cli" });
  assert.equal(skills.length, 21);
});

test("cli-skill-collector exists in catalog with expected area", () => {
  const skill = getCatalog().find((s) => s.id === "cli-skill-collector");
  assert.ok(skill, "cli-skill-collector missing from catalog");
  assert.equal(skill.category, "cli");
  assert.equal(skill.area, "cli-skill-collector");
});

test("computeCoverage() returns valid 21-skill CLI total", () => {
  const cov = computeCoverage();
  assert.equal(cov.cli.total, 21);
  assert.ok(cov.cli.have >= 0 && cov.cli.have <= 21);
});
