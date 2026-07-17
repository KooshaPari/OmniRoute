#!/usr/bin/env node

import { readFileSync } from "node:fs";
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
  const jobs = Object.entries(workflow?.jobs ?? {});
  const publishingJobs = jobs.filter(([, job]) => (job.steps ?? []).some((step) => typeof step?.run === "string" && /npm publish --access public --tag "\$TAG"/.test(step.run)));
  if (publishingJobs.length !== 1 || publishingJobs[0]?.[0] !== "publish") failures.push("exactly one active public publish job is required");
  const publishJob = publishingJobs[0]?.[1];
  if (!publishJob) return failures;
  const permissions = publishJob.permissions ?? {};
  if (permissions.contents !== "read" || permissions["id-token"] !== "write" || permissions.packages !== "write" || Object.keys(permissions).length !== 3) failures.push("publish permissions changed");
  const steps = publishJob.steps ?? [];
  const matches = (pattern) => steps.flatMap((step, index) => {
    if (typeof step?.run !== "string") return [];
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return [...step.run.matchAll(new RegExp(pattern.source, flags))].map(() => ({ step, index }));
  });
  const install = matches(/^npm ci --ignore-scripts --no-audit --no-fund$/m);
  const pack = matches(/npm pack --dry-run --json --ignore-scripts > "\$RUNNER_TEMP\/publication-pack\.json"/);
  const validate = matches(/node scripts\/check\/check-publication-preflight\.mjs --workflow \.github\/workflows\/npm-publish\.yml --pack-report "\$RUNNER_TEMP\/publication-pack\.json"/);
  const identity = matches(/PACKAGE_NAME="\$\(node -p \\"require\('\.\/package\.json'\)\.name\\"\)"/);
  const lookup = matches(/npm view "\$\{PACKAGE_NAME\}@\$\{VERSION\}" version/);
  const publish = matches(/npm publish --access public --tag "\$TAG"/);
  for (const [name, found] of Object.entries({ install, pack, validate, identity, lookup, publish })) if (found.length !== 1) failures.push(`exactly one active ${name} step is required`);
  for (const found of [install, pack, validate]) if (found[0]?.step?.if != null) failures.push("preflight steps must be unconditional");
  if (install[0] && pack[0] && validate[0] && publish[0] && !(install[0].index < pack[0].index && pack[0].index < validate[0].index && validate[0].index < publish[0].index)) failures.push("install, pack, validation, and publish ordering changed");
  const publishStep = publish[0]?.step;
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
