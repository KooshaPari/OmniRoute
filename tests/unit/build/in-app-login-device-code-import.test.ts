import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "open-sse/services/inAppLoginService.ts"), "utf8");

test("in-app login keeps the Playwright fallback without the unshippable device-code module path", () => {
  assert.doesNotMatch(
    source,
    /["']\.\.\/lib\/deviceCodeProviders\.js["']/,
    "the backend-only build must not resolve the device-code provider module"
  );
  assert.doesNotMatch(
    source,
    /\btryDeviceCodeForProvider\b/,
    "the incomplete device-code fallback must not remain reachable from browser login"
  );
  assert.match(
    source,
    /await import\(["']playwright["']\)/,
    "the supported Playwright browser-login path must remain available"
  );
});
