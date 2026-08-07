/**
 * AC-11 — encryptConnectionFields() returns null when an inner encrypt()
 * throws EncryptionRuntimeError. See `plans/encryption-failclosed-spec.md` §6.9.
 *
 * Uses node:test (matching sibling `tests/unit/db/encryption-error-handling.test.mjs`).
 *
 * The fault-injection path (replacing `randomBytes` in the `crypto` module)
 * is covered in `tests/unit/db/encryption-failclosed.test.ts` via vitest +
 * vi.mock. This file covers the contract via the real encrypt() and the
 * shape of encryptConnectionFields()'s return value.
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ORIGINAL_STORAGE_KEY = process.env.STORAGE_ENCRYPTION_KEY;

async function importFresh(modulePath) {
  const url = pathToFileURL(path.resolve(modulePath)).href;
  return import(`${url}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test.after(() => {
  if (ORIGINAL_STORAGE_KEY === undefined) {
    delete process.env.STORAGE_ENCRYPTION_KEY;
  } else {
    process.env.STORAGE_ENCRYPTION_KEY = ORIGINAL_STORAGE_KEY;
  }
});

test("AC-11 (State A preserved): encryptConnectionFields() returns connection unchanged when no key set", async () => {
  delete process.env.STORAGE_ENCRYPTION_KEY;
  const encryption = await importFresh("src/lib/db/encryption.ts");

  const conn = {
    apiKey: "sk-plaintext",
    accessToken: "plain-access",
  };
  const result = encryption.encryptConnectionFields({ ...conn });
  assert.equal(result.apiKey, "sk-plaintext", "apiKey must remain plaintext in passthrough");
  assert.equal(result.accessToken, "plain-access", "accessToken must remain plaintext in passthrough");
});

test("AC-11 (success path): encryptConnectionFields() encrypts and returns the connection on success", async () => {
  process.env.STORAGE_ENCRYPTION_KEY = "task-connfields-success-secret";
  const encryption = await importFresh("src/lib/db/encryption.ts");

  const conn = {
    apiKey: "sk-plaintext",
    accessToken: "plain-access",
  };
  const result = encryption.encryptConnectionFields({ ...conn });
  assert.notEqual(result, null);
  assert.match(result.apiKey, /^enc:v1:/);
  assert.match(result.accessToken, /^enc:v1:/);
  // Round-trip
  assert.equal(encryption.decrypt(result.apiKey), "sk-plaintext");
  assert.equal(encryption.decrypt(result.accessToken), "plain-access");
});

test("AC-11 (State A with null conn): encryptConnectionFields() returns null/undefined for null/undefined", async () => {
  delete process.env.STORAGE_ENCRYPTION_KEY;
  const encryption = await importFresh("src/lib/db/encryption.ts");

  assert.equal(encryption.encryptConnectionFields(null), null);
  assert.equal(encryption.encryptConnectionFields(undefined), undefined);
});

test("AC-11: EncryptionRuntimeError is exported and is an Error subclass", async () => {
  const encryption = await importFresh("src/lib/db/encryption.ts");
  const err = new encryption.EncryptionRuntimeError("test", { cause: new Error("root") });
  assert.equal(err instanceof Error, true);
  assert.equal(err instanceof encryption.EncryptionRuntimeError, true);
  assert.equal(err.name, "EncryptionRuntimeError");
  assert.equal(err.cause.message, "root");
});
