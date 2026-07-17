import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isAlias, isMap, isScalar, isSeq, parseAllDocuments, type Node } from "yaml";

function hasUnsafeGitHubExpression(expression: string): boolean {
  let inSingleQuotedString = false;
  let expressionDepth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === "'") {
      if (inSingleQuotedString && expression[index + 1] === "'") index += 1;
      else inSingleQuotedString = !inSingleQuotedString;
      continue;
    }
    if (inSingleQuotedString) continue;
    if (expression.startsWith("${{", index)) {
      if (expressionDepth > 0) return true;
      expressionDepth += 1;
      index += 2;
    } else if (expression.startsWith("}}", index)) {
      if (expressionDepth === 0) return true;
      expressionDepth -= 1;
      index += 1;
    } else if (expression[index] === '"' || expression[index] === "#") {
      return true;
    }
  }
  return inSingleQuotedString || expressionDepth !== 0;
}

function auditWorkflow(source: string): string[] {
  const failures: string[] = [];
  const documents = parseAllDocuments(source, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  const quotedRanges: Array<[number, number]> = [];
  const collectQuotedRanges = (node: Node | null | undefined): void => {
    if (!node) return;
    if (isScalar(node)) {
      if ((node.type === "QUOTE_DOUBLE" || node.type === "QUOTE_SINGLE") && node.range) {
        quotedRanges.push([node.range[0], node.range[1]]);
      }
    } else if (isSeq(node)) {
      node.items.forEach((item) => collectQuotedRanges(item as Node));
    } else if (isMap(node)) {
      node.items.forEach((pair) => {
        collectQuotedRanges(pair.key as Node);
        collectQuotedRanges(pair.value as Node);
      });
    }
  };
  documents.forEach((document) => collectQuotedRanges(document.contents as Node));
  for (let index = source.indexOf("\t"); index !== -1; index = source.indexOf("\t", index + 1)) {
    if (!quotedRanges.some(([start, end]) => index > start && index < end)) {
      failures.push(`document: structural tab at offset ${index}`);
    }
  }
  for (const [documentIndex, document] of documents.entries()) {
    for (const error of [...document.errors, ...document.warnings]) {
      failures.push(`document ${documentIndex + 1}: ${error.code}`);
    }
    const visit = (node: Node | null | undefined, location: string): void => {
      if (!node) return;
      if (isAlias(node)) {
        failures.push(`${location}: aliases and merge keys are unsupported`);
        return;
      }
      if (isSeq(node)) {
        node.items.forEach((item, index) => visit(item as Node, `${location}[${index}]`));
        return;
      }
      if (!isMap(node)) return;
      for (const [index, pair] of node.items.entries()) {
        if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
          failures.push(`${location}.${index}: mapping key must decode to a string`);
          continue;
        }
        const key = pair.key.value;
        const pairLocation = `${location}.${key}`;
        if (key === "<<") {
          failures.push(`${pairLocation}: merge keys are unsupported`);
          continue;
        }
        if (key === "if") {
          if (!isScalar(pair.value) || typeof pair.value.value !== "string") {
            failures.push(`${pairLocation}: if value must decode to a string scalar`);
          } else if (hasUnsafeGitHubExpression(pair.value.value)) {
            failures.push(`${pairLocation}: unsafe GitHub expression`);
          }
        } else {
          visit(pair.value as Node, pairLocation);
        }
      }
    };
    visit(document.contents as Node, `document[${documentIndex}]`);
  }
  return failures;
}

test("semantic YAML parsing finds if keys and fails closed on unsupported syntax", () => {
  const safe = [
    "if: ${{ github.event_name == 'push' }}",
    'if: ${{ contains(fromJSON(\'["push", "pull_request"]\'), github.event_name) }}',
    "if: ${{ contains('}}', github.ref) && contains('${{', github.ref) }}",
    "if: ${{ github.event_name == 'push' }} # ${{ github.ref == \"comment\" }}",
    '"if": "${{ github.event_name == \'push\' }}"',
    "'if': ${{ github.event_name == 'push' }}",
    "\"\\u0069f\": ${{ github.event_name == 'push' }}",
    'if: "${{ success() }}\t"',
    "jobs: { test: { 'if': \"${{ github.event_name == 'push' }}\", runs-on: ubuntu-latest } }",
    "jobs:\n  test:\n    if: >-2 # legal reverse indicators\n      github.event_name == 'push'\n      && success()",
    "---\nif: ${{ success() }}\n---\nif: ${{ failure() }}",
  ];
  const unsafe = [
    'if: ${{ github.event_name == "push" }}',
    '"if": ${{ github.event_name == "push" }}',
    "'if': ${{ github.event_name == \"push\" }}",
    "- 'if': ${{ github.event_name == \"push\" }}",
    'jobs: { test: { "if": "github.event_name == \\"push\\"" } }',
    "if: ${{ github.event_name == 'push' }} && github.ref == \"refs/heads/main\"",
    "if: ${{ contains('}}', github.ref) && github.event_name == \"push\" }}",
    "if: ${{ github.event_name == 'push'",
    "if: github.event_name == 'push' }}",
    "if: |\t# tabbed separator\n  github.event_name == 'push'",
    "if: ${{ success() }} #\tcomment tab",
    "if: [success()]",
    "if:\n  nested: value",
    "if: true",
    "if: !custom ${{ success() }}",
    "if: &condition ${{ success() }}\ncopy: *condition",
    "defaults: &defaults\n  if: ${{ success() }}\njob:\n  <<: *defaults",
    "if: ${{ success() }}\nif: ${{ failure() }}",
    "? [if]\n: ${{ success() }}",
    "if: \"${{ github.event_name == 'push' }}\" trailing",
  ];
  safe.forEach((source) => assert.deepEqual(auditWorkflow(source), [], source));
  unsafe.forEach((source) => assert.notDeepEqual(auditWorkflow(source), [], source));
});

test("all workflow documents use safe GitHub expression string literals", async () => {
  const directory = path.resolve(".github/workflows");
  const failures: string[] = [];
  for (const name of await readdir(directory)) {
    if (!/\.ya?ml$/.test(name)) continue;
    const source = await readFile(path.join(directory, name), "utf8");
    failures.push(...auditWorkflow(source).map((failure) => `${name}: ${failure}`));
  }
  assert.deepEqual(failures, []);
});
