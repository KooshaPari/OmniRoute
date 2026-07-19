import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("docs sync validates opted-in mirrors without requiring bulk locale copies", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-"));
  fs.mkdirSync(path.join(root, "docs/i18n/fr"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs/i18n/de"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.2.3"}\n');
  fs.writeFileSync(path.join(root, "docs/openapi.yaml"), "info:\n  version: 1.2.3\n");
  fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n## [1.2.3]\n\nRelease\n");
  fs.writeFileSync(path.join(root, "llm.txt"), "# OmniRoute\n\nCanonical\n");
  fs.writeFileSync(path.join(root, "docs/i18n/fr/llm.txt"), "# OmniRoute (fr)\n\n---\n\nCanonical\n");
  fs.writeFileSync(path.join(root, "docs/i18n/fr/CHANGELOG.md"), "# Changelog (fr)\n\n---\n\n## [Unreleased]\n\n## [1.2.3]\n\nRelease\n");

  const script = path.resolve(import.meta.dirname, "..", "..", "scripts/check/check-docs-sync.mjs");
  const output = execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  assert.match(output, /PASS - documentation version sync is consistent/);
  fs.rmSync(root, { recursive: true, force: true });
});
