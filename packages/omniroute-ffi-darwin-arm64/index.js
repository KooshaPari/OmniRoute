import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NATIVE_DIR = join(__dirname, "native");

export const platform = "darwin-arm64";
export const nativeDir = NATIVE_DIR;

const CRATES = [
  "libomniroute_ffi_combo_scorer.dylib",
  "libomniroute_ffi_signature_cache.dylib",
  "libomniroute_ffi_sse_chunking.dylib",
  "libomniroute_ffi_guardrails_pii.dylib",
  "libomniroute_ffi_token_bucket.dylib",
];

export function listCrates() {
  if (!existsSync(NATIVE_DIR)) return [];
  return readdirSync(NATIVE_DIR).filter(
    (f) => f.startsWith("libomniroute_ffi_") && f.endsWith(".dylib")
  );
}

export function resolve(crateBaseName) {
  const filename = crateBaseName.endsWith(".dylib")
    ? crateBaseName
    : `${crateBaseName}.dylib`;
  const p = join(NATIVE_DIR, filename);
  if (!existsSync(p)) return null;
  return p;
}

export default { platform, nativeDir, listCrates, resolve };
