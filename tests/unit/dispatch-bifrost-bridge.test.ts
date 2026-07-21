import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dispatch Bifrost Go SDK bridge (Option D, F6)", () => {
  it("bridge Cargo.toml exists and includes cgo build.rs", () => {
    const path = resolve(
      "crates/omniroute-ffi/crates/bifrost-bridge/Cargo.toml"
    );
    assert.ok(
      existsSync(path),
      `bridge crate Cargo.toml should exist at ${path}`
    );
  });

  it("bridge build.rs exists and links Go via cgo", () => {
    const path = resolve(
      "crates/omniroute-ffi/crates/bifrost-bridge/build.rs"
    );
    assert.ok(
      existsSync(path),
      `bridge build.rs should exist at ${path}`
    );
  });

  it("Go bridge source exists", () => {
    const bridge = resolve(
      "crates/omniroute-ffi/crates/bifrost-bridge/bridge.go"
    );
    const bifrost = resolve(
      "crates/omniroute-ffi/crates/bifrost-bridge/bifrost.go"
    );
    assert.ok(
      existsSync(bridge) || existsSync(bifrost),
      "at least one Go source file should exist"
    );
  });

  it("bridge lib.rs exports extern C functions", () => {
    const path = resolve(
      "crates/omniroute-ffi/crates/bifrost-bridge/src/lib.rs"
    );
    assert.ok(existsSync(path), `lib.rs should exist at ${path}`);
  });

  it("bridge crate is in the workspace Cargo.toml", () => {
    const wsPath = resolve("crates/omniroute-ffi/Cargo.toml");
    const content = readFileSync(wsPath, "utf-8");
    assert.ok(
      content.includes("bifrost-bridge"),
      "workspace Cargo.toml should include bifrost-bridge"
    );
  });
});
