import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routeSource = fs.readFileSync(
  new URL("../../src/app/api/v1/chat/completions/route.ts", import.meta.url),
  "utf8"
);

test("chat completions route imports the heap admission guard it invokes", () => {
  assert.match(
    routeSource,
    /import\s*\{[^}]*\bcheckChatAdmission\b[^}]*\}\s*from\s*["`]@\/shared\/middleware\/chatBodyAdmission["`]/s,
    "route must bind checkChatAdmission before invoking the early admission guard"
  );
  assert.match(
    routeSource,
    /const admissionRejection\s*=\s*checkChatAdmission\(request\)/,
    "route must keep the heap-pressure guard on the request path"
  );
});
