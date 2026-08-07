# Encryption Error Handling — Migration Guide

This document explains how to handle encryption/decryption errors in OmniRoute.
Introduced in the F8 followup, the project now exposes both **lenient** and
**strict** variants of the encryption helpers in `src/lib/db/encryption.ts`.

## The two modes

### Lenient (default)

```ts
import { decrypt, encrypt, encryptConnectionFields, decryptConnectionFields } from "@/lib/db/encryption";

// Returns string on success, null on failure (auth-tag corruption, malformed
// ciphertext, key not configured). Logs the error via the structured logger.
const apiKey = decrypt(encryptedApiKey);
if (!apiKey) {
  // graceful fallback (return null, use cache, prompt user, etc.)
}

// Encrypts or returns plaintext if STORAGE_ENCRYPTION_KEY is not set.
const encrypted = encrypt(apiKey);
```

**Use when**: the caller treats null as "no key" (auth flow that needs a valid
key to proceed anyway, fallback path, retry with new credentials, etc.). Most
existing call sites use this pattern.

### Strict (opt-in)

```ts
import {
  decryptStrict,
  encryptStrict,
  encryptStrictConnectionFields,
  decryptStrictConnectionFields,
  EncryptionDecryptionError,
} from "@/lib/db/encryption";

try {
  const apiKey = decryptStrict(encryptedApiKey);
  // ... use apiKey
} catch (err) {
  if (err instanceof EncryptionDecryptionError) {
    // err.classification === "auth-tag-failure" | "malformed" | "not-configured"
    // err.ciphertextPrefix (first 30 chars) for debugging
    // err.cause (the underlying Node crypto error)
    log.error({ err }, "context: decryption failed — refusing to use key");
    throw new ServiceError("encrypted_data_corrupted", { code: err.classification });
  }
  throw err;
}
```

**Use when**: the caller can usefully handle the typed error — set a
"corrupted" flag, refuse to overwrite, mark the row for manual review, fail
the entire operation with a specific HTTP status, etc.

## When to migrate a callsite

| Caller pattern | Recommendation |
|---|---|
| `if (!decrypted) return null;` (treats null as "no auth") | Stay lenient — null is already the right answer |
| `const key = decrypt(encrypted) ?? "";` (treats null as empty string) | Stay lenient — the fallback is intentional |
| Caller is auth-critical AND has an explicit recovery strategy | Migrate to strict |
| Caller wants to distinguish "no key" vs "data corruption" | Migrate to strict |

The `EncryptionDecryptionError.classification` field is the discriminator:

| Classification | Meaning | Caller response |
|---|---|---|
| `auth-tag-failure` | GCM auth tag validation failed (data corruption, key mismatch, truncated tag) | Mark row for manual review; refuse to overwrite |
| `malformed` | Ciphertext structure is invalid (wrong prefix, bad hex, wrong number of segments) | Treat as corrupted; log + skip |
| `not-configured` | `STORAGE_ENCRYPTION_KEY` is not set but encrypted data was found | Operator config issue; alert + skip |
| `encrypt-failed` | Cipher pipeline failed (rare — randomBytes/createCipheriv error) | Likely key issue; alert + skip |

## Migrating a callsite

Before:
```ts
import { decrypt } from "@/lib/db/encryption";

const apiKey = decrypt(row.apiKey);
if (!apiKey) {
  log.warn("api key missing or corrupted");
  return null;
}
```

After:
```ts
import { decryptStrict, EncryptionDecryptionError } from "@/lib/db/encryption";

try {
  const apiKey = decryptStrict(row.apiKey);
  if (!apiKey) {
    log.warn({ rowId: row.id }, "api key not encrypted yet (passthrough mode)");
    return null;
  }
  // ... use apiKey
} catch (err) {
  if (err instanceof EncryptionDecryptionError) {
    log.error(
      { rowId: row.id, classification: err.classification, ciphertextPrefix: err.ciphertextPrefix },
      "api key decryption failed — row corrupted",
    );
    return null; // or throw a typed error
  }
  throw err;
}
```

## Backward compatibility

The lenient exports (`decrypt`, `encrypt`, `encryptConnectionFields`,
`decryptConnectionFields`) preserve their exact previous behavior. No caller
needs to change. New code can opt into strict mode as needed.

## What's currently NOT migrated

Per the audit, the following callers use the lenient pattern correctly:

- `src/lib/services/apiKey.ts` — graceful key rotation
- `src/lib/cloudAgent/credentials.ts` — empty-string fallback for missing keys
- `src/lib/db/obsidian.ts` — passthrough fallback pattern
- `src/lib/webhookDispatcher.ts` — metadata encrypt (best-effort)
- `src/lib/db/proxies/mappers.ts` — relay auth (best-effort)
- `src/lib/db/commandCodeAuth.ts` — returns null on no-key (auth flow expects this)

These can be migrated individually if their context changes (e.g., a new
auth flow that wants to distinguish "no key" from "corrupted key").

## See also

- `plans/encryption-failclosed-spec.md` — Architectural spec
- `src/lib/db/encryption.ts` — Source code
- `tests/unit/db-encryption.test.ts` — Existing lenient tests
- `tests/unit/db/encryption-strict.test.mjs` — Strict-mode tests
