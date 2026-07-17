import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

function hasUnsafeDoubleQuotedLiteral(expression: string): boolean {
  let inSingleQuotedString = false;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === "'") {
      if (inSingleQuotedString && expression[index + 1] === "'") {
        index += 1;
      } else {
        inSingleQuotedString = !inSingleQuotedString;
      }
    } else if ((character === '"' || character === "#") && !inSingleQuotedString) {
      return true;
    }
  }
  return inSingleQuotedString;
}

function unsafeIfExpressions(line: string): string[] {
  if (!/^\s*if\s*:/.test(line)) return [];
  const expressions: string[] = [];
  if (!line.includes("${{")) {
    const scalar = line.replace(/^\s*if\s*:\s*/, "");
    let inSingleQuotedString = false;
    let comment = scalar.length;
    for (let index = 0; index < scalar.length; index += 1) {
      if (scalar[index] === "'") inSingleQuotedString = !inSingleQuotedString;
      if (scalar[index] === "#" && !inSingleQuotedString) {
        comment = index;
        break;
      }
    }
    if (hasUnsafeDoubleQuotedLiteral(scalar.slice(0, comment))) expressions.push(scalar.trim());
    return expressions;
  }
  for (let start = line.indexOf("${{"); start !== -1; start = line.indexOf("${{", start)) {
    const end = line.indexOf("}}", start + 3);
    if (end === -1) {
      expressions.push("unterminated expression");
      break;
    }
    const expression = line.slice(start + 3, end);
    if (hasUnsafeDoubleQuotedLiteral(expression)) expressions.push(expression.trim());
    start = end + 2;
  }
  return expressions;
}

test("workflow expression detection distinguishes syntax from quoted data and comments", () => {
  const safe = [
    "if: ${{ github.event_name == 'push' }}",
    'if: ${{ contains(fromJSON(\'["push", "pull_request"]\'), github.event_name) }}',
    "if: ${{ github.event_name == 'push' }} # note: \"quoted text is not expression syntax\"",
    "if: ${{ format('owner''s \"quoted\" value') == 'expected' }}",
    "if: ${{ github.event_name == 'push' }} && ${{ github.ref == 'refs/heads/main' }}",
  ];
  const unsafe = [
    'if: ${{ github.event_name == "push" }}',
    'if: ${{ startsWith(github.ref, "refs/tags/") }}',
    "if: ${{ github.event_name == 'push' # expressions do not support comments }}",
    "if: ${{ github.event_name == 'push }}",
    "if: ${{ github.event_name == 'push'",
  ];

  assert.deepEqual(safe.flatMap(unsafeIfExpressions), []);
  assert.equal(unsafe.flatMap(unsafeIfExpressions).length, unsafe.length);
  assert.equal(hasUnsafeDoubleQuotedLiteral("github.event_name == 'push'\n&& success()"), false);
  assert.equal(hasUnsafeDoubleQuotedLiteral('github.event_name == "push"\n&& success()'), true);
});

test("GitHub Actions if expressions use single-quoted string literals", async () => {
  const directory = path.resolve(".github/workflows");
  const failures: string[] = [];
  for (const name of await readdir(directory)) {
    if (!/\.ya?ml$/.test(name)) continue;
    const lines = (await readFile(path.join(directory, name), "utf8")).split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const block = line.match(/^(\s*)if\s*:\s*[>|][+-]?\s*$/);
      if (block) {
        const indentation = block[1].length;
        const scalar: string[] = [];
        while (index + 1 < lines.length) {
          const continuation = lines[index + 1];
          const continuationIndentation = continuation.match(/^\s*/)?.[0].length ?? 0;
          if (continuation.trim() && continuationIndentation <= indentation) break;
          scalar.push(continuation.trim());
          index += 1;
        }
        if (scalar.length === 0 || hasUnsafeDoubleQuotedLiteral(scalar.join("\n"))) {
          failures.push(`${name}:${index + 1}`);
        }
      } else if (unsafeIfExpressions(line).length > 0) {
        failures.push(`${name}:${index + 1}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
