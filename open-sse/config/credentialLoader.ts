/**
 * Credential Loader — Reads provider credentials from an external JSON file.
 *
 * Loads `provider-credentials.json` from the data directory and merges it
 * over the hardcoded defaults in PROVIDERS. This keeps credentials out of
 * source control while maintaining backwards compatibility (hardcoded values
 * serve as defaults when the file is absent).
 *
 * Expected JSON structure:
 * {
 *   "claude": { "clientId": "..." },
 *   "gemini": { "clientId": "...", "clientSecret": "..." },
 *   ...
 * }
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createLogger } from "@/shared/utils/logger";

const log = createLogger("open-sse:credential-loader");
// Fields that can be overridden per provider
const CREDENTIAL_FIELDS = [
  "clientId",
  "clientSecret",
  "tokenUrl",
  "authUrl",
  "refreshUrl",
] as const;
type CredentialField = (typeof CREDENTIAL_FIELDS)[number];
type ProviderCredentialOverrides = Partial<Record<CredentialField, unknown>>;
type MutableProviderRecord = Record<string, Record<string, unknown>>;

// TTL-based cache — reloads credentials from disk at most once per minute
const CONFIG_TTL_MS = 60_000;
let lastLoadTime = 0;
let cachedProviders: Record<string, unknown> | null = null;

// Survives Next.js dev HMR: module-level cache resets but process is the same (V4 pattern).
type CredGlobals = typeof globalThis & { __omnirouteCredNoFileLogged?: boolean };
function credGlobals(): CredGlobals {
  return globalThis as CredGlobals;
}

function resolveCredentialsPath(): string {
  let resolveDataDir: (options?: { isCloud?: boolean }) => string;

  try {
    resolveDataDir = require("@/lib/dataPaths").resolveDataDir;
  } catch (err) {
    const fallbackDataDir = process.env.DATA_DIR || join(process.cwd(), "data");
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error(
      { err, fallbackDataDir },
      `Could not load dataPaths module (${errorMessage}); using fallback credentials path: ${fallbackDataDir}`
    );
    return join(fallbackDataDir, "provider-credentials.json");
  }

  return join(resolveDataDir(), "provider-credentials.json");
}

export function loadProviderCredentials<T extends Record<string, unknown>>(providers: T): T {
  if (cachedProviders && Date.now() - lastLoadTime < CONFIG_TTL_MS) {
    return cachedProviders as T;
  }

  const credPath = resolveCredentialsPath();

  if (!existsSync(credPath)) {
    if (!credGlobals().__omnirouteCredNoFileLogged) {
      log.info("credentials: no external file found, using defaults");
      credGlobals().__omnirouteCredNoFileLogged = true;
    }
    cachedProviders = providers;
    lastLoadTime = Date.now();
    return providers;
  }

  try {
    const raw = readFileSync(credPath, "utf-8");
    const external = JSON.parse(raw) as Record<string, unknown>;

    let overrideCount = 0;

    const mutableProviders = providers as MutableProviderRecord;

    for (const [providerKey, creds] of Object.entries(external)) {
      if (!mutableProviders[providerKey]) {
        log.warn({ provider: providerKey }, "credentials: unknown provider, skipping");
        continue;
      }

      if (!creds || typeof creds !== "object") {
        log.warn(
          { provider: providerKey, actualType: typeof creds },
          "credentials: provider value must be an object, skipping"
        );
        continue;
      }

      const credentialOverrides = creds as ProviderCredentialOverrides;
      for (const field of CREDENTIAL_FIELDS) {
        if (credentialOverrides[field] !== undefined) {
          mutableProviders[providerKey][field] = credentialOverrides[field];
          overrideCount++;
        }
      }
    }

    const isReload = cachedProviders !== null;
    log.info(
      { isReload, overrideCount, path: credPath },
      "credentials: external file loaded"
    );
  } catch (err) {
    const reason =
      err instanceof SyntaxError
        ? "Invalid JSON format"
        : (err as NodeJS.ErrnoException).code || "read error";
    log.warn({ reason }, "credentials: error reading file, using defaults");
  }

  cachedProviders = providers;
  lastLoadTime = Date.now();
  return providers;
}
