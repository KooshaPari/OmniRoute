import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  resolve(here, "../../../src/app/(dashboard)/dashboard/HomePageClient.tsx"),
  "utf8"
);

describe("HomePageClient update error rendering", () => {
  it("imports the safe API error extractor", () => {
    assert.match(
      source,
      /import\s*\{\s*extractApiErrorMessage\s*\}\s*from\s*["']@\/shared\/http\/apiErrorMessage["']/,
      "HomePageClient must import extractApiErrorMessage to render API errors safely"
    );
  });

  it("funnels the update error body through extractApiErrorMessage", () => {
    assert.match(
      source,
      /notify\.error\(\s*extractApiErrorMessage\(\s*data\s*,/,
      "the update-error notify.error call must use extractApiErrorMessage(data, ...)"
    );
  });

  it("does not pass the raw API error object to notify.error", () => {
    assert.doesNotMatch(
      source,
      /notify\.error\(\s*data\.error\b/,
      "notify.error(data.error ...) can render an error envelope object as a React child"
    );
  });
});
