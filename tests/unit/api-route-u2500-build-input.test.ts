import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");
const ROUTE_SOURCE = /^route\.(?:ts|tsx|js|mjs)$/;

function routeSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return routeSources(entryPath);
    }

    return entry.isFile() && ROUTE_SOURCE.test(entry.name) ? [entryPath] : [];
  });
}

test("compiled API route handlers contain no U+2500 code-frame hazard", () => {
  const offenders = routeSources(API_ROOT)
    .filter((file) => readFileSync(file, "utf8").includes("\u2500"))
    .map((file) => path.relative(API_ROOT, file))
    .sort();

  assert.deepEqual(
    offenders,
    [],
    `U+2500 box-drawing comments can panic Next/Turbopack code-frame rendering in backend-only builds:\n${offenders.join("\n")}`
  );
});
