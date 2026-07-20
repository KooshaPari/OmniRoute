import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflowPath = new URL("../../.github/workflows/claude.yml", import.meta.url);
const workflow = readFileSync(workflowPath, "utf8");

test("Claude workflow actions use repository-policy-approved immutable SHAs", () => {
  assert.match(workflow, /uses: actions\/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\b/);
  assert.match(
    workflow,
    /uses: anthropics\/claude-code-action@1298632ce7736903d02a1435002705aa2a594a6c\b/
  );
  assert.doesNotMatch(workflow, /^\s*uses:\s*[^\s]+@v\d+(?:\.\d+)*\s*$/m);
});

test("Claude workflow retains least privilege and OAuth secret wiring", () => {
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(workflow, /^\s{6}id-token: write$/m);
  assert.match(workflow, /claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}/);
});
