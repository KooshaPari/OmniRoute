import { createHash, createHmac } from "node:crypto";
import * as nodeModule from "node:module";

let machineIdSync: (original?: boolean) => string;
try {
  // Anchor runtime resolution to the process entrypoint. Turbopack rewrites
  // createRequire(import.meta.url) into an in-bundle resolver, which cannot load
  // external CommonJS packages from the installed standalone node_modules tree.
  const runtimeRequire = nodeModule.createRequire(process.argv[1] || process.cwd());
  const mod = runtimeRequire("node-machine-id");
  machineIdSync = mod.machineIdSync || mod.default?.machineIdSync;
} catch {
  machineIdSync = () => "";
}

const BUILTIN_DEFAULT_SALT = "omniroute-cli-auth-v1";

function getActiveSalt(): string {
  return process.env.OMNIROUTE_CLI_SALT || BUILTIN_DEFAULT_SALT;
}

export function deriveMachineToken(rawId: string, salt: string): string {
  if (!rawId) return "";
  return createHmac("sha256", rawId).update(salt).digest("hex");
}

export function deriveLegacyCliToken(machineId: string, salt: string): string {
  if (!machineId) return "";
  return createHash("sha256")
    .update(machineId + salt)
    .digest("hex")
    .substring(0, 32);
}

let cached: string | null = null;
let cachedSalt: string | null = null;

export function getMachineTokenSync(salt?: string): string {
  const activeSalt = salt ?? getActiveSalt();
  try {
    // machineIdSync(true) returns the original unhashed hardware ID.
    const rawId = machineIdSync(true);
    if (!rawId) return "";
    if (activeSalt === cachedSalt && cached !== null) return cached;
    const token = deriveMachineToken(rawId, activeSalt);
    if (!salt) {
      cached = token;
      cachedSalt = activeSalt;
    }
    return token;
  } catch {
    return "";
  }
}

export function getLegacyCliTokenSync(salt?: string): string {
  const activeSalt = salt ?? getActiveSalt();
  try {
    const machineId = machineIdSync();
    return deriveLegacyCliToken(machineId, activeSalt);
  } catch {
    return "";
  }
}
