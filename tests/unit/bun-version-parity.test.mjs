import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkBunParity } from "../../scripts/check/check-v4-bun-version.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "bun-parity-"));
  for (const relative of ["package.json", "package-lock.json", ".github/workflows"])
    await cp(relative, path.join(root, relative), { recursive: true });
  for (const relative of ["packages/api-contracts", "packages/design-tokens", "apps/bff", "apps/web", "apps/desktop", "sveltekit-dashboard", "desktop-electrobun"])
    await cp(relative, path.join(root, relative), { recursive: true, filter: (source) => !source.includes("node_modules") && !source.includes("src-tauri") });
  return root;
}

async function replace(file, from, to) {
  const source = await readFile(file, "utf8");
  assert.ok(source.includes(from), `fixture must include ${from}`);
  await writeFile(file, source.replace(from, to));
}

test("accepts the repository Bun parity contract", async () => {
  assert.deepEqual(await checkBunParity(process.cwd()), []);
});

test("rejects floating types, stale runtime/platform locks, and workflow pins", async () => {
  const root = await fixture();
  await replace(path.join(root, "apps/bff/package.json"), '"@types/bun": "1.3.14"', '"@types/bun": "latest"');
  await replace(path.join(root, "package-lock.json"), '"node_modules/bun": {\n      "version": "1.3.14"', '"node_modules/bun": {\n      "version": "1.3.10"');
  const platform = Object.keys(JSON.parse(await readFile(path.join(root, "package-lock.json"))).packages).find((key) => key.startsWith("node_modules/@oven/bun-"));
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json")));
  lock.packages[platform].version = "1.3.10";
  await writeFile(path.join(root, "package-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  assert.ok((await readdir(path.join(root, ".github/workflows"))).includes("ci.yml"));
  await replace(path.join(root, ".github/workflows/ci.yml"), "bun-version: 1.3.14", "bun-version: 1.3.10");
  const failures = await checkBunParity(root);
  assert.ok(failures.some((failure) => failure.includes("@types/bun")));
  assert.ok(failures.some((failure) => failure.includes("resolved Bun")));
  assert.ok(failures.some((failure) => failure.includes("@oven/bun-")));
  assert.ok(failures.some((failure) => failure.includes("ci.yml pins Bun 1.3.10")));
});
