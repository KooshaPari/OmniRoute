import crypto from "node:crypto";

const BUILTIN_DEFAULT_SALT = "omniroute-cli-auth-v1";
export const CLI_TOKEN_HEADER = "x-omniroute-cli-token";

let _cached = null;
let _cachedSalt = null;

/** Mirrors getActiveSalt() in src/lib/machineToken.ts so a rotated
 *  OMNIROUTE_CLI_SALT reaches the CLI too (docs/security/CLI_TOKEN.md). */
function getActiveSalt() {
  return process.env.OMNIROUTE_CLI_SALT || BUILTIN_DEFAULT_SALT;
}

export function deriveCliToken(machineIdModule, salt) {
  try {
    // node-machine-id is CommonJS: under `await import()` its exports land on
    // `.default`, so destructuring `machineIdSync` off the namespace yields
    // undefined and calling it throws — which the catch below turned into an
    // empty token, silently disabling CLI auth for every management request.
    // Same resolution order as src/lib/machineToken.ts.
    const machineIdSync =
      machineIdModule?.machineIdSync || machineIdModule?.default?.machineIdSync;
    if (typeof machineIdSync !== "function") return "";
    // machineIdSync(true) returns the original unhashed hardware ID — mirrors
    // getMachineTokenSync() in src/lib/machineToken.ts (#10148 cliToken hardening).
    const rawId = machineIdSync(true);
    if (!rawId) return "";
    return crypto.createHmac("sha256", rawId).update(salt).digest("hex");
  } catch {
    return "";
  }
}

export async function getCliToken() {
  const salt = getActiveSalt();
  if (_cached !== null && _cachedSalt === salt) return _cached;
  try {
    const imported = await import("node-machine-id");
    const token = deriveCliToken(imported, salt);
    if (!token) {
      // Swallowing here changes control flow (every management call goes out
      // unauthenticated and 401s), so leave a breadcrumb rather than failing mute.
      console.debug("[CLI_TOKEN] machine-id resolution failed, CLI auth disabled");
    }
    _cached = token;
  } catch (e) {
    console.debug("[CLI_TOKEN] machine-id resolution failed, CLI auth disabled:", e);
    _cached = "";
  }
  _cachedSalt = salt;
  return _cached;
}
