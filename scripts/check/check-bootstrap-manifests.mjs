import { readFile } from "node:fs/promises";

const requiredFiles = ["package.json", "package-lock.json", "tsconfig.json"];
const requiredTextFiles = [".npmrc"];
const documents = new Map();

for (const file of requiredFiles) {
  try {
    documents.set(file, JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`bootstrap manifest check failed: ${file}: ${detail}`);
    process.exitCode = 1;
  }
}

for (const file of requiredTextFiles) {
  try {
    const contents = await readFile(file, "utf8");
    if (!contents.includes("legacy-peer-deps=true")) {
      throw new Error("must preserve the repository peer dependency policy");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`bootstrap manifest check failed: ${file}: ${detail}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  const packageManifest = documents.get("package.json");
  const lockfile = documents.get("package-lock.json");
  const tsconfig = documents.get("tsconfig.json");
  const lockRoot = lockfile.packages?.[""];
  const failures = [];

  if (lockfile.lockfileVersion !== 3) failures.push("package-lock.json must use lockfileVersion 3");
  if (!lockRoot) failures.push("package-lock.json must contain a root package entry");
  if (lockRoot?.name !== packageManifest.name) failures.push("package name differs from lockfile root");
  if (lockRoot?.version !== packageManifest.version) failures.push("package version differs from lockfile root");
  if (!packageManifest.scripts?.build) failures.push("package.json is missing scripts.build");
  if (!packageManifest.scripts?.["typecheck:core"]) failures.push("package.json is missing scripts.typecheck:core");
  if (!tsconfig.compilerOptions) failures.push("tsconfig.json is missing compilerOptions");

  if (failures.length > 0) {
    for (const failure of failures) console.error(`bootstrap manifest check failed: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("bootstrap manifests are present, parseable, and coherent");
  }
}
