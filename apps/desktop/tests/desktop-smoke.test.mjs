import assert from "node:assert/strict";
import { access } from "node:fs/promises";

for (const file of ["src-tauri/Cargo.toml", "src-tauri/tauri.conf.json", "src-tauri/capabilities/default.json"]) {
  await access(new URL(`../${file}`, import.meta.url));
}
assert.ok(true, "Tauri shell manifest is present");
