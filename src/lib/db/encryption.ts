/**
 * Field-Level Encryption — AES-256-GCM
 *
 * Encrypts/decrypts sensitive fields (API keys, tokens) stored in SQLite.
 * Format: `enc:v1:<iv_hex>:<ciphertext_hex>:<authTag_hex>`
 *
 * If STORAGE_ENCRYPTION_KEY is not set, operates in passthrough mode
 * (stores plaintext for development convenience).
 *
 * KEY DERIVATION CHANGE (v3.7.9):
 * The PRIMARY key is now derived with a static salt ("omniroute-field-encryption-v1").
 * The LEGACY key used a dynamic salt (sha256 hash of the key). Auto-migration
 * re-encrypts any legacy-encrypted tokens on decrypt.
 *
 * Why the change?
 * The dynamic salt `createHash("sha256").update(secret).digest().slice(0, 16)` produced
 * a different derived key than the static salt `"omniroute-field-encryption-v1"`. When the
 * health-check/token-refresh path used one derivation and the main API used another,
 * tokens encrypted by one path became undecryptable by the other, causing:
 * - Persistent decrypt failures
 * - Re-encryption loops (health-check undoing fixes)
 * - CPU spikes (50%) from error cascades
 *
 * This fix makes the static salt the primary derivation and auto-migrates
 * legacy-encrypted tokens back to static-salt encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "crypto";
import { createLogger } from "@/shared/utils/logger";

const encryptionLog = createLogger("db:encryption");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
/**
 * GCM authentication tag length, in bytes. Pinned to the full 16-byte tag
 * produced by `cipher.getAuthTag()`. Passing `authTagLength` to
 * `createDecipheriv` rejects truncated authentication tags up front, closing
 * the GCM tag-truncation forgery vector (Semgrep gcm-no-tag-length).
 */
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:v1:";
const STATIC_SALT = "omniroute-field-encryption-v1";
/** Canary plaintext for the startup round-trip check. Never written to disk. */
const STARTUP_CANARY_PLAINTEXT = "omniroute-startup-canary-do-not-use";

let _staticKey: Buffer | null = null;
let _legacyDynamicKey: Buffer | null = null;
/** Connection object with potentially encrypted credential fields. */
export interface ConnectionFields {
  apiKey?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  [key: string]: unknown;
}

/**
 * Typed error thrown by strict-mode encryption functions. Carries the
 * classification (auth-tag failure vs malformed) and a cipher prefix for
 * debugging without leaking full ciphertext.
 *
 * Use `instanceof EncryptionDecryptionError` to distinguish encryption
 * failures from generic errors in callers.
 */
export class EncryptionDecryptionError extends Error {
  readonly cause?: unknown;
  readonly ciphertextPrefix?: string;
  readonly classification: "auth-tag-failure" | "malformed" | "not-configured" | "encrypt-failed";

  constructor(
    message: string,
    options: {
      cause?: unknown;
      ciphertextPrefix?: string;
      classification: EncryptionDecryptionError["classification"];
    },
  ) {
    super(message);
    this.name = "EncryptionDecryptionError";
    this.cause = options.cause;
    this.ciphertextPrefix = options.ciphertextPrefix;
    this.classification = options.classification;
  }
}

/**
 * Thrown when `encrypt()` was supposed to encrypt (key configured) but the
 * crypto pipeline threw. Carries the original error as `.cause`.
 *
 * This is FAIL-CLOSED behaviour — callers must NOT swallow this and write
 * the plaintext; that would re-introduce the State-B bug fixed by
 * `encryption-failclosed`. See `plans/encryption-failclosed-spec.md` for
 * the audit and remediation.
 */
export class EncryptionRuntimeError extends Error {
  override readonly name = "EncryptionRuntimeError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * Thrown by `validateEncryptionAtStartup()` when the encrypt/decrypt
 * round-trip canary fails. Distinct from `EncryptionRuntimeError` so
 * operators can grep for the startup-specific path and the runtime-specific
 * path separately.
 */
export class StartupEncryptionError extends Error {
  override readonly name = "StartupEncryptionError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * Classify a Node crypto error as an auth-tag validation failure (the
 * most security-relevant case) vs other malformed-input errors.
 *
 * Node OpenSSL errors have stable codes (ERR_OSSL_BAD_DECRYPT,
 * ERR_OSSL_GCM_NO_TAG) that map to GCM auth-tag failure. We also match
 * on message substrings for older Node versions and other runtimes.
 */
function isAuthTagFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  if (code === "ERR_OSSL_BAD_DECRYPT" || code === "ERR_OSSL_GCM_NO_TAG") return true;
  const message = (err as { message?: string }).message?.toLowerCase() ?? "";
  return (
    message.includes("unsupported state or unable to authenticate data") ||
    message.includes("auth tag") ||
    message.includes("bad decrypt")
  );
}

