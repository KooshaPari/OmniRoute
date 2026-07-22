import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");

test("ADR 0005 atomically excludes generated documentation mirrors from git", () => {
  const adr = fs.readFileSync(
    path.join(repositoryRoot, "docs/adr/0005-i18n-gitignore-strategy.md"),
    "utf8",
  );
  const gitignore = fs.readFileSync(path.join(repositoryRoot, ".gitignore"), "utf8");
  const trackedMirrors = execFileSync("git", ["ls-files", "docs/i18n/**"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();

  assert.match(adr, /> Status: \*\*Accepted\*\*/);
  assert.match(gitignore, /^\/docs\/i18n\/$/m);
  assert.match(gitignore, /^\/docs\/_audit\.json$/m);
  assert.match(gitignore, /^\/docs\/_pending-keys\.json$/m);
  assert.match(gitignore, /^\/scripts\/i18n\/_cache\/$/m);
  assert.equal(trackedMirrors, "", "generated mirrors must be entirely untracked");
});

test("docs sync ignores generated i18n mirror artifacts per ADR 0005", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-"));
  fs.mkdirSync(path.join(root, "docs/i18n/fr"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs/i18n/de"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.2.3"}\n');
  fs.writeFileSync(path.join(root, "docs/openapi.yaml"), "info:\n  version: 1.2.3\n");
  fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n## [1.2.3]\n\nRelease\n");
  fs.writeFileSync(path.join(root, "llm.txt"), "# OmniRoute\n\nCanonical\n");
  fs.writeFileSync(path.join(root, "docs/i18n/fr/llm.txt"), "stale generated mirror\n");
  fs.writeFileSync(path.join(root, "docs/i18n/fr/CHANGELOG.md"), "stale generated mirror\n");

  const script = path.join(repositoryRoot, "scripts/check/check-docs-sync.mjs");
  const output = execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  assert.match(output, /PASS - documentation version sync is consistent/);
  assert.doesNotMatch(output, /i18n mirror|i18n translation/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("docs sync remains strict for canonical version inputs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-canonical-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.2.3"}\n');
  fs.writeFileSync(path.join(root, "docs/openapi.yaml"), "info:\n  version: 9.9.9\n");
  fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## [1.2.3]\n");
  fs.writeFileSync(path.join(root, "llm.txt"), "# OmniRoute\n");

  const script = path.join(repositoryRoot, "scripts/check/check-docs-sync.mjs");
  assert.throws(
    () => execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8", stdio: "pipe" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const commandError = error as Error & { stderr?: Buffer; stdout?: Buffer };
      assert.match(
        `${String(commandError.stdout)}\n${String(commandError.stderr)}`,
        /OpenAPI version .* differs from package\.json/i,
      );
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});
