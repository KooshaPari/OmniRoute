import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

function stripYamlComment(value: string): string {
  const trimmed = value.trimStart();
  if (trimmed[0] === '"') {
    let escaped = false;
    for (let index = 1; index < trimmed.length; index += 1) {
      if (trimmed[index] === '"' && !escaped) {
        const remainder = trimmed.slice(index + 1).trimStart();
        return !remainder || remainder.startsWith("#") ? trimmed.slice(0, index + 1) : '"';
      }
      if (trimmed[index] === "\\" && !escaped) escaped = true;
      else escaped = false;
    }
    return trimmed; // Unterminated YAML quoting is rejected by unwrapping.
  }
  if (trimmed[0] === "'") {
    for (let index = 1; index < trimmed.length; index += 1) {
      if (trimmed[index] !== "'") continue;
      if (trimmed[index + 1] === "'") {
        index += 1;
        continue;
      }
      const remainder = trimmed.slice(index + 1).trimStart();
      return !remainder || remainder.startsWith("#") ? trimmed.slice(0, index + 1) : '"';
    }
    return trimmed;
  }
  let inExpressionString = false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "'") {
      if (inExpressionString && value[index + 1] === "'") index += 1;
      else inExpressionString = !inExpressionString;
    } else if (
      value[index] === "#" &&
      !inExpressionString &&
      (index === 0 || /\s/.test(value[index - 1]))
    ) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

