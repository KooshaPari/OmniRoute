import assert from "node:assert/strict";
import test from "node:test";
import { normalizePetalsBaseUrl, PETALS_DEFAULT_BASE_URL } from "../../open-sse/config/petals.ts";

test("Petals validation URLs normalize to the generate endpoint", () => {
  assert.equal(normalizePetalsBaseUrl(undefined), PETALS_DEFAULT_BASE_URL);
  assert.equal(normalizePetalsBaseUrl("https://chat.petals.dev"), PETALS_DEFAULT_BASE_URL);
  assert.equal(
    normalizePetalsBaseUrl("https://example.test/api"),
    "https://example.test/api/v1/generate"
  );
  assert.equal(
    normalizePetalsBaseUrl("https://example.test/api/v1"),
    "https://example.test/api/v1/generate"
  );
  assert.equal(
    normalizePetalsBaseUrl("https://example.test/api/v1/generate/"),
    "https://example.test/api/v1/generate"
  );
});
