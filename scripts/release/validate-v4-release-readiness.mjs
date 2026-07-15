import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const configPath = path.join(root, "config/release/v4-readiness.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const findings = [];

const add = (control, passed, evidence) => findings.push({ control, passed, evidence });
const getField = (object, field) => field.split(".").reduce((value, key) => value?.[key], object);

for (const group of config.versionGroups) {
  const values = [];
  for (const member of group.members) {
    const source = await readFile(path.join(root, member.path), "utf8");
    let value;
    if (member.format === "json") {
      value = getField(JSON.parse(source), member.field);
    } else if (member.format === "toml-package-version") {
      const packageBlock = source.match(/\[package\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";
      value = packageBlock.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    }
    values.push({ path: member.path, value: value ?? null });
  }
  const distinct = [...new Set(values.map(({ value }) => value))];
  add(`version-group:${group.name}`, distinct.length === 1 && distinct[0] !== null, values);
}

const workflow = await readFile(path.join(root, config.releaseWorkflow), "utf8");
const actionUses = [...workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
const unpinned = actionUses.filter((use) => {
  const ref = use.split("@")[1] ?? "";
  return !/^[0-9a-f]{40}$/.test(ref);
});
add("pinned-actions", actionUses.length > 0 && unpinned.length === 0, { actionUses, unpinned });
add("frozen-installs", /bun install[^\n]*--frozen-lockfile/.test(workflow), "release workflow must use frozen lockfiles");
add("checksums", /sha256sum|SHA256SUMS/i.test(workflow), "release workflow must emit checksums for artifacts");
add("sbom", /\bsbom\b|cyclonedx|syft/i.test(workflow), "release workflow must produce an SBOM");
add("provenance", /attest-build-provenance|slsa|provenance/i.test(workflow), "release workflow must produce verifiable provenance");
add("no-secret-repository-clone", !/actions\/checkout@[^\n]+[\s\S]{0,240}token:\s*\$\{\{\s*secrets\./.test(workflow), "release must use the triggering checkout without a secret-backed second clone");
add("tag-version-validation", /github\.ref_name[\s\S]{0,500}(package\.json|tauri\.conf|Cargo\.toml)|verify[^\n]*version/i.test(workflow), "tag/version agreement must be checked before artifacts are built");

const independentSurfaces = [];
for (const surface of config.independentSurfaces) {
  const source = await readFile(path.join(root, surface.path), "utf8");
  independentSurfaces.push({
    path: surface.path,
    reason: surface.reason,
    sha256: createHash("sha256").update(source).digest("hex"),
  });
}

const report = {
  schemaVersion: 1,
  repository: "KooshaPari/OmniRoute",
  commit: process.env.GITHUB_SHA || null,
  ready: findings.every(({ passed }) => passed),
  findings,
  independentSurfaces,
};
const outDir = path.join(root, "release-readiness");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "v4-release-readiness.json"), JSON.stringify(report, null, 2) + "\n");
for (const finding of findings) {
  console.log(`${finding.passed ? "PASS" : "BLOCK"} ${finding.control}`);
}
console.log(`V4 release ready: ${report.ready}`);
if (process.argv.includes("--strict") && !report.ready) process.exit(1);
