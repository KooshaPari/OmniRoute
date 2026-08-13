import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");

test("ADR 0005 declares generated documentation mirrors as optional artifacts", () => {
  const adr = fs.readFileSync(
    path.join(repositoryRoot, "docs/adr/0005-i18n-gitignore-strategy.md"),
    "utf8",
  );

  assert.match(adr, /> Status: \*\*Accepted\*\*/);
  assert.match(adr, /\*\*Gitignore the entire `docs\/i18n\/` tree\*\* and any i18n sidecar files\./);
  assert.match(adr, /CI\/CD pipeline regenerates the content as a build artifact\./);
  assert.match(adr, /i18n is a build output, not a build input\./);
});

test("docs sync ignores generated i18n mirror artifacts per ADR 0005", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-"));
  const version = "3.8.38";
  fs.mkdirSync(path.join(root, "config/release"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/i18n/messages"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"omniroute","version":"3.8.38"}\n');
  fs.writeFileSync(path.join(root, "docs/openapi.yaml"), `info:\n  version: ${version}\n`);
  fs.writeFileSync(
    path.join(root, "CHANGELOG.md"),
    `# Changelog\n\n## [Unreleased]\n\n## [${version}]\n\nRelease\n`
  );
  fs.writeFileSync(
    path.join(root, "config/i18n.json"),
    JSON.stringify({ default: "en", locales: [{ code: "en" }, { code: "fr" }] }) + "\n"
  );
  fs.writeFileSync(path.join(root, "src/i18n/messages/en.json"), "{}\n");
  fs.writeFileSync(path.join(root, "src/i18n/messages/fr.json"), "{}\n");
  fs.writeFileSync(
    path.join(root, "config/release/release-contract.json"),
    JSON.stringify({
      schemaVersion: 1,
      product: { id: "omniroute", name: "OmniRoute", packageName: "omniroute" },
      versionSources: [
        { path: "package.json", kind: "package" },
        { path: "docs/openapi.yaml", kind: "openapi" },
        { path: "CHANGELOG.md", kind: "changelog" },
      ],
      i18n: {
        policy: "generated-docs-ignored",
        configPath: "config/i18n.json",
        messagesPath: "src/i18n/messages",
        statePath: ".i18n-state.json",
        generatedDocsPath: "docs/i18n",
        stateMode: "optional-artifact",
      },
    }) + "\n"
  );
  const script = path.join(repositoryRoot, "scripts/check/check-docs-sync.mjs");
  const assertContractPasses = () => {
    for (const scope of ["mirrors", "all"]) {
      const output = execFileSync(process.execPath, [script, "--scope", scope], {
        cwd: root,
        encoding: "utf8",
      });
      assert.match(output, new RegExp(`PASS - ${scope} contract is consistent`));
      assert.doesNotMatch(output, /i18n mirror|i18n translation/);
    }
  };

  assertContractPasses();
  fs.mkdirSync(path.join(root, "docs/i18n/fr"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/i18n/fr/llm.txt"), "stale generated mirror\n");
  fs.writeFileSync(path.join(root, "docs/i18n/fr/CHANGELOG.md"), "stale generated mirror\n");
  assertContractPasses();
  fs.rmSync(root, { recursive: true, force: true });
});

test("docs sync remains strict for canonical version inputs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-canonical-"));
  fs.mkdirSync(path.join(root, "config/release"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"omniroute","version":"1.2.3"}\n');
  fs.writeFileSync(path.join(root, "docs/openapi.yaml"), "info:\n  version: 9.9.9\n");
  fs.writeFileSync(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## [1.2.3]\n");
  fs.writeFileSync(path.join(root, "llm.txt"), "# OmniRoute\n");
  fs.writeFileSync(
    path.join(root, "config/release/release-contract.json"),
    JSON.stringify({
      schemaVersion: 1,
      product: { id: "omniroute", name: "OmniRoute", packageName: "omniroute" },
      versionSources: [
        { path: "package.json", kind: "package" },
        { path: "docs/openapi.yaml", kind: "openapi" },
        { path: "CHANGELOG.md", kind: "changelog" },
      ],
      i18n: {
        policy: "generated-docs-ignored",
        configPath: "config/i18n.json",
        messagesPath: "src/i18n/messages",
        generatedDocsPath: "docs/i18n",
      },
    }) + "\n"
  );

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
