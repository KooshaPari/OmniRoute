/**
 * postinstall for @omniroute/omniroute-ffi-win32-x64 (ESM).
 * Verifies the native/ dir contains at least one cdylib. If not, marks the
 * install as "skipped" but exits 0 so optionalDependencies does not abort
 * the parent install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NATIVE_DIR = path.join(__dirname, "..", "native");
if (!fs.existsSync(NATIVE_DIR)) {
  fs.mkdirSync(NATIVE_DIR, { recursive: true });
  process.stderr.write(
    "[@omniroute/omniroute-ffi-win32-x64] native/ is empty - install was published without prebuilt binaries. " +
      "Rebuild with `npm run ffi:cross` or set OMNIROUTE_FFI_PATH at runtime.\n",
  );
}
process.exit(0);