import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = readFileSync(resolve(repoRoot, "open-sse/services/claudeCodeCompatible.ts"), "utf8");

test("Claude Code compatibility re-exports its canonical identity values", () => {
  assert.match(source, /export \* from "\.\.\/config\/claudeCodeCompatibleIdentity\.ts";/);
  assert.equal(
    source.match(/export const CLAUDE_CODE_COMPATIBLE_(?:VERSION|USER_AGENT|STAINLESS_.*_VERSION)/g)
      ?.length ?? 0,
    0
  );
});
