import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createScanner, preProcessFile, ScriptTarget, SyntaxKind } from "typescript";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const API_ROOT = path.join(SOURCE_ROOT, "app", "api");
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];
const ROUTE_SOURCE = /^route\.(?:ts|tsx|js|mjs)$/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(entryPath)
      : entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))
        ? [entryPath]
        : [];
  });
}

function resolveLocalSource(importer: string, specifier: string): string | undefined {
  const base = specifier.startsWith("@/")
    ? path.join(SOURCE_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(importer), specifier)
      : undefined;

  if (!base) return undefined;

  const candidates = [
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function compiledApiClosure(): string[] {
  const visited = new Set<string>();
  const pending = sourceFiles(API_ROOT).filter((file) => ROUTE_SOURCE.test(path.basename(file)));

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);

    const source = readFileSync(file, "utf8");
    for (const imported of preProcessFile(source, true, true).importedFiles) {
      const dependency = resolveLocalSource(file, imported.fileName);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return [...visited].sort();
}

function tokenHazards(file: string): { comment: boolean; nonComment: boolean } {
  const scanner = createScanner(ScriptTarget.Latest, false, undefined, readFileSync(file, "utf8"));
  let comment = false;
  let nonComment = false;

  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (!scanner.getTokenText().includes("\u2500")) continue;

    if (
      token === SyntaxKind.SingleLineCommentTrivia ||
      token === SyntaxKind.MultiLineCommentTrivia
    ) {
      comment = true;
    } else {
      nonComment = true;
    }
  }

  return { comment, nonComment };
}

test("backend-only API route static import closure contains no U+2500 comment tokens", () => {
  const offenders = compiledApiClosure()
    .filter((file) => tokenHazards(file).comment)
    .map((file) => path.relative(SOURCE_ROOT, file));

  assert.deepEqual(
    offenders,
    [],
    `U+2500 in a statically imported API-route comment can panic Next/Turbopack code-frame rendering:\n${offenders.join("\n")}`
  );
});

test("backend-only API route static import closure reports U+2500 outside comments without rewriting it", (t) => {
  const offenders = compiledApiClosure()
    .filter((file) => tokenHazards(file).nonComment)
    .map((file) => path.relative(SOURCE_ROOT, file));

  t.diagnostic(
    `Non-comment U+2500 is intentionally out of scope for comment-token normalization:\n${offenders.join("\n")}`
  );
});
