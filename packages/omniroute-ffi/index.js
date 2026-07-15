/**
 * OmniRoute FFI discovery.
 * Picks the per-platform package that matches `process.platform` + `process.arch`
 * via the npm optionalDependencies chain. Returns a tuple of { platform, path }
 * for each Rust cdylib that was successfully resolved, or null if the host
 * platform is unsupported (Windows arm64, musl, freebsd, ...).
 */
"use strict";
const PATH = require("node:path");
const PLATFORM_TABLE = {
  "darwin:arm64": "@omniroute/ffi-darwin-arm64",
  "darwin:x64": "@omniroute/ffi-darwin-x64",
  "linux:x64": "@omniroute/ffi-linux-x64-gnu",
  "linux:arm64": "@omniroute/ffi-linux-arm64-gnu",
  "win32:x64": "@omniroute/ffi-win32-x64",
};

function platformKey() {
  const os = process.platform;
  const arch = process.arch;
  if (os === "win32" && arch === "ia32") return null;
  return `${os}:${arch}`;
}

function pickPlatform() {
  const key = platformKey();
  if (!key) return null;
  const pkg = PLATFORM_TABLE[key];
  if (!pkg) return null;
  try {
    const m = require(pkg);
    return { key, pkg, ...m };
  } catch (_err) {
    // Optional dependency not installed for this platform; expected when
    // cross-publishing or in CI on an unsupported platform.
    return null;
  }
}

function discoverCrates() {
  const platform = pickPlatform();
  if (!platform) return { platform: null, crates: {} };
  const map = {};
  for (const f of platform.listCrates()) {
    map[f] = platform.resolve(f);
  }
  return { platform: platform.key, crates: map };
}

function discoverCrate(crateBaseName) {
  const platform = pickPlatform();
  if (!platform) return null;
  return platform.resolve(crateBaseName);
}

module.exports = {
  platformKey,
  pickPlatform,
  discoverCrates,
  discoverCrate,
  PLATFORM_TABLE,
};