import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseDocument, stringify } from "yaml";
import { validatePublicationPreflight } from "../../scripts/check/check-publication-preflight.mjs";

const workflowSource = readFileSync(new URL("../../.github/workflows/npm-publish.yml", import.meta.url), "utf8");
const safeWorkflowSource = readFileSync(new URL("../../.github/workflows/publication-preflight.yml", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const packReports = [{ name: manifest.name, version: manifest.version, filename: `${manifest.name}-${manifest.version}.tgz`, files: Object.values(manifest.bin).map((path) => ({ path })) }];
const validate = (workflow = workflowSource, pack = packReports, packageManifest = manifest) => validatePublicationPreflight({ workflowSource: workflow, manifest: packageManifest, packReports: pack });
const mutateWorkflow = (mutation) => {
  const workflow = parseDocument(workflowSource, { strict: true, uniqueKeys: true }).toJS();
  mutation(workflow.jobs.publish.steps);
  return stringify(workflow);
};
const mutateStep = (id, mutation) => mutateWorkflow((steps) => mutation(steps.find((step) => step.id === id)));

test("accepts the active publication contract", () => assert.deepEqual(validate(), []));
test("safe workflow has read-only authority and no publish or upload step", () => {
  const workflow = parseDocument(safeWorkflowSource, { strict: true, uniqueKeys: true }).toJS();
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const runs = Object.values(workflow.jobs).flatMap((job) => job.steps).map((step) => step.run ?? step.uses ?? "").join("\n");
  assert.doesNotMatch(runs, /npm publish|id-token|NODE_AUTH_TOKEN|upload-artifact/);
});
test("comments cannot satisfy a removed frozen install", () => assert.ok(validate(mutateStep("frozen_install", (step) => { step.run = `# ${step.run}\nnpm install --ignore-scripts`; })).length));
test("dead preflight steps are rejected", () => assert.ok(validate(mutateStep("pack_report", (step) => { step.if = "${{ false }}"; })).length));
test("duplicate publish commands are ambiguous", () => assert.ok(validate(mutateStep("publish_npm", (step) => { step.run += '\nnpm publish --access public --tag "$TAG"'; })).length));
test("wrong ordering is rejected", () => assert.ok(validate(mutateWorkflow((steps) => { const pack = steps.findIndex((step) => step.id === "pack_report"); const install = steps.findIndex((step) => step.id === "frozen_install"); [steps[pack], steps[install]] = [steps[install], steps[pack]]; })).some((failure) => /ordering/.test(failure))));
test("wrong registry identity is rejected", () => assert.ok(validate(mutateStep("resolve", (step) => { step.run = step.run.replace('${PACKAGE_NAME}@${VERSION}', 'omniroute@${VERSION}'); })).length));
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
for (const [name, injected] of [
  ["uncalled function", "unused() { npm ci --ignore-scripts --no-audit --no-fund; }\n"],
  ["quoted heredoc", "cat <<'EOF'\nignored\nEOF\n"],
  ["unquoted heredoc", "cat <<EOF\nignored\nEOF\n"],
  ["leading exit", "exit 0\n"],
  ["false and", "false && echo ignored\n"],
]) test(`rejects ${name} in the canonical resolve scalar`, () => assert.ok(validate(mutateStep("resolve", (step) => { step.run = injected + step.run; })).length));
test("rejects command substitution in an exact command scalar", () => assert.ok(validate(mutateStep("pack_report", (step) => { step.run = step.run.replace(" >", " $(echo extra) >"); })).length));
test("rejects duplicate IDs and steps", () => assert.ok(validate(workflowSource.replace("      - name: Generate publication pack report", "      - name: Duplicate frozen install\n        id: frozen_install\n        run: npm ci --ignore-scripts --no-audit --no-fund\n\n      - name: Generate publication pack report")).some((failure) => /unique|exactly one/.test(failure))));
