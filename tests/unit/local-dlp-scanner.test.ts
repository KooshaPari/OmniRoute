import { test } from "node:test";
import assert from "node:assert/strict";
import { redactLocalDlp, scanLocalDlp } from "../../src/lib/guardrails/localDlpScanner.ts";

test("detects AWS access key IDs from fake fixtures", () => {
  const result = scanLocalDlp("fake key AKIAIOSFODNN7EXAMPLE end");
  assert.deepEqual(result.categories, ["aws_access_key"]);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].rule, "aws_access_key_id");
  assert.equal(result.matches[0].start, 9);
});

test("detects PEM private-key headers from fake fixtures", () => {
  const result = scanLocalDlp("x\n-----BEGIN RSA PRIVATE KEY-----\nfake\nx");
  assert.deepEqual(result.categories, ["private_key"]);
  assert.equal(result.matches[0].rule, "pem_private_key_header");
});

test("detects Bearer tokens from fake fixtures", () => {
  const result = scanLocalDlp("Authorization: Bearer fake.token.value.1234567890");
  assert.deepEqual(result.categories, ["bearer_token"]);
  assert.equal(result.matches[0].rule, "bearer_token");
});

test("detects generic api_key and secret assignments with long values", () => {
  const apiKey = scanLocalDlp('api_key = "fakeApiKeyValue1234567890"');
  const secret = scanLocalDlp("secret: fakeSecretValue1234567890");
  assert.deepEqual(apiKey.categories, ["api_secret_assignment"]);
  assert.deepEqual(secret.categories, ["api_secret_assignment"]);
  assert.equal(apiKey.matches[0].rule, "secret_assignment");
  assert.equal(secret.matches[0].rule, "secret_assignment");
});

test("detects email addresses", () => {
  const result = scanLocalDlp("contact fake.person@example.test today");
  assert.deepEqual(result.categories, ["email"]);
  assert.equal(result.matches[0].rule, "email_address");
});

test("detects US SSNs with and without separators", () => {
  const dashed = scanLocalDlp("ssn 123-45-6789 end");
  const compact = scanLocalDlp("ssn 123456789 end");
  assert.deepEqual(dashed.categories, ["us_ssn"]);
  assert.deepEqual(compact.categories, ["us_ssn"]);
  assert.equal(dashed.matches[0].rule, "us_ssn");
});

test("detects Luhn-valid card-like numbers and rejects invalid ones", () => {
  const valid = scanLocalDlp("card 4111 1111 1111 1111 end");
  const invalid = scanLocalDlp("card 4111 1111 1111 1112 end");
  assert.deepEqual(valid.categories, ["credit_card"]);
  assert.equal(valid.matches[0].rule, "luhn_card_number");
  assert.deepEqual(invalid.categories, []);
  assert.equal(invalid.matches.length, 0);
  assert.equal(invalid.redactedText, "card 4111 1111 1111 1112 end");
});

test("returns empty results for empty and clean text", () => {
  for (const text of ["", "nothing sensitive here", "short secret abc"]) {
    const result = scanLocalDlp(text);
    assert.deepEqual(result.categories, []);
    assert.deepEqual(result.matches, []);
    assert.equal(result.redactedText, text);
  }
});

test("removes overlapping duplicate matches and keeps deterministic order", () => {
  const text = "contact fake.person@example.test card 4111111111111111";
  const first = scanLocalDlp(text);
  const second = scanLocalDlp(text);
  assert.deepEqual(second, first);
  assert.deepEqual(first.categories, ["email", "credit_card"]);
  assert.deepEqual(
    first.matches.map((match) => match.category),
    ["email", "credit_card"]
  );
  assert.ok(first.matches[0].end <= first.matches[1].start);
});

test("redacts matches while preserving unrelated text", () => {
  const text = "before fake.person@example.test middle AKIAIOSFODNN7EXAMPLE after";
  const result = scanLocalDlp(text);
  assert.equal(
    result.redactedText,
    "before [REDACTED:email] middle [REDACTED:aws_access_key] after"
  );
  assert.equal(redactLocalDlp(text), result.redactedText);
});

test("does not mutate input or shared detector state", () => {
  const text = "fake AKIAIOSFODNN7EXAMPLE and fake.person@example.test";
  const snapshot = text;
  scanLocalDlp(text);
  assert.equal(text, snapshot);
  const first = scanLocalDlp(text);
  const second = scanLocalDlp(text);
  assert.deepEqual(first, second);
});
