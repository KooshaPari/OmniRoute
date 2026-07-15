import argon2 from "@node-rs/argon2";
import bcrypt from "bcryptjs";
import { getSettings, updateSettings } from "@/lib/db/settings";

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const ARGON2ID_HASH_PATTERN = /^\$argon2id\$/;

// bcryptjs hash cost — kept only for verifying legacy hashes. New passwords
// always use ARGON2ID_HASH_OPTS (OWASP-recommended Argon2id minimums).
const MANAGEMENT_PASSWORD_SALT_ROUNDS = 12;

// OWASP Password Storage Cheat Sheet (2026): Argon2id with these minimums.
// Source: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const ARGON2ID_HASH_OPTS = {
  algorithm: argon2.Algorithm.Argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

type JsonRecord = Record<string, unknown>;

type MigrationSource = "stored_hash" | "stored_plaintext" | "env" | "missing";

interface EnsureManagementPasswordOptions {
  initialPassword?: string | null;
  logger?: Pick<Console, "log">;
  settings?: JsonRecord;
  source?: string;
}

export interface EnsuredManagementPassword {
  hash: string | null;
  migrated: boolean;
  settings: JsonRecord;
  source: MigrationSource;
}

function getInitialPasswordValue(value: string | null | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getStoredManagementPassword(settings: JsonRecord | null | undefined) {
  return typeof settings?.password === "string" ? settings.password : "";
}

export function hasManagementPasswordConfigured(settings: JsonRecord | null | undefined) {
  return (
    getStoredManagementPassword(settings).length > 0 ||
    getInitialPasswordValue(process.env.INITIAL_PASSWORD) !== null
  );
}

export function isBcryptHash(value: unknown): value is string {
  return typeof value === "string" && BCRYPT_HASH_PATTERN.test(value);
}

export function isArgon2idHash(value: unknown): value is string {
  return typeof value === "string" && ARGON2ID_HASH_PATTERN.test(value);
}

/**
 * Hash a password using Argon2id (OWASP minimum parameters).
 * New passwords always produce `$argon2id$...` strings.
 */
export async function hashManagementPassword(password: string) {
  return argon2.hash(password, ARGON2ID_HASH_OPTS);
}

/**
 * Verify a password against a stored hash. Supports both Argon2id
 * (preferred) and legacy bcryptjs hashes (backward compatible).
 *
 * To migrate existing bcrypt passwords to argon2 opportunistically on
 * next successful login, callers should:
 *
 *   if (isBcryptHash(stored)) {
 *     const newHash = await hashManagementPassword(password);
 *     await updateSettings({ password: newHash });
 *   }
 *
 * @returns `true` iff the password matches the stored hash.
 */
export async function verifyManagementPassword(password: string, hash: string) {
  if (typeof password !== "string" || typeof hash !== "string") return false;
  if (isArgon2idHash(hash)) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  return false;
}

export async function ensurePersistentManagementPasswordHash(
  options: EnsureManagementPasswordOptions = {}
): Promise<EnsuredManagementPassword> {
  const settings = options.settings ?? ((await getSettings()) as JsonRecord);
  const storedPassword = getStoredManagementPassword(settings);

  if (isArgon2idHash(storedPassword) || isBcryptHash(storedPassword)) {
    return {
      hash: storedPassword,
      // `migrated` is a separate bool from the hash scheme — keep its
      // semantics of "did we have to write a new hash this call".
      migrated: false,
      settings,
      source: "stored_hash",
    };
  }

  const bootstrapPassword =
    storedPassword ||
    getInitialPasswordValue(options.initialPassword ?? process.env.INITIAL_PASSWORD);

  if (!bootstrapPassword) {
    return {
      hash: null,
      migrated: false,
      settings,
      source: "missing",
    };
  }

  const passwordHash = await hashManagementPassword(bootstrapPassword);
  const updates: JsonRecord = { password: passwordHash };

  if (settings.setupComplete !== true) {
    updates.setupComplete = true;
  }
  if (!storedPassword) {
    updates.requireLogin = true;
  }

  const nextSettings = (await updateSettings(updates)) as JsonRecord;
  if (options.logger) {
    const context = options.source ? ` during ${options.source}` : "";
    const migrationSource = storedPassword ? "stored plaintext password" : "INITIAL_PASSWORD";
    options.logger.log(`[AUTH] Migrated ${migrationSource} to Argon2id hash${context}`);
  }

  return {
    hash: getStoredManagementPassword(nextSettings) || passwordHash,
    migrated: true,
    settings: nextSettings,
    source: storedPassword ? "stored_plaintext" : "env",
  };
}