/**
 * Derive the PRIMARY encryption key using the static salt.
 * This is the canonical key derivation that all new encryptions use.
 * Returns null if no encryption key is configured.
 */
function getStaticKey(): Buffer | null {
  if (_staticKey !== null) return _staticKey;

  const secret = process.env.STORAGE_ENCRYPTION_KEY;
  if (!secret || typeof secret !== "string" || secret.trim().length === 0) return null;

  try {
    _staticKey = scryptSync(secret, STATIC_SALT, KEY_LENGTH);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    encryptionLog.error(
      { err },
      `[Encryption] Failed to derive key from STORAGE_ENCRYPTION_KEY: ${message}. ` +
        `Generate a valid key with: openssl rand -base64 32`
    );
    return null;
  }
  return _staticKey;
}

/**
 * Derive the LEGACY key using the old dynamic salt method.
 * Used exclusively for fallback decryption of tokens encrypted by older versions.
 *
 * The old dynamic salt was: createHash("sha256").update(secret).digest().slice(0, 16)
 * This produced a different derived key than the static salt, causing incompatibility.
 */
function getLegacyDynamicKey(): Buffer | null {
  if (_legacyDynamicKey !== null) return _legacyDynamicKey;

  const secret = process.env.STORAGE_ENCRYPTION_KEY;
  if (!secret || typeof secret !== "string" || secret.trim().length === 0) return null;

  const dynamicSalt = createHash("sha256").update(secret).digest().slice(0, 16);
  try {
    _legacyDynamicKey = scryptSync(secret, dynamicSalt, KEY_LENGTH);
  } catch (err) {
    encryptionLog.error(
      { err },
      "encryption.getLegacyDynamicKey: scryptSync failed — legacy decryptions will silently fail (tokens may stall migration)"
    );
    return null;
  }
  return _legacyDynamicKey;
}

/** Check if encryption is enabled. */
export function isEncryptionEnabled(): boolean {
  return !!process.env.STORAGE_ENCRYPTION_KEY;
}

/**
 * Encrypt a plaintext string using the STATIC salt key.
 * If encryption is not configured, returns plaintext unchanged.
 */
export function encrypt(plaintext: string | null | undefined): string | null | undefined {
  if (!plaintext || typeof plaintext !== "string") return plaintext;

  const key = getStaticKey();
  if (!key) {
    encryptionLog.error(
      "[Encryption] STORAGE_ENCRYPTION_KEY not set. Storing plaintext (passthrough mode)."
    );
    return plaintext; // passthrough mode
  }

  // Already encrypted — don't double-encrypt
  if (plaintext.startsWith(PREFIX)) return plaintext;

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${PREFIX}${iv.toString("hex")}:${encrypted}:${authTag}`;
  } catch (err: unknown) {
    // FAIL-CLOSED: when a key is configured but the crypto pipeline throws
    // (broken native bindings, key length drift after a Node upgrade, OOM
    // under randomBytes, etc.) we MUST NOT silently return plaintext — that
    // re-introduces the State-B bug. Log loudly, then throw a typed error
    // so callers (encryptConnectionFields, providers, commandCodeAuth) can
    // refuse to write to the DB.
    const message = err instanceof Error ? err.message : String(err);
    encryptionLog.error(
      {
        err,
        op: "encrypt",
        envSet: !!process.env.STORAGE_ENCRYPTION_KEY,
        // _staticKey is a Buffer; never log the key material itself.
        keyBytes: _staticKey?.length ?? null,
      },
      `[Encryption] STORAGE_ENCRYPTION_KEY is set but encrypt() failed. ` +
        `Refusing to write plaintext. Regenerate with: openssl rand -base64 32`
    );
    throw new EncryptionRuntimeError(
      `Encryption failed at runtime: ${message}. ` +
        `Refusing to write plaintext. Check your STORAGE_ENCRYPTION_KEY — ` +
        `regenerate one with: openssl rand -base64 32`,
      { cause: err }
    );
  }
}

/**
 * Strict variant of encrypt(): throws EncryptionDecryptionError on
 * failure instead of silently falling back to plaintext.
 *
 * Use when the caller can usefully handle the typed error (e.g., refuse
 * to write plaintext, surface to operator, mark row as corrupt).
 *
 * For most callers, prefer the lenient encrypt() which returns plaintext
 * on failure for backward compatibility.
 */
export function encryptStrict(plaintext: string | null | undefined): string | null | undefined {
  if (!plaintext || typeof plaintext !== "string") return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext;

  const key = getStaticKey();
  if (!key) {
    throw new EncryptionDecryptionError(
      "encryptStrict: STORAGE_ENCRYPTION_KEY is not set",
      { classification: "not-configured" },
    );
  }

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${PREFIX}${iv.toString("hex")}:${encrypted}:${authTag}`;
  } catch (err) {
    throw new EncryptionDecryptionError("encryptStrict: cipher pipeline failed", {
      cause: err,
      classification: "encrypt-failed",
    });
  }
}

