"use strict";
const fs = require("node:fs");
const path = require("node:path");
const NATIVE_DIR = path.join(__dirname, "..", "native");
if (!fs.existsSync(NATIVE_DIR)) {
  fs.mkdirSync(NATIVE_DIR, { recursive: true });
  process.stderr.write("[omniroute-ffi-darwin-x64] native/ is empty — install was published without prebuilt binaries.\n");
}
process.exit(0);