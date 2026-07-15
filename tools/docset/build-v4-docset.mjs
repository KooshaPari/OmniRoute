import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const contractPath = path.join(root, "config/docset/v4-docset.json");
const contractBytes = await readFile(contractPath);
const contract = JSON.parse(contractBytes);
const sourceCommit = process.env.SOURCE_COMMIT;
const versionManifestBytes = await readFile(path.join(root, contract.versionSource));
const version = JSON.parse(versionManifestBytes).version;
if (!version) throw new Error("Version source has no version");
if (contract.schemaVersion !== 1) throw new Error("Unsupported docset contract");
if (!/^[0-9a-f]{40}$/.test(sourceCommit || "")) throw new Error("SOURCE_COMMIT must be the exact checked-out commit SHA");
if (contract.reviewedInputs.length === 0 && contract.publication.deployable) {
  throw new Error("An empty docset cannot be deployable");
}
if (contract.reviewedInputs.length === 0 && contract.publication.releaseAttachable) {
  throw new Error("An empty docset cannot be release-attachable");
}
if (contract.publication.deployable || contract.publication.releaseAttachable) {
  throw new Error("Owner-gated docset cannot be deployable or release-attachable");
}
const reviewedInputs = await Promise.all(contract.reviewedInputs.map(async (input) => {
  const bytes = await readFile(path.join(root, input));
  return { path: input, sha256: createHash("sha256").update(bytes).digest("hex") };
}));

const artifactRoot = path.join(root, "docset-artifact");
const stage = path.join(artifactRoot, "stage");
const archiveName = contract.releaseAttachment.filenameTemplate.replace("{version}", version);
const archivePath = path.join(artifactRoot, archiveName);

if (process.argv.includes("--finalize")) {
  const archive = await readFile(archivePath);
  const sha256 = createHash("sha256").update(archive).digest("hex");
  const attachment = {
    schemaVersion: 1,
    docsetId: contract.docsetId,
    version,
    sourceCommit,
    filename: archiveName,
    mediaType: contract.releaseAttachment.mediaType,
    size: (await stat(archivePath)).size,
    sha256,
    releaseAttachable: contract.publication.releaseAttachable,
    deployment: false,
    reviewedInputs: contract.reviewedInputs,
    reviewedInputSha256: reviewedInputs,
  };
  await writeFile(`${archivePath}.sha256`, `${sha256}  ${archiveName}\n`);
  await writeFile(
    path.join(artifactRoot, archiveName.replace(/\.tar\.gz$/, ".attachment.json")),
    JSON.stringify(attachment, null, 2) + "\n"
  );
  console.log(`Finalized ${archiveName}; releaseAttachable=${attachment.releaseAttachable}`);
  process.exit(0);
}

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const provenance = {
  schemaVersion: 1,
  docsetId: contract.docsetId,
  version,
  sourceCommit,
  contractSha256: createHash("sha256").update(contractBytes).digest("hex"),
  versionSource: contract.versionSource,
  versionSourceSha256: createHash("sha256").update(versionManifestBytes).digest("hex"),
  reviewedInputs: contract.reviewedInputs,
  reviewedInputSha256: reviewedInputs,
  excludedInputs: contract.excludedInputs,
  deployable: contract.publication.deployable,
  releaseAttachable: contract.publication.releaseAttachable,
  reason: contract.publication.reason,
};
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline documentation scaffold</title></head><body><main><h1>Offline documentation scaffold</h1><p><a href="./docs/public/QUICKSTART_V4.md">Reviewed v4 local Quickstart</a></p><p>This artifact is evidence of reviewed content and the docset build contract. It is not approved for deployment or release attachment.</p></main></body></html>\n`;
await writeFile(path.join(stage, "index.html"), html);
await writeFile(path.join(stage, "search-index.json"), JSON.stringify(reviewedInputs, null, 2) + "\n");
await writeFile(path.join(stage, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
for (const input of reviewedInputs) {
  const destination = path.join(stage, input.path);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(root, input.path), destination);
}
console.log(`Prepared non-deployable docset ${contract.docsetId} ${version} with ${contract.reviewedInputs.length} reviewed input(s).`);