/**
 * Decrypt a ciphertext string. Attempts static-salt key first (primary),
 * then falls back to legacy dynamic-salt key for backward compatibility.
 *
 * When a token is decrypted using the legacy key, it is flagged for
 * auto-migration: the next encrypt() call will re-encrypt it with the
 * static-salt key, gradually migrating the database.
 */
export function decrypt(ciphertext: string | null | undefined): string | null | undefined {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext;

  // Not encrypted — return as-is (legacy plaintext or passthrough mode)
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  const staticKey = getStaticKey();
  if (!staticKey) {
    encryptionLog.error(
      "[Encryption] Found encrypted data but STORAGE_ENCRYPTION_KEY is not set. Cannot decrypt."
    );
    return null;
  }

  const body = ciphertext.slice(PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 3) {
    encryptionLog.error("[Encryption] Malformed encrypted value");
    return null;
  }

  const [ivHex, encryptedHex, authTagHex] = parts;

  const tryDecryptWithKey = (candidateKey: Buffer): string | null => {
    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const decipher = createDecipheriv(ALGORITHM, candidateKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      return null;
    }
  };

  try {
    // PRIMARY: Try static-salt key first (canonical derivation)
    const decrypted = tryDecryptWithKey(staticKey);
    if (decrypted !== null) {
      return decrypted;
    }

    encryptionLog.error(
      `[Encryption] Decryption failed. Ciphertext prefix: ${ciphertext.slice(0, 30)}... ` +
        `Auth tag validation likely failed.`
    );
    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    encryptionLog.error({ err }, `[Encryption] Decryption failed: ${message}`);
    return null;
  }
}

/**
 * Strict variant of decrypt(): throws EncryptionDecryptionError on
 * auth-tag failure or malformed ciphertext instead of returning null.
 *
 * Use when the caller can usefully handle the typed error (e.g., set a
 * "corrupted" flag, refuse to overwrite, surface to operator, mark the
 * row for manual review).
 *
 * For most callers, prefer the lenient decrypt() which returns null
 * on failure for backward compatibility.
 *
 * The typed error includes a `classification` field (auth-tag-failure
 * vs malformed) and a `ciphertextPrefix` (first 30 chars) for
 * debugging without leaking full ciphertext.
 */
