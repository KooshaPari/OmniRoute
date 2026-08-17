import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = readFileSync(resolve(repoRoot, "open-sse/executors/claude-web.ts"), "utf8");

test("Claude Web executor has one session-cookie import and fingerprint user agent", () => {
  assert.equal(source.match(/import \{ normalizeSessionCookieHeader \}/g)?.length, 1);
  assert.equal(source.match(/const CLAUDE_USER_AGENT\b/g)?.length, 1);
  assert.match(source, /const CLAUDE_USER_AGENT = CLAUDE_WEB_FINGERPRINT\.userAgent;/);
});
