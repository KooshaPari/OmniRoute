import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const companionDir = join(repoRoot, "@omniroute", "local-models");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const LOCAL_MODEL_DEPS = [
  "@atjsh/llmlingua-2",
  "@huggingface/transformers",
  "@tensorflow/tfjs",
  "js-tiktoken",
] as const;

test("local-models companion owns the optional local inference dependency closure", () => {
  assert.ok(existsSync(companionDir), "local-models companion package must exist");

  const pkg = readJson<{
    name: string;
    private?: boolean;
    license?: string;
    dependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
  }>(join(companionDir, "package.json"));

  assert.equal(pkg.name, "@omniroute/local-models");
  assert.notEqual(pkg.private, true, "companion must be publishable for explicit installation");
  assert.equal(pkg.license, "MIT", "companion metadata must declare its shipped license");
  assert.ok(existsSync(join(companionDir, "LICENSE")), "companion must ship its license text");
  for (const dependency of LOCAL_MODEL_DEPS) {
    assert.ok(pkg.dependencies?.[dependency], `${dependency} must belong to the companion`);
  }
  assert.ok(pkg.exports?.["./transformers"], "companion must expose the embeddings loader");
  assert.ok(pkg.exports?.["./llmlingua"], "companion must expose the compression loader");
});

test("base package excludes the local-model dependency closure from manifest and lock", () => {
  const rootPkg = readJson<{
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  }>(join(repoRoot, "package.json"));
  const lock = readJson<{ packages: Record<string, unknown> }>(join(repoRoot, "package-lock.json"));

  for (const dependency of LOCAL_MODEL_DEPS) {
    assert.equal(
      rootPkg.dependencies?.[dependency],
      undefined,
      `${dependency} must not be a base dependency`
    );
    assert.equal(
      rootPkg.optionalDependencies?.[dependency],
      undefined,
      `${dependency} must not be an implicit base optional dependency`
    );
  }

  const localModelLockEntries = Object.keys(lock.packages).filter(
    (entry) =>
      entry.includes("@atjsh/llmlingua-2") ||
      entry.includes("@huggingface/transformers") ||
      entry.includes("@tensorflow/tfjs") ||
      entry.includes("js-tiktoken") ||
      entry.includes("onnxruntime-")
  );
  assert.deepEqual(
    localModelLockEntries,
    [],
    "base package lock must exclude the local-model closure"
  );
});

test("runtime loaders resolve only the explicitly-installed companion", () => {
  const transformerLoader = readFileSync(
    join(repoRoot, "src", "lib", "memory", "embedding", "transformersLocal.ts"),
    "utf8"
  );
  const llmlinguaWorker = readFileSync(
    join(repoRoot, "open-sse", "services", "compression", "engines", "llmlingua", "onnxWorker.ts"),
    "utf8"
  );

  assert.match(transformerLoader, /@omniroute\/local-models\/transformers/);
  assert.doesNotMatch(transformerLoader, /import\("@huggingface\/transformers"\)/);
  assert.match(llmlinguaWorker, /@omniroute\/local-models\/llmlingua/);
  assert.doesNotMatch(llmlinguaWorker, /dynamicImport\("@huggingface\/transformers"\)/);
});
