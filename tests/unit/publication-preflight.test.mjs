import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseDocument } from "yaml";
import { validatePublicationPreflight } from "../../scripts/check/check-publication-preflight.mjs";

const workflowSource = readFileSync(new URL("../../.github/workflows/npm-publish.yml", import.meta.url), "utf8");
const safeWorkflowSource = readFileSync(new URL("../../.github/workflows/publication-preflight.yml", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const packReports = [{ name: manifest.name, version: manifest.version, filename: `${manifest.name}-${manifest.version}.tgz`, files: Object.values(manifest.bin).map((path) => ({ path })) }];
const validate = (workflow = workflowSource, pack = packReports, packageManifest = manifest) => validatePublicationPreflight({ workflowSource: workflow, manifest: packageManifest, packReports: pack });

test("accepts the active publication contract", () => assert.deepEqual(validate(), []));
test("safe workflow has read-only authority and no publish or upload step", () => {
  const workflow = parseDocument(safeWorkflowSource, { strict: true, uniqueKeys: true }).toJS();
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const runs = Object.values(workflow.jobs).flatMap((job) => job.steps).map((step) => step.run ?? step.uses ?? "").join("\n");
  assert.doesNotMatch(runs, /npm publish|id-token|NODE_AUTH_TOKEN|upload-artifact/);
});
test("comments cannot satisfy a removed frozen install", () => assert.match(validate(workflowSource.replace("run: npm ci --ignore-scripts --no-audit --no-fund", "# run: npm ci --ignore-scripts --no-audit --no-fund\n        run: npm install --ignore-scripts"))[0], /install/));
test("dead preflight steps are rejected", () => assert.ok(validate(workflowSource.replace("- name: Generate publication pack report", "- name: Generate publication pack report\n        if: ${{ false }}")).some((failure) => /unconditional/.test(failure))));
test("duplicate publish commands are ambiguous", () => assert.ok(validate(workflowSource.replace("npm publish --access public --tag \"$TAG\"", "npm publish --access public --tag \"$TAG\"\n          npm publish --access public --tag \"$TAG\"")).some((failure) => /publish/.test(failure))));
test("wrong ordering is rejected", () => assert.ok(validate(workflowSource.replace('run: npm pack --dry-run --json --ignore-scripts > "$RUNNER_TEMP/publication-pack.json"', "run: true").replace('run: npm ci --ignore-scripts --no-audit --no-fund', 'run: |\n          npm ci --ignore-scripts --no-audit --no-fund\n          npm pack --dry-run --json --ignore-scripts > "$RUNNER_TEMP/publication-pack.json"')).some((failure) => /ordering/.test(failure))));
test("wrong registry identity is rejected", () => assert.ok(validate(workflowSource.replace('npm view "${PACKAGE_NAME}@${VERSION}"', 'npm view "omniroute@${VERSION}"')).some((failure) => /lookup/.test(failure))));
test("missing bin is rejected", () => assert.ok(validate(workflowSource, [{ ...packReports[0], files: [] }]).some((failure) => /bin target/.test(failure))));
test("malformed pack shape is rejected", () => assert.ok(validate(workflowSource, {}).some((failure) => /exactly one/.test(failure))));
test("malformed pack JSON is rejected by the CLI", () => {
  const directory = mkdtempSync(join(tmpdir(), "publication-preflight-"));
  const report = join(directory, "pack.json");
  writeFileSync(report, "not-json");
  const result = spawnSync(process.execPath, ["scripts/check/check-publication-preflight.mjs", "--workflow", ".github/workflows/npm-publish.yml", "--pack-report", report], { encoding: "utf8" });
  rmSync(directory, { recursive: true, force: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /malformed pack JSON/);
});
