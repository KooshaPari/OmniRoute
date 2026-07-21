import test from "node:test";
import assert from "node:assert/strict";
import {
  PETALS_DEFAULT_BASE_URL,
  PETALS_DEFAULT_MODEL,
  normalizePetalsBaseUrl,
} from "../../open-sse/config/petals.ts";

test("Petals config exposes a usable default endpoint and model", () => {
  assert.equal(normalizePetalsBaseUrl(), PETALS_DEFAULT_BASE_URL);
  assert.equal(PETALS_DEFAULT_MODEL, "meta-llama/Meta-Llama-3.1-8B-Instruct");
});

test("Petals endpoint normalization adds generate route once", () => {
  assert.equal(
    normalizePetalsBaseUrl("https://petals.example/api/v1/"),
    "https://petals.example/api/v1/generate",
  );
  assert.equal(
    normalizePetalsBaseUrl("https://petals.example/api/v1/generate/"),
    "https://petals.example/api/v1/generate",
  );
});

test("Petals endpoint normalization preserves query parameters and fragments", () => {
  assert.equal(
    normalizePetalsBaseUrl("https://petals.example/api/v1/?token=secret#primary"),
    "https://petals.example/api/v1/generate?token=secret#primary",
  );
  assert.equal(
    normalizePetalsBaseUrl("https://petals.example/api/v1/generate/?token=secret#primary"),
    "https://petals.example/api/v1/generate?token=secret#primary",
  );
});