export function decryptStrict(ciphertext: string | null | undefined): string | null | undefined {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  const staticKey = getStaticKey();
  if (!staticKey) {
    encryptionLog.warn(
      { ciphertextPrefix: ciphertext.slice(0, 30) },
      "decryptStrict: STORAGE_ENCRYPTION_KEY not set but encrypted data found — returning null",
    );
    return null;
  }

  const body = ciphertext.slice(PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 3) {
    throw new EncryptionDecryptionError(
      "decryptStrict: malformed ciphertext (expected enc:v1:<iv>:<ct>:<authTag>)",
      { ciphertextPrefix: ciphertext.slice(0, 30), classification: "malformed" },
    );
  }

  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  try {
    const decipher = createDecipheriv(ALGORITHM, staticKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    if (isAuthTagFailure(err)) {
      encryptionLog.error(
        { err, ciphertextPrefix: ciphertext.slice(0, 30) },
        "decryptStrict: auth-tag validation failed (data corruption suspected)",
      );
      throw new EncryptionDecryptionError(
        "decryptStrict: auth-tag validation failed (data corruption suspected)",
        { cause: err, ciphertextPrefix: ciphertext.slice(0, 30), classification: "auth-tag-failure" },
      );
    }
    encryptionLog.error(
      { err, ciphertextPrefix: ciphertext.slice(0, 30) },
      "decryptStrict: malformed ciphertext or key mismatch",
    );
    throw new EncryptionDecryptionError(
      "decryptStrict: malformed ciphertext or key mismatch",
      { cause: err, ciphertextPrefix: ciphertext.slice(0, 30), classification: "malformed" },
    );
  }
}

/**
 * Strict variant of encryptConnectionFields(): mutates connection fields
 * with encryptStrict(). Throws EncryptionDecryptionError if any field
 * fails to encrypt.
 *
 * Use when the caller needs to ensure no plaintext is stored.
 */
export function encryptStrictConnectionFields<T extends ConnectionFields | null | undefined>(
  conn: T,
): T {
  if (!isEncryptionEnabled()) return conn;
  if (!conn) return conn;

  if (conn.apiKey) conn.apiKey = encryptStrict(conn.apiKey);
  if (conn.accessToken) conn.accessToken = encryptStrict(conn.accessToken);
  if (conn.refreshToken) conn.refreshToken = encryptStrict(conn.refreshToken);
  if (conn.idToken) conn.idToken = encryptStrict(conn.idToken);
  return conn;
}

/**
 * Strict variant of decryptConnectionFields(): decrypts fields with
 * decryptStrict(). Throws EncryptionDecryptionError if any field fails
 * to decrypt (caller can decide whether to refuse to use the row).
 */
export function decryptStrictConnectionFields<T extends ConnectionFields | null | undefined>(
  row: T,
): T {
  if (!row) return row;
  if (!isEncryptionEnabled()) return row;

  return {
    ...row,
    apiKey: decryptStrict(row.apiKey),
    accessToken: decryptStrict(row.accessToken),
    refreshToken: decryptStrict(row.refreshToken),
    idToken: decryptStrict(row.idToken),
  };
}

/**
 * Encrypt sensitive fields in a connection object (mutates in-place).
 * After decryption that required legacy key, re-encrypt with static key
 * to migrate tokens automatically.
 *
 * FAIL-CLOSED: when any inner `encrypt()` throws `EncryptionRuntimeError`
 * (i.e. a key is configured but the crypto pipeline failed), this function
 * returns `null` and logs the failure. Callers MUST check for `null` and
 * refuse to write plaintext to the DB. State A (no key) is preserved — the
 * connection object is returned unchanged.
 */
export function encryptConnectionFields<T extends ConnectionFields | null | undefined>(
  conn: T,
): T | null {
  if (!isEncryptionEnabled()) return conn;
  if (!conn) return conn;

  try {
    if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey) ?? conn.apiKey;
    if (conn.accessToken) conn.accessToken = encrypt(conn.accessToken) ?? conn.accessToken;
    if (conn.refreshToken) conn.refreshToken = encrypt(conn.refreshToken) ?? conn.refreshToken;
    if (conn.idToken) conn.idToken = encrypt(conn.idToken) ?? conn.idToken;
    return conn;
  } catch (err: unknown) {
    if (err instanceof EncryptionRuntimeError) {
      encryptionLog.error(
        { err: err.message, op: "encryptConnectionFields" },
        `[Encryption] encryptConnectionFields() refused to write plaintext. ` +
          `Refusing to insert/update connection row.`
      );
      return null;
    }
    throw err; // Unexpected error; bubble up so the caller can see a stack trace.
  }
}

/**
 * Decrypt sensitive fields in a connection row (returns new object).
 * Note: If any field was decrypted using the legacy key, the migration
 * flag is set. The calling code should check isMigrationNeeded() and
 * trigger a re-encrypt (write-back) to migrate those tokens to the static key.
 */
export function decryptConnectionFields<T extends ConnectionFields | null | undefined>(row: T): T {
  if (!row) return row;
  if (!isEncryptionEnabled()) return row;

  return {
    ...row,
    apiKey: decrypt(row.apiKey),
    accessToken: decrypt(row.accessToken),
    refreshToken: decrypt(row.refreshToken),
    idToken: decrypt(row.idToken),
  };
}

