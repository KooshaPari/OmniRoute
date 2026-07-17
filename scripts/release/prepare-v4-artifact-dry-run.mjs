import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const output = path.join(root, "release-candidate");
const manifests = [
  ["web", "apps/web/package.json", "application"],
  ["bff", "apps/bff/package.json", "application"],
  ["desktop", "apps/desktop/package.json", "application"],
  ["desktop-tauri", "apps/desktop/src-tauri/tauri.conf.json", "application"],
];
const components = [];
for (const [key, relative, type] of manifests) {
  const bytes = await readFile(path.join(root, relative));
  const manifest = JSON.parse(bytes);
  if (!manifest.version) throw new Error(`${relative} has no version`);
  components.push({
    type,
    name: manifest.name || manifest.productName || key,
    version: manifest.version,
    properties: [
      { name: "omniroute:surface", value: key },
      { name: "omniroute:manifest", value: relative },
      { name: "omniroute:manifest:sha256", value: createHash("sha256").update(bytes).digest("hex") },
    ],
  });
}
const cargo = await readFile(path.join(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8");
const cargoVersion = cargo.match(/\[package\]([\s\S]*?)(?:\n\[|$)/)?.[1]?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
if (!cargoVersion) throw new Error("Cargo package version not found");
components.push({
  type: "application",
  name: "argismonitor-desktop",
  version: cargoVersion,
  properties: [{ name: "omniroute:manifest", value: "apps/desktop/src-tauri/Cargo.toml" }],
});

const versions = [...new Set(components.map(({ version }) => version))];
if (versions.length !== 1) {
  throw new Error(`v4 version mismatch: ${components.map(({ name, version }) => `${name}=${version}`).join(", ")}`);
}
const version = versions[0];

const readinessConfig = JSON.parse(
  await readFile(path.join(root, "config/release/v4-readiness.json"), "utf8"),
);
const readinessGroup = readinessConfig.versionGroups?.find(({ name }) => name === "v4-application");
if (!readinessGroup) throw new Error("v4 readiness contract has no v4-application version group");
const readinessVersions = [];
for (const member of readinessGroup.members) {
  const source = await readFile(path.join(root, member.path), "utf8");
  let memberVersion;
  if (member.format === "json") {
    memberVersion = member.field
      .split(".")
      .reduce((value, key) => value?.[key], JSON.parse(source));
  } else if (member.format === "toml-package-version") {
    const packageBlock = source.match(/\[package\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";
    memberVersion = packageBlock.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  }
  readinessVersions.push({ path: member.path, version: memberVersion ?? null });
}
if (
  readinessVersions.some(({ version: memberVersion }) => memberVersion !== version)
) {
  throw new Error(
    `artifact version ${version} disagrees with readiness contract: ${readinessVersions
      .map(({ path: memberPath, version: memberVersion }) => `${memberPath}=${memberVersion}`)
      .join(", ")}`,
  );
}

const tag = process.env.RELEASE_TAG?.trim();
if (tag && tag !== `v${version}`) {
  throw new Error(`release tag ${tag} does not match v4 version v${version}`);
}

const commit = process.env.GITHUB_SHA || "local";
const serial = Number.parseInt(createHash("sha256").update(commit).digest("hex").slice(0, 8), 16);
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:00000000-0000-4000-8000-${serial.toString(16).padStart(12, "0")}`,
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: "omniroute-v4-release-candidate",
      version,
      properties: [
        { name: "omniroute:commit", value: commit },
        { name: "omniroute:publication", value: "dry-run" },
      ],
    },
  },
  components,
};
const preflight = {
  schemaVersion: 1,
  version,
  tag: tag || null,
  commit,
  publication: false,
  signing: false,
  nativeCompatibilityChanged: false,
  npmCompatibilityChanged: false,
  readinessContract: {
    schemaVersion: readinessConfig.schemaVersion,
    versionGroup: readinessGroup.name,
    members: readinessVersions,
  },
  manifests: components.map(({ name, version, properties }) => ({ name, version, properties })),
};

await mkdir(output, { recursive: true });
await writeFile(path.join(output, "v4-preflight.json"), JSON.stringify(preflight, null, 2) + "\n");
await writeFile(path.join(output, "v4-sbom.cdx.json"), JSON.stringify(sbom, null, 2) + "\n");
console.log(`Validated v4 release candidate ${version}${tag ? ` against ${tag}` : ""}; publication disabled.`);
