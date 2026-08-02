import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const checker = path.join(repositoryRoot, "scripts/check/check-docs-sync.mjs");

type FixtureOptions = {
  packagePatch?: Record<string, unknown>;
  configPatch?: Record<string, unknown>;
  manifestPatch?: Record<string, unknown>;
};

function writeFixture(options: FixtureOptions = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-contract-"));
  fs.mkdirSync(path.join(root, "config/release"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/i18n/messages"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });

  const version = "1.2.3";
  const packageData = { name: "@fixture/product", version, ...options.packagePatch };
  const config = {
    default: "en",
    locales: [{ code: "en" }, { code: "fr" }],
    ...options.configPatch,
  };
  const manifest = {
    schemaVersion: 1,
    product: { id: "fixture-product", name: "Fixture Product", packageName: "@fixture/product" },
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
    ...options.manifestPatch,
  };

  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(packageData, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "docs/openapi.yaml"), `info:\n  version: ${version}\n`);
  fs.writeFileSync(
    path.join(root, "CHANGELOG.md"),
    `# Changelog\n\n## [Unreleased]\n\n## [${version}]\n\nRelease\n`
  );
  fs.writeFileSync(path.join(root, "config/i18n.json"), `${JSON.stringify(config, null, 2)}\n`);
  for (const locale of config.locales as { code: string }[]) {
    fs.writeFileSync(path.join(root, "src/i18n/messages", `${locale.code}.json`), "{}\n");
  }
  fs.writeFileSync(
    path.join(root, "config/release/release-contract.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return root;
}

function run(root: string, ...args: string[]) {
  return execFileSync(process.execPath, [checker, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runFailure(root: string, ...args: string[]) {
  assert.throws(
    () => run(root, ...args),
    (error: unknown) => error instanceof Error
  );
}

function removeFixture(root: string) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("validates declared release identity and ignores generated i18n output", () => {
  const root = writeFixture();
  try {
    fs.mkdirSync(path.join(root, "docs/i18n/fr"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/i18n/fr/CHANGELOG.md"), "stale generated artifact\n");
    assert.match(run(root), /PASS - all contract is consistent/);
  } finally {
    removeFixture(root);
  }
});

test("scope gates isolate release and mirror checks", () => {
  const root = writeFixture();
  try {
    fs.rmSync(path.join(root, "src/i18n/messages/fr.json"));
    assert.match(run(root, "--scope", "release"), /PASS - release contract/);
    runFailure(root, "--scope=mirrors");
  } finally {
    removeFixture(root);
  }
});

test("rejects package identity drift", () => {
  const root = writeFixture({ packagePatch: { name: "@fixture/other" } });
  try {
    runFailure(root);
  } finally {
    removeFixture(root);
  }
});

test("rejects version drift in canonical artifacts", () => {
  const root = writeFixture();
  try {
    fs.writeFileSync(path.join(root, "docs/openapi.yaml"), "info:\n  version: 9.9.9\n");
    runFailure(root, "--scope", "release");
  } finally {
    removeFixture(root);
  }
});

test("rejects malformed package versions and changelog order", () => {
  const badPackage = writeFixture({ packagePatch: { version: "not-semver" } });
  try {
    runFailure(badPackage, "--scope=release");
  } finally {
    removeFixture(badPackage);
  }
  const badChangelog = writeFixture();
  try {
    fs.writeFileSync(path.join(badChangelog, "CHANGELOG.md"), "# Changelog\n\n## [1.2.3]\n");
    runFailure(badChangelog, "--scope=release");
  } finally {
    removeFixture(badChangelog);
  }
});

test("rejects missing configured locale messages", () => {
  const root = writeFixture();
  try {
    fs.rmSync(path.join(root, "src/i18n/messages/fr.json"));
    runFailure(root, "--scope", "mirrors");
  } finally {
    removeFixture(root);
  }
});

test("enforces manifest schema and generated-docs policy", () => {
  const badSchema = writeFixture({ manifestPatch: { schemaVersion: 2 } });
  try {
    runFailure(badSchema);
  } finally {
    removeFixture(badSchema);
  }
  const badPolicy = writeFixture({
    manifestPatch: {
      i18n: {
        policy: "tracked-mirrors",
        configPath: "config/i18n.json",
        messagesPath: "src/i18n/messages",
        statePath: ".i18n-state.json",
        generatedDocsPath: "docs/i18n",
        stateMode: "optional-artifact",
      },
    },
  });
  try {
    runFailure(badPolicy);
  } finally {
    removeFixture(badPolicy);
  }
});

test("rejects lexical and realpath escapes in declared artifacts", () => {
  const lexical = writeFixture({
    manifestPatch: {
      versionSources: [
        { path: "../package.json", kind: "package" },
        { path: "docs/openapi.yaml", kind: "openapi" },
        { path: "CHANGELOG.md", kind: "changelog" },
      ],
    },
  });
  try {
    runFailure(lexical);
  } finally {
    removeFixture(lexical);
  }

  const realpath = writeFixture({
    manifestPatch: {
      versionSources: [
        { path: "package-link.json", kind: "package" },
        { path: "docs/openapi.yaml", kind: "openapi" },
        { path: "CHANGELOG.md", kind: "changelog" },
      ],
    },
  });
  const outside = path.join(os.tmpdir(), `docs-sync-outside-${process.pid}.json`);
  try {
    fs.writeFileSync(outside, "{}\n");
    fs.symlinkSync(outside, path.join(realpath, "package-link.json"));
    runFailure(realpath);
  } finally {
    removeFixture(realpath);
    fs.rmSync(outside, { force: true });
  }
});

test("rejects invalid CLI values and mismatched product selection", () => {
  const root = writeFixture();
  try {
    runFailure(root, "--unknown");
    runFailure(root, "--scope", "RELEASE");
    runFailure(root, "--product", "Fixture-Product");
    runFailure(root, "--product", "other-product");
    runFailure(root, "--scope", "all", "--scope", "release");
  } finally {
    removeFixture(root);
  }
});

test("checks only declared package artifacts", () => {
  const root = writeFixture();
  try {
    fs.mkdirSync(path.join(root, "open-sse"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "open-sse/package.json"),
      JSON.stringify({ name: "@fixture/internal", version: "9.9.9-prep.1" }) + "\n"
    );
    assert.match(run(root, "--scope=release"), /PASS - release contract/);
  } finally {
    removeFixture(root);
  }
});

test("required i18n state is enforced while ADR-0005 default remains optional", () => {
  const root = writeFixture({
    manifestPatch: {
      i18n: {
        policy: "generated-docs-ignored",
        configPath: "config/i18n.json",
        messagesPath: "src/i18n/messages",
        statePath: ".i18n-state.json",
        generatedDocsPath: "docs/i18n",
        stateMode: "required",
      },
    },
  });
  try {
    runFailure(root, "--scope=mirrors");
  } finally {
    removeFixture(root);
  }
});