function unwrapYamlQuotedScalar(value: string): string {
  let trimmed = value.trim();
  while (/^(?:![^\s]+|&[A-Za-z0-9_-]+)\s+/.test(trimmed)) {
    trimmed = trimmed.replace(/^(?:![^\s]+|&[A-Za-z0-9_-]+)\s+/, "");
  }
  if (/^[{[*]/.test(trimmed) || /\t/.test(trimmed)) return '"';
  if (trimmed.length < 2 || trimmed[0] !== trimmed.at(-1)) return trimmed;
  if (trimmed[0] === '"') {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return '"'; // Invalid YAML-style quoting fails closed.
    }
  }
  if (trimmed[0] === "'") return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed;
}

function hasUnsafeExpressionScalar(rawScalar: string): boolean {
  const scalar = unwrapYamlQuotedScalar(stripYamlComment(rawScalar));
  let inSingleQuotedString = false;
  let openExpressions = 0;
  for (let index = 0; index < scalar.length; index += 1) {
    if (scalar[index] === "'") {
      if (inSingleQuotedString && scalar[index + 1] === "'") index += 1;
      else inSingleQuotedString = !inSingleQuotedString;
      continue;
    }
    if (inSingleQuotedString) continue;
    if (scalar.startsWith("${{", index)) {
      openExpressions += 1;
      index += 2;
    } else if (scalar.startsWith("}}", index)) {
      if (openExpressions === 0) return true;
      openExpressions -= 1;
      index += 1;
    } else if (scalar[index] === '"' || scalar[index] === "#") {
      return true;
    }
  }
  return inSingleQuotedString || openExpressions !== 0;
}

function collectIfScalars(lines: string[]): Array<{ line: number; scalar: string }> {
  const scalars: Array<{ line: number; scalar: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index].replace(/\r$/, "");
    const match = currentLine.match(/^(\s*)(?:-\s*)?(?:if|"if"|'if')\s*:\s*(.*)$/);
    if (!match) {
      const inline = currentLine.match(/(?:^|[{,])\s*(?:if|"if"|'if')\s*:\s*(.*)$/);
      if (!inline) {
        if (/^\s*(?:-\s*)?(?:\?|[!*&][^\s:]*)\s*(?:if|"if"|'if')?\s*:/.test(currentLine)) {
          scalars.push({ line: index + 1, scalar: '"' });
        }
        continue;
      }
      let inSingleQuotedString = false;
      let expressionDepth = 0;
      let end = inline[1].length;
      for (let offset = 0; offset < inline[1].length; offset += 1) {
        if (inline[1][offset] === "'") {
          if (inSingleQuotedString && inline[1][offset + 1] === "'") offset += 1;
          else inSingleQuotedString = !inSingleQuotedString;
        } else if (!inSingleQuotedString && inline[1].startsWith("${{", offset)) {
          expressionDepth += 1;
          offset += 2;
        } else if (!inSingleQuotedString && inline[1].startsWith("}}", offset)) {
          expressionDepth -= 1;
          offset += 1;
        } else if (
          !inSingleQuotedString &&
          expressionDepth === 0 &&
          /[,}]/.test(inline[1][offset])
        ) {
          end = offset;
          break;
        }
      }
      scalars.push({ line: index + 1, scalar: inline[1].slice(0, end) });
      continue;
    }
    if (currentLine.includes("\t")) {
      scalars.push({ line: index + 1, scalar: '"' });
      continue;
    }
    const block = match[2].match(/^([>|])(?:(?:[+-][1-9]?)|(?:[1-9][+-]?))?\s*(?:#.*)?$/);
    if (!block) {
      scalars.push({
        line: index + 1,
        scalar: lines[index].includes("\t") || /^[>|]/.test(match[2]) ? '"' : match[2],
      });
      continue;
    }
    const indentation = match[1].length;
    const content: string[] = [];
    while (index + 1 < lines.length) {
      const continuation = lines[index + 1].replace(/\r$/, "");
      const continuationIndentation = continuation.match(/^\s*/)?.[0].length ?? 0;
      if (continuation.trim() && continuationIndentation <= indentation) break;
      content.push(continuation.includes("\t") ? '"' : continuation.trim());
      index += 1;
    }
    scalars.push({ line: index + 1, scalar: content.join(block[1] === ">" ? " " : "\n") });
  }
  return scalars;
}

test("workflow expression scanner handles adversarial scalar syntax", () => {
  const safe = [
    "if: ${{ github.event_name == 'push' }}",
    'if: ${{ contains(fromJSON(\'["push", "pull_request"]\'), github.event_name) }}',
    "if: ${{ contains('}}', github.ref) && github.event_name == 'push' }}",
    "if: ${{ github.event_name == 'push' }} # ${{ github.ref == \"unsafe-comment\" }}",
    "if: \"${{ github.event_name == 'push' }}\"",
    "\"if\": ${{ github.event_name == 'push' }}",
    "'if': ${{ github.event_name == 'push' }}",
    "- \"if\": ${{ github.event_name == 'push' }}",
    "if: \"${{ contains('}}', github.ref) && github.event_name == 'push' }}\" # YAML comment",
    "if: '${{ contains(''}}'', github.ref) && github.event_name == ''push'' }}'",
    "if: &condition ${{ github.event_name == 'push' }}",
    "if: !expression ${{ github.event_name == 'push' }}",
    "if: ${{ contains('${{', github.ref) && contains('}}', github.ref) }}",
    "- if: ${{ github.event_name == 'push' }}",
    "if: ${{ github.event_name == 'push' }} && ${{ github.ref == 'refs/heads/main' }}",
    "if: ${{ format('owner''s \"quoted\" value') == 'expected' }}",
    "jobs: { test: { if: ${{ fromJSON('{\"enabled\": true}').enabled }}, runs-on: ubuntu-latest } }",
    "jobs: { test: { 'if': ${{ github.event_name == 'push' }}, runs-on: ubuntu-latest } }",
  ];
  const unsafe = [
    "if: ${{ github.event_name == 'push' }} && github.ref == \"refs/heads/main\"",
    "if: ${{ contains('}}', github.ref) && github.event_name == \"push\" }}",
    'if: ${{ github.event_name == "push" }}',
    "if: ${{ github.event_name == 'push }}",
    "if: ${{ github.event_name == 'push'",
    "if: github.event_name == 'push' }}",
    "if: [success()]",
    "if: *condition",
    "if: github.ref == refs/heads/main#fragment",
    "if:\t${{ github.event_name == 'push' }}",
    '\"if\": ${{ github.event_name == "push" }}',
    "'if': ${{ github.event_name == \"push\" }}",
    "- 'if': ${{ github.event_name == \"push\" }}",
    'jobs: { test: { "if": ${{ github.event_name == "push" }}, runs-on: ubuntu-latest } }',
    "if: \"${{ github.event_name == 'push' }}\" trailing",
    "if: '${{ github.event_name == ''push'' }}' &trailing",
    "? if: ${{ github.event_name == 'push' }}",
    "*if: ${{ github.event_name == 'push' }}",
    "!tag if: ${{ github.event_name == 'push' }}",
    "&anchor if: ${{ github.event_name == 'push' }}",
  ];
  assert.deepEqual(
    collectIfScalars(safe).filter(({ scalar }) => hasUnsafeExpressionScalar(scalar)),
    []
  );
  assert.equal(
    collectIfScalars(unsafe).filter(({ scalar }) => hasUnsafeExpressionScalar(scalar)).length,
    unsafe.length
  );

  const safeBlock = [
    "jobs:",
    "  test:",
    "    if: > # reason",
    "      github.event_name == 'push'",
    "      && success()",
  ];
  const unsafeBlock = [
    "jobs:",
    "  test:",
    "    if: | # reason",
    '      github.event_name == "push"',
  ];
  const terminatedBlock = [
    "jobs:\r",
    "  test:\r",
    "    if: | # reason\r",
    "      github.event_name == 'push'\r",
    '    name: "not part of the scalar"\r',
  ];
  assert.equal(hasUnsafeExpressionScalar(collectIfScalars(safeBlock)[0].scalar), false);
  assert.equal(hasUnsafeExpressionScalar(collectIfScalars(unsafeBlock)[0].scalar), true);
  assert.equal(hasUnsafeExpressionScalar(collectIfScalars(terminatedBlock)[0].scalar), false);

  const indicators = [
    "",
    "+",
    "-",
    ...Array.from({ length: 9 }, (_, index) => `${index + 1}`),
    ...Array.from({ length: 9 }, (_, index) => `+${index + 1}`),
    ...Array.from({ length: 9 }, (_, index) => `-${index + 1}`),
    ...Array.from({ length: 9 }, (_, index) => `${index + 1}+`),
    ...Array.from({ length: 9 }, (_, index) => `${index + 1}-`),
  ];
  for (const style of ["|", ">"] as const) {
    for (const indicator of indicators) {
      const scalar = collectIfScalars([
        "jobs:",
        `  if: ${style}${indicator} # legal header`,
        "    github.event_name == 'push'",
      ]);
      assert.equal(scalar.length, 1, `${style}${indicator} should be collected`);
      assert.equal(
        hasUnsafeExpressionScalar(scalar[0].scalar),
        false,
        `${style}${indicator} should scan`
      );
    }
  }
  for (const invalid of ["|0", ">0", "|++", ">--", "|1+2", ">+2-"]) {
    assert.equal(hasUnsafeExpressionScalar(collectIfScalars([`if: ${invalid}`])[0].scalar), true);
  }
  assert.equal(
    hasUnsafeExpressionScalar(
      collectIfScalars(["if: |-2", "  github.event_name ==\t'push'"])[0].scalar
    ),
    true
  );
  assert.equal(
    hasUnsafeExpressionScalar(
      collectIfScalars(["if: |\t# tabbed separator", "  github.event_name == 'push'"])[0].scalar
    ),
    true
  );
});

test("GitHub Actions if expressions use single-quoted string literals", async () => {
  const directory = path.resolve(".github/workflows");
  const failures: string[] = [];
  for (const name of await readdir(directory)) {
    if (!/\.ya?ml$/.test(name)) continue;
    const lines = (await readFile(path.join(directory, name), "utf8")).split("\n");
    for (const { line, scalar } of collectIfScalars(lines)) {
      if (!scalar || hasUnsafeExpressionScalar(scalar)) failures.push(`${name}:${line}`);
    }
  }
  assert.deepEqual(failures, []);
});
