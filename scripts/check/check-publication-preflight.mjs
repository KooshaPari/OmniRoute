#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const requiredBins = ["argismonitor", "omniroute"];

export function validatePublicationPreflight({ workflowSource, manifest, packReports }) {
  const failures = [];
  let workflow;
  try {
    const document = parseDocument(workflowSource, { prettyErrors: false, strict: true, uniqueKeys: true });
    if (document.errors.length) throw document.errors[0];
    workflow = document.toJS();
  } catch (error) {
    return [`npm publish workflow is malformed YAML: ${error instanceof Error ? error.message : String(error)}`];
  }

  if (typeof manifest.name !== "string" || !manifest.name.trim()) failures.push("root package name must be non-empty");
  if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) failures.push("root package version must be publishable semver");
  for (const bin of requiredBins) if (typeof manifest.bin?.[bin] !== "string" || !manifest.bin[bin]) failures.push(`root package must expose ${bin} bin`);

  const trigger = workflow?.on;
  if (!trigger?.release?.types?.includes("released") || !trigger?.workflow_dispatch || !trigger?.workflow_call) failures.push("publish triggers changed");
  const publishJob = workflow?.jobs?.publish;
  if (!publishJob) failures.push("active publish job is required");
  if (!publishJob) return failures;
  const permissions = publishJob.permissions ?? {};
  if (permissions.contents !== "read" || permissions["id-token"] !== "write" || permissions.packages !== "write" || Object.keys(permissions).length !== 3) failures.push("publish permissions changed");
  const steps = publishJob.steps ?? [];
  const ids = steps.map((step) => step?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) failures.push("publish step IDs must be unique");
  const required = ["frozen_install", "pack_report", "publication_preflight", "resolve", "publish_npm"];
  const byId = Object.fromEntries(required.map((id) => [id, steps.filter((step) => step?.id === id)]));
  for (const id of required) if (byId[id].length !== 1) failures.push(`exactly one ${id} step is required`);
  const exactCommands = {
    frozen_install: "npm ci --ignore-scripts --no-audit --no-fund",
    pack_report: 'npm pack --dry-run --json --ignore-scripts > "$RUNNER_TEMP/publication-pack.json"',
    publication_preflight: 'node scripts/check/check-publication-preflight.mjs --workflow .github/workflows/npm-publish.yml --pack-report "$RUNNER_TEMP/publication-pack.json"',
  };
  for (const [id, command] of Object.entries(exactCommands)) {
    const step = byId[id][0];
    if (step?.run !== command || step?.if != null) failures.push(`${id} command or execution gate changed`);
  }
  const indices = required.map((id) => steps.findIndex((step) => step?.id === id));
  if (indices.some((index) => index < 0) || !indices.every((index, position) => position === 0 || indices[position - 1] < index)) failures.push("publication step ordering changed");
  const hash = (value) => createHash("sha256").update(value ?? "").digest("hex");
  if (hash(byId.resolve[0]?.run) !== "d2450180f2dae448d93b79c0a7f09dd694797445d4ab2d8995b3fce36df8d78d") failures.push("resolve command scalar changed");
  if (hash(byId.publish_npm[0]?.run) !== "915e70e44bb48364e5175d8c3c53148822ca93a7c7aa4ee25aab2b5f9664cbc1") failures.push("public publish command scalar changed");
  const publishStep = byId.publish_npm[0];
  if (publishStep?.if !== "steps.resolve.outputs.skip != 'true'" || publishStep?.env?.NODE_AUTH_TOKEN !== "${{ secrets.NPM_TOKEN }}") failures.push("publish gate or token authority changed");

  const report = Array.isArray(packReports) && packReports.length === 1 ? packReports[0] : null;
  if (!report) failures.push("pack report must contain exactly one package");
  else {
    if (report.name !== manifest.name) failures.push("pack name does not match manifest");
    if (report.version !== manifest.version) failures.push("pack version does not match manifest");
    const paths = new Set((report.files ?? []).map((file) => file.path));
    for (const bin of requiredBins) if (!paths.has(manifest.bin?.[bin])) failures.push(`pack listing is missing ${bin} bin target`);
    if (typeof report.filename !== "string" || !report.filename.includes(manifest.version)) failures.push("pack filename does not contain version");
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  const workflowPath = args.get("--workflow");
  const packPath = args.get("--pack-report");
  if (!workflowPath || !packPath) {
    console.error("usage: check-publication-preflight.mjs --workflow <path> --pack-report <path>");
    process.exit(2);
  }
  let packReports;
  try { packReports = JSON.parse(readFileSync(resolve(root, packPath), "utf8")); } catch (error) { console.error(`malformed pack JSON: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
  const failures = validatePublicationPreflight({ workflowSource: readFileSync(resolve(root, workflowPath), "utf8"), manifest: JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")), packReports });
  if (failures.length) { failures.forEach((failure) => console.error(`publication preflight failed: ${failure}`)); process.exit(1); }
  console.log("publication preflight passed");
}
