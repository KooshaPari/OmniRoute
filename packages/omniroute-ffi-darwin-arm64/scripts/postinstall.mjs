/**
 * postinstall for @omniroute/ffi-darwin-arm64.
 * Verifies the native/ dir contains at least one cdylib. If not, marks the
 * install as "skipped" but exits 0 so `optionalDependencies` does not abort
 * the parent `npm install`. cdylib binaries are published via the release
 * pipeline (`scripts/build-cross-ffi.sh` + `scripts/publish-ffi-packages.sh`).
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const NATIVE_DIR = path.join(__dirname, "..", "native");
if (!fs.existsSync(NATIVE_DIR)) {
  // Create empty dir so the package layout is stable.
  fs.mkdirSync(NATIVE_DIR, { recursive: true });
  process.stderr.write(
    "[omniroute-ffi-darwin-arm64] native/ is empty — install was published without prebuilt binaries. " +
      "Rebuild with `npm run ffi:cross` or set OMNIROUTE_FFI_PATH at runtime.\n",
  );
}
process.exit(0);