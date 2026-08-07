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

const log = createLogger("db:encryption");

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
    console.error(
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
  } catch {
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
    console.warn(
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
    const message = err instanceof Error ? err.message : String(err);
    // FAIL-CLOSED: when a key is configured but the crypto pipeline throws
    // (broken native bindings, key length drift after a Node upgrade, OOM
    // under randomBytes, etc.) we MUST NOT silently return plaintext — that
    // re-introduces the State-B bug. Log loudly, then throw a typed error
    // so callers (encryptConnectionFields, providers, commandCodeAuth) can
    // refuse to write to the DB.
    log.error(
      {
        err: message,
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
    console.warn(
      "[Encryption] Found encrypted data but STORAGE_ENCRYPTION_KEY is not set. Cannot decrypt."
    );
    return null;
  }

  const body = ciphertext.slice(PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 3) {
    console.error("[Encryption] Malformed encrypted value");
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

    console.error(
      `[Encryption] Decryption failed. Ciphertext prefix: ${ciphertext.slice(0, 30)}... ` +
        `Auth tag validation likely failed.`
    );
    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Encryption] Decryption failed:", message);
    return null;
  }
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
  conn: T
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
      log.error(
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
 *
 * May throw `EncryptionRuntimeError` when the inner re-encrypt fails (State B
 * — key configured but crypto pipeline broke). The throw bubbles up; callers
 * in `core.ts:autoMigrateLegacyEncryptedConnections` already wrap in try/catch.
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
    log.warn(
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
    log.fatal(
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
    log.fatal(
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
    log.fatal(
      { decrypted },
      `[Encryption] FATAL — encrypt/decrypt round-trip mismatch at startup. ` +
        `Server refusing to start.`
    );
    throw new StartupEncryptionError(
      `round-trip mismatch: expected ${JSON.stringify(STARTUP_CANARY_PLAINTEXT)}, ` +
        `got ${JSON.stringify(decrypted)}`
    );
  }

  log.info(
    "[Encryption] Startup validation passed — encrypt/decrypt round-trip OK"
  );
}