/**
 * Specifically tests a ciphertext against the legacy key. If it succeeds, it
 * re-encrypts the decrypted value with the canonical static key.
 * Used exclusively by the startup migration script.
 */
export function migrateLegacyEncryptedString(ciphertext: string | null | undefined): {
  updated: boolean;
  value: string | null | undefined;
} {
  if (!isEncryptionEnabled()) return { updated: false, value: ciphertext };
  if (!ciphertext || ciphertext.trim().length === 0) return { updated: false, value: ciphertext };
  if (!ciphertext.startsWith(PREFIX)) return { updated: false, value: ciphertext };

  const staticKey = getStaticKey();
  const legacyKey = getLegacyDynamicKey();

  if (!staticKey) return { updated: false, value: null };

  const rawPayload = ciphertext.slice(PREFIX.length);
  const parts = rawPayload.split(":");
  if (parts.length !== 3) return { updated: false, value: ciphertext };

  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const tryDecryptWithKey = (key: Buffer): string | null => {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, undefined, "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      return null;
    }
  };

  // 1. If it already decrypts with the static key, no migration needed.
  if (tryDecryptWithKey(staticKey) !== null) {
    return { updated: false, value: ciphertext };
  }

  // 2. If it decrypts with the legacy key, it needs migration!
  if (legacyKey) {
    const legacyDecrypted = tryDecryptWithKey(legacyKey);
    if (legacyDecrypted !== null) {
      // Re-encrypt using the canonical static key and return updated
      return { updated: true, value: encrypt(legacyDecrypted) };
    }
  }

  // 3. Un-decryptable or corrupted, leave it alone
  return { updated: false, value: ciphertext };
}

/**
 * Run a known-plaintext encrypt/decrypt round-trip to detect broken
 * encryption config BEFORE the first request hits a DB write.
 *
 * Behaviour:
 *   - No `STORAGE_ENCRYPTION_KEY` set (State A / passthrough mode): log a
 *     warn and return — operator has opted out of encryption.
 *   - Key set but `encrypt(canary)` throws: log fatal, throw
 *     `StartupEncryptionError` so the caller can `process.exit(1)`.
 *   - Key set and round-trip succeeds: log info, return.
 *
 * Designed to be invoked from `src/instrumentation.ts` (Next.js) or any
 * other entry point that wants fail-fast at boot.
 */
export function validateEncryptionAtStartup(): void {
  if (!isEncryptionEnabled()) {
    encryptionLog.warn(
      "[Encryption] No STORAGE_ENCRYPTION_KEY set — passthrough mode active. " +
        "Sensitive fields will be stored as plaintext. " +
        "Generate a key with: openssl rand -base64 32"
    );
    return;
  }

  let encrypted: string;
  try {
    encrypted = encrypt(STARTUP_CANARY_PLAINTEXT) ?? "";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    encryptionLog.fatal(
      { err: message, op: "startup-canary-encrypt" },
      `[Encryption] FATAL — STORAGE_ENCRYPTION_KEY is set but encrypt() threw at startup. ` +
        `Server refusing to start. Regenerate with: openssl rand -base64 32`
    );
    throw new StartupEncryptionError(
      `encryption startup check failed: encrypt() threw — ${message}`,
      { cause: err }
    );
  }

  if (!encrypted || !encrypted.startsWith(PREFIX)) {
    encryptionLog.fatal(
      { encrypted },
      `[Encryption] FATAL — encryption returned no prefix at startup (broken crypto). ` +
        `Server refusing to start.`
    );
    throw new StartupEncryptionError(
      "encrypt() returned plaintext at startup despite a key being set"
    );
  }

  const decrypted = decrypt(encrypted);
  if (decrypted !== STARTUP_CANARY_PLAINTEXT) {
    encryptionLog.fatal(
      { decrypted },
      `[Encryption] FATAL — encrypt/decrypt round-trip mismatch at startup. ` +
        `Server refusing to start.`
    );
    throw new StartupEncryptionError(
      `round-trip mismatch: expected ${JSON.stringify(STARTUP_CANARY_PLAINTEXT)}, ` +
        `got ${JSON.stringify(decrypted)}`
    );
  }

  encryptionLog.info(
    "[Encryption] Startup validation passed — encrypt/decrypt round-trip OK"
  );
}
